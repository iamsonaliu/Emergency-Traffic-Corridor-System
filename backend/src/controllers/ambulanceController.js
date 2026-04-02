const Ambulance = require("../models/Ambulance");
const Hospital = require("../models/Hospital");
const { selectBestHospital, failoverHospital } = require("../services/hospitalService");
const { computeRoute, rerouteAmbulance } = require("../services/routeService");
const { initCorridor, updateAmbulancePosition, rerouteCorridor, clearCorridor } = require("../services/trafficService");
const { logEvent } = require("../utils/auditLogger");
const { getRoadNetwork } = require("../utils/roadNetwork");

// ---------------------------------------------------------------------------
// STEP 1 — Trigger Emergency
// POST /api/ambulance/trigger
// ---------------------------------------------------------------------------

exports.triggerEmergency = async (req, res) => {
  try {
    const { ambulanceId, lat, lng, emergencyType } = req.body;

    if (!ambulanceId || lat === undefined || lng === undefined) {
      return res.status(400).json({ error: "ambulanceId, lat, and lng are required" });
    }

    logEvent("AMBULANCE_CONTROLLER", `Emergency triggered by ${ambulanceId} at (${lat}, ${lng})`);

    // Find or create ambulance record
    let ambulance = await Ambulance.findOne({ ambulanceId });
    if (!ambulance) {
      ambulance = new Ambulance({ ambulanceId });
    }

    ambulance.status = "active";
    ambulance.activeSession = {
      gps: { lat, lng },
      timestamp: new Date(),
      emergencyType: emergencyType || "general",
    };
    await ambulance.save();

    // STEP 2–3: Select best hospital
    const { selected, candidates } = await selectBestHospital(lat, lng, emergencyType, ambulanceId);

    if (!selected) {
      logEvent("AMBULANCE_CONTROLLER", `No available hospital found for ${ambulanceId}`);
      return res.status(503).json({ error: "No available hospitals at this time. Please contact control manually." });
    }

    const hospital = selected.hospital;

    // STEP 4: Compute route
    const roadNetwork = getRoadNetwork();

    // Map lat/lng to nearest road network node (simplified — uses hospitalId as node key)
    const ambulanceNode = findNearestNode(lat, lng, roadNetwork.nodeMetadata);
    const hospitalNode = hospital.hospitalId;

    const routeResult = computeRoute(
      { lat, lng, nodeId: ambulanceNode },
      { lat: hospital.location.lat, lng: hospital.location.lng, nodeId: hospitalNode },
      roadNetwork,
      ambulanceId
    );

    if (!routeResult) {
      return res.status(500).json({ error: "Could not compute route to selected hospital" });
    }

    // Save assignment to ambulance session
    ambulance.activeSession.assignedHospitalId = hospital.hospitalId;
    ambulance.activeSession.routeId = routeResult.routeId;
    ambulance.activeSession.eta = routeResult.totalTimeMinutes;
    await ambulance.save();

    // STEP 5: Init traffic corridor
    const io = req.app.get("io");
    initCorridor(routeResult, io);

    // Notify control & hospital via WebSocket
    if (io) {
      io.emit("emergency_dispatched", {
        ambulanceId,
        hospital: {
          id: hospital.hospitalId,
          name: hospital.name,
          address: hospital.address,
          eta: selected.eta,
        },
        route: routeResult,
        candidates: candidates.map((c) => ({
          name: c.hospital.name,
          eta: c.eta,
          distanceKm: c.distanceKm,
          status: c.responseStatus,
          availableBeds: c.hospital.emergencyBeds.available,
        })),
        timestamp: new Date().toISOString(),
      });
    }

    logEvent("AMBULANCE_CONTROLLER", `Dispatched: ${ambulanceId} → ${hospital.name} | ETA: ${selected.eta} min | Route: ${routeResult.routeId}`);

    // AMBULANCE DRIVER OUTPUT
    return res.json({
      entity: "AMBULANCE_DRIVER",
      confirmation: "✅ Emergency request received and processed.",
      hospital: {
        name: hospital.name,
        address: hospital.address,
        eta: `${selected.eta} min`,
      },
      navigationSteps: routeResult.navigationSteps,
      corridor: {
        routeId: routeResult.routeId,
        totalSignals: routeResult.signalCount,
        status: "Corridor initialization in progress",
      },
      signals: routeResult.signals.map((s) => ({
        id: s.signalId,
        name: s.name,
        etaMinutes: s.etaMinutes,
        status: s.status,
      })),
    });
  } catch (err) {
    console.error("[TRIGGER ERROR]", err);
    logEvent("AMBULANCE_CONTROLLER", `ERROR during trigger: ${err.message}`);
    res.status(500).json({ error: "Internal server error during emergency trigger" });
  }
};

// ---------------------------------------------------------------------------
// GPS Update
// POST /api/ambulance/update-location
// ---------------------------------------------------------------------------

exports.updateLocation = async (req, res) => {
  try {
    const { ambulanceId, lat, lng, currentSignalIndex } = req.body;

    const ambulance = await Ambulance.findOne({ ambulanceId });
    if (!ambulance || ambulance.status !== "active") {
      return res.status(404).json({ error: "No active emergency for this ambulance" });
    }

    ambulance.activeSession.gps = { lat, lng };
    await ambulance.save();

    const routeId = ambulance.activeSession.routeId;
    const io = req.app.get("io");

    if (routeId && currentSignalIndex !== undefined) {
      updateAmbulancePosition(routeId, currentSignalIndex, io);
    }

    // Broadcast live location
    if (io) {
      io.emit("ambulance_location_update", {
        ambulanceId,
        lat,
        lng,
        routeId,
        currentSignalIndex,
        timestamp: new Date().toISOString(),
      });
    }

    logEvent("AMBULANCE_CONTROLLER", `GPS update: ${ambulanceId} → (${lat}, ${lng}) signal index ${currentSignalIndex}`);

    res.json({ status: "Location updated", lat, lng });
  } catch (err) {
    console.error("[GPS UPDATE ERROR]", err);
    res.status(500).json({ error: "Failed to update location" });
  }
};

// ---------------------------------------------------------------------------
// Failover — Hospital became unavailable mid-route
// POST /api/ambulance/failover
// ---------------------------------------------------------------------------

exports.triggerFailover = async (req, res) => {
  try {
    const { ambulanceId } = req.body;

    const ambulance = await Ambulance.findOne({ ambulanceId });
    if (!ambulance || ambulance.status !== "active") {
      return res.status(404).json({ error: "No active emergency for this ambulance" });
    }

    const { gps, assignedHospitalId, routeId, emergencyType } = ambulance.activeSession;

    logEvent("AMBULANCE_CONTROLLER", `FAILOVER requested for ${ambulanceId} — old hospital: ${assignedHospitalId}`);

    const newHospital = await failoverHospital(
      gps.lat, gps.lng, emergencyType, ambulanceId, assignedHospitalId
    );

    if (!newHospital) {
      return res.status(503).json({ error: "Failover failed — no alternative hospitals available" });
    }

    const roadNetwork = getRoadNetwork();
    const currentNode = findNearestNode(gps.lat, gps.lng, roadNetwork.nodeMetadata);
    const newRoute = rerouteAmbulance(currentNode, newHospital.hospital.hospitalId, roadNetwork, ambulanceId);

    if (!newRoute) {
      return res.status(500).json({ error: "Could not compute reroute" });
    }

    // Update session
    ambulance.activeSession.assignedHospitalId = newHospital.hospital.hospitalId;
    ambulance.activeSession.routeId = newRoute.routeId;
    ambulance.activeSession.eta = newRoute.totalTimeMinutes;
    await ambulance.save();

    const io = req.app.get("io");
    rerouteCorridor(routeId, newRoute, io);

    if (io) {
      io.emit("ambulance_rerouted", {
        ambulanceId,
        reason: "Hospital became unavailable",
        newHospital: {
          name: newHospital.hospital.name,
          address: newHospital.hospital.address,
          eta: `${newHospital.eta} min`,
        },
        newRoute,
        timestamp: new Date().toISOString(),
      });
    }

    res.json({
      entity: "AMBULANCE_DRIVER",
      alert: "⚠️ Hospital changed — rerouting now.",
      newHospital: {
        name: newHospital.hospital.name,
        address: newHospital.hospital.address,
        eta: `${newHospital.eta} min`,
      },
      navigationSteps: newRoute.navigationSteps,
      corridor: { routeId: newRoute.routeId, totalSignals: newRoute.signalCount },
    });
  } catch (err) {
    console.error("[FAILOVER ERROR]", err);
    res.status(500).json({ error: "Failover error" });
  }
};

// ---------------------------------------------------------------------------
// End Emergency Session
// POST /api/ambulance/end-session
// ---------------------------------------------------------------------------

exports.endSession = async (req, res) => {
  try {
    const { ambulanceId } = req.body;

    const ambulance = await Ambulance.findOne({ ambulanceId });
    if (!ambulance) return res.status(404).json({ error: "Ambulance not found" });

    const routeId = ambulance.activeSession?.routeId;
    const hospitalId = ambulance.activeSession?.assignedHospitalId;

    // Release bed
    if (hospitalId) {
      const hospital = await Hospital.findOne({ hospitalId });
      if (hospital) await hospital.releaseBed();
    }

    // Clear corridor
    if (routeId) clearCorridor(routeId);

    // Clear session (data privacy — session-based only)
    await ambulance.clearSession();

    const io = req.app.get("io");
    if (io) {
      io.emit("emergency_ended", {
        ambulanceId,
        timestamp: new Date().toISOString(),
      });
    }

    logEvent("AMBULANCE_CONTROLLER", `Session ended for ${ambulanceId} — data cleared`);
    res.json({ status: "Emergency session ended. All data cleared." });
  } catch (err) {
    console.error("[END SESSION ERROR]", err);
    res.status(500).json({ error: "Failed to end session" });
  }
};

// ---------------------------------------------------------------------------
// Get Ambulance Status
// GET /api/ambulance/:ambulanceId/status
// ---------------------------------------------------------------------------

exports.getStatus = async (req, res) => {
  try {
    const { ambulanceId } = req.params;
    const ambulance = await Ambulance.findOne({ ambulanceId });
    if (!ambulance) return res.status(404).json({ error: "Ambulance not found" });

    res.json({
      ambulanceId: ambulance.ambulanceId,
      status: ambulance.status,
      session: ambulance.status === "active" ? ambulance.activeSession : null,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch status" });
  }
};

// ---------------------------------------------------------------------------
// Utility: Find nearest road network node to GPS coordinates
// ---------------------------------------------------------------------------

function findNearestNode(lat, lng, nodeMetadata) {
  let bestNode = null;
  let bestDist = Infinity;

  for (const [nodeId, meta] of Object.entries(nodeMetadata)) {
    if (!meta.lat || !meta.lng) continue;
    const dist = Math.sqrt((meta.lat - lat) ** 2 + (meta.lng - lng) ** 2);
    if (dist < bestDist) {
      bestDist = dist;
      bestNode = nodeId;
    }
  }

  return bestNode;
}