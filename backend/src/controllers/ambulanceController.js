const Ambulance = require("../models/Ambulance");
const Hospital = require("../models/Hospital");
const Emergency = require("../models/Emergency");
const { selectBestHospital, failoverHospital } = require("../services/hospitalService");
const { computeRoute, rerouteAmbulance } = require("../services/routeService");
const {
  initCorridor,
  updateAmbulancePosition,
  rerouteCorridor,
  clearCorridor,
} = require("../services/trafficService");
const { logEvent } = require("../utils/auditLogger");
// const Ambulance = require("../models/Ambulance");
// const Hospital = require("../models/Hospital");
// const Emergency = require("../models/Emergency");
// const { selectBestHospital, failoverHospital } = require("../services/hospitalService");
// const { computeRoute } = require("../services/osmRouteService");
// const { rerouteAmbulance } = require("../services/routeService");
// const {
//   initCorridor,
//   updateAmbulancePosition,
//   rerouteCorridor,
//   clearCorridor,
// } = require("../services/trafficService");

// const { logEvent } = require("../utils/auditLogger");

// Generate unique emergency ID
function generateEmergencyId() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `EMG-${ts}-${rand}`;
}

// ---------------------------------------------------------------------------
// POST /api/ambulance/trigger — Trigger an emergency
// ---------------------------------------------------------------------------
exports.triggerEmergency = async (req, res) => {
  try {
    const { ambulanceId, lat, lng, emergencyType = "general" } = req.body;

    if (!ambulanceId || lat === undefined || lng === undefined) {
      return res.status(400).json({ error: "ambulanceId, lat, lng are required" });
    }

    const emergencyId = generateEmergencyId();
    logEvent("AMBULANCE_CTRL", `Emergency ${emergencyId} triggered by ${ambulanceId} at (${lat}, ${lng})`);

    // Find or create ambulance
    let ambulance = await Ambulance.findOne({ ambulanceId });
    if (!ambulance) {
      ambulance = await Ambulance.create({
        ambulanceId,
        status: "active",
        lastKnownGps: { lat, lng, timestamp: new Date() },
      });
    } else {
      ambulance.status = "active";
      ambulance.lastKnownGps = { lat, lng, timestamp: new Date() };
      await ambulance.save();
    }

    // Create emergency record
    const emergency = await Emergency.create({
      emergencyId,
      ambulanceId,
      emergencyType,
      status: "triggered",
      origin: { lat, lng },
      triggeredAt: new Date(),
      notes: [{ message: `Emergency triggered at (${lat}, ${lng})`, author: ambulanceId }],
    });

    // Broadcast trigger to all clients
    const io = req.app.get("io");
    if (io) {
      io.emit("emergency_triggered", {
        emergencyId,
        ambulanceId,
        lat,
        lng,
        emergencyType,
        timestamp: new Date().toISOString(),
      });
    }

    // --- Hospital Selection ---
    emergency.status = "hospital_selection";
    await emergency.save();

    const { selected, candidates } = await selectBestHospital(lat, lng, emergencyType, ambulanceId, emergencyId);

    if (!selected) {
      emergency.status = "failed";
      emergency.notes.push({ message: "No hospitals available", author: "SYSTEM" });
      await emergency.save();

      if (io) io.emit("emergency_failed", { emergencyId, reason: "No hospitals available" });
      return res.status(503).json({ error: "No available hospitals at this time" });
    }

    const hospital = selected.hospital;

    // --- Route Computation ---
    emergency.status = "routing";
    await emergency.save();

    const routeResult = await computeRoute(lat, lng, hospital.lat, hospital.lng, ambulanceId);

    if (!routeResult) {
      emergency.status = "failed";
      await emergency.save();
      return res.status(500).json({ error: "Could not compute route" });
    }

    // --- Update Emergency with full data ---
    emergency.status = "en_route";
    emergency.dispatchedAt = new Date();
    emergency.assignedHospital = {
      hospitalId: hospital.hospitalId,
      name: hospital.name,
      lat: hospital.lat,
      lng: hospital.lng,
      address: hospital.address,
      etaMinutes: selected.eta,
      distanceKm: selected.distanceKm,
    };
    emergency.hospitalCandidates = candidates.map((c) => ({
      hospitalId: c.hospital.hospitalId,
      name: c.hospital.name,
      etaMinutes: c.eta,
      distanceKm: c.distanceKm,
      availableBeds: c.hospital.emergencyBeds.available,
      responseStatus: c.responseStatus,
    }));
    emergency.route = {
      routeId: routeResult.routeId,
      totalDistanceKm: routeResult.totalDistanceKm,
      totalTimeMinutes: routeResult.totalTimeMinutes,
      polyline: routeResult.polyline,
      navigationSteps: routeResult.navigationSteps,
    };
    emergency.corridor = {
      routeId: routeResult.routeId,
      signalCount: routeResult.signalCount,
      passedCount: 0,
    };
    emergency.signals = routeResult.signals;
    await emergency.save();

    // --- Update Ambulance session ---
    ambulance.activeSession = {
      emergencyId,
      gps: { lat, lng, timestamp: new Date() },
      emergencyType,
      assignedHospitalId: hospital.hospitalId,
      routeId: routeResult.routeId,
      eta: routeResult.totalTimeMinutes,
      distanceRemaining: routeResult.totalDistanceKm,
      currentSignalIndex: 0,
      dispatchTime: new Date(),
      routePolyline: routeResult.polyline,
    };
    await ambulance.save();

    // --- Init Traffic Corridor ---
    initCorridor(
      {
        ...routeResult,
        emergencyId,
        ambulanceId,
      },
      io
    );

    // --- Broadcast dispatch ---
    if (io) {
      io.emit("emergency_dispatched", {
        emergencyId,
        ambulanceId,
        hospital: {
          id: hospital.hospitalId,
          name: hospital.name,
          address: hospital.address,
          lat: hospital.lat,
          lng: hospital.lng,
          eta: selected.eta,
          distanceKm: selected.distanceKm,
          availableBeds: hospital.emergencyBeds.available,
        },
        route: {
          routeId: routeResult.routeId,
          totalDistanceKm: routeResult.totalDistanceKm,
          totalTimeMinutes: routeResult.totalTimeMinutes,
          polyline: routeResult.polyline,        // GeoJSON LineString
          navigationSteps: routeResult.navigationSteps,
          signals: routeResult.signals,
        },
        candidates: emergency.hospitalCandidates,
        timestamp: new Date().toISOString(),
      });
    }

    logEvent("AMBULANCE_CTRL", `${ambulanceId} → ${hospital.name} | ETA: ${selected.eta}min | Route: ${routeResult.routeId}`);

    return res.json({
      emergencyId,
      confirmation: "Emergency request received and processed.",
      hospital: {
        name: hospital.name,
        address: hospital.address,
        eta: `${selected.eta} min`,
        distanceKm: selected.distanceKm,
        lat: hospital.lat,
        lng: hospital.lng,
      },
      route: {
        routeId: routeResult.routeId,
        totalDistanceKm: routeResult.totalDistanceKm,
        totalTimeMinutes: routeResult.totalTimeMinutes,
        polyline: routeResult.polyline,
        navigationSteps: routeResult.navigationSteps,
      },
      corridor: {
        routeId: routeResult.routeId,
        totalSignals: routeResult.signalCount,
        status: "Corridor initialization in progress",
      },
      signals: routeResult.signals.map((s) => ({
        id: s.signalId,
        name: s.name,
        lat: s.lat,
        lng: s.lng,
        etaMinutes: s.etaMinutes,
        status: s.status,
      })),
      candidates: emergency.hospitalCandidates,
    });
  } catch (err) {
    console.error("[TRIGGER ERROR]", err);
    logEvent("AMBULANCE_CTRL", `ERROR trigger: ${err.message}`);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ---------------------------------------------------------------------------
// POST /api/ambulance/update-location — Live GPS update
// ---------------------------------------------------------------------------
exports.updateLocation = async (req, res) => {
  try {
    const { ambulanceId, lat, lng, heading = 0, speed = 0, currentSignalIndex } = req.body;

    if (!ambulanceId || lat === undefined || lng === undefined) {
      return res.status(400).json({ error: "ambulanceId, lat, lng required" });
    }

    const ambulance = await Ambulance.findOne({ ambulanceId });
    if (!ambulance) {
      return res.status(404).json({ error: "Ambulance not found" });
    }

    const gpsPoint = { lat, lng, heading, speed, timestamp: new Date() };

    // Update GPS
    ambulance.lastKnownGps = gpsPoint;
    ambulance.lastSeenAt = new Date();

    if (ambulance.status === "active" && ambulance.activeSession) {
      ambulance.activeSession.gps = gpsPoint;

      // Recalculate ETA based on remaining distance
      if (ambulance.activeSession.distanceRemaining > 0) {
        const remainingTime = Math.ceil((ambulance.activeSession.distanceRemaining / 45) * 60);
        ambulance.activeSession.eta = remainingTime;
      }

      if (currentSignalIndex !== undefined) {
        ambulance.activeSession.currentSignalIndex = currentSignalIndex;
      }
    }

    // Push to GPS history (keep last 200)
    ambulance.gpsHistory.push(gpsPoint);
    if (ambulance.gpsHistory.length > 200) {
      ambulance.gpsHistory = ambulance.gpsHistory.slice(-200);
    }

    await ambulance.save();

    // Update corridor signal positions
    const routeId = ambulance.activeSession?.routeId;
    const io = req.app.get("io");

    if (routeId && currentSignalIndex !== undefined) {
      await updateAmbulancePosition(routeId, currentSignalIndex, io);
    }

    // Broadcast live location
    if (io) {
      io.emit("ambulance_location_update", {
        ambulanceId,
        lat,
        lng,
        heading,
        speed,
        routeId,
        currentSignalIndex,
        eta: ambulance.activeSession?.eta,
        timestamp: new Date().toISOString(),
      });
    }

    // Also update emergency GPS track
    if (ambulance.activeSession?.emergencyId) {
      await Emergency.updateOne(
        { emergencyId: ambulance.activeSession.emergencyId },
        {
          $push: {
            gpsTrack: { $each: [gpsPoint], $slice: -500 },
          },
        }
      ).catch(() => {});
    }

    res.json({
      status: "updated",
      lat,
      lng,
      routeId,
      eta: ambulance.activeSession?.eta,
    });
  } catch (err) {
    console.error("[GPS UPDATE ERROR]", err);
    res.status(500).json({ error: "Failed to update location" });
  }
};

// ---------------------------------------------------------------------------
// POST /api/ambulance/failover — Hospital unavailable, reroute
// ---------------------------------------------------------------------------
exports.triggerFailover = async (req, res) => {
  try {
    const { ambulanceId } = req.body;

    const ambulance = await Ambulance.findOne({ ambulanceId });
    if (!ambulance || ambulance.status !== "active") {
      return res.status(404).json({ error: "No active emergency for this ambulance" });
    }

    const { gps, assignedHospitalId, routeId, emergencyId, emergencyType } = ambulance.activeSession;

    logEvent("AMBULANCE_CTRL", `FAILOVER for ${ambulanceId} — old hospital: ${assignedHospitalId}`);

    const newHospital = await failoverHospital(gps.lat, gps.lng, emergencyType, ambulanceId, assignedHospitalId);

    if (!newHospital) {
      return res.status(503).json({ error: "Failover failed — no alternative hospitals" });
    }

    const newRoute = await rerouteAmbulance(
      gps.lat, gps.lng,
      newHospital.hospital.lat, newHospital.hospital.lng,
      ambulanceId
    );

    if (!newRoute) {
      return res.status(500).json({ error: "Could not compute reroute" });
    }

    // Update ambulance session
    ambulance.activeSession.assignedHospitalId = newHospital.hospital.hospitalId;
    ambulance.activeSession.routeId = newRoute.routeId;
    ambulance.activeSession.eta = newRoute.totalTimeMinutes;
    ambulance.activeSession.routePolyline = newRoute.polyline;
    await ambulance.save();

    // Update emergency record
    await Emergency.updateOne(
      { emergencyId },
      {
        $set: {
          "assignedHospital.hospitalId": newHospital.hospital.hospitalId,
          "assignedHospital.name": newHospital.hospital.name,
          "assignedHospital.lat": newHospital.hospital.lat,
          "assignedHospital.lng": newHospital.hospital.lng,
          "assignedHospital.etaMinutes": newHospital.eta,
          "route.routeId": newRoute.routeId,
          "route.totalDistanceKm": newRoute.totalDistanceKm,
          "route.totalTimeMinutes": newRoute.totalTimeMinutes,
          "route.polyline": newRoute.polyline,
          "corridor.routeId": newRoute.routeId,
          "corridor.signalCount": newRoute.signalCount,
        },
        $push: {
          notes: {
            message: `Rerouted to ${newHospital.hospital.name} — old hospital unavailable`,
            author: "SYSTEM",
          },
        },
      }
    );

    const io = req.app.get("io");
    await rerouteCorridor(routeId, { ...newRoute, emergencyId, ambulanceId }, io);

    if (io) {
      io.emit("ambulance_rerouted", {
        ambulanceId,
        emergencyId,
        reason: "Hospital unavailable",
        newHospital: {
          name: newHospital.hospital.name,
          address: newHospital.hospital.address,
          lat: newHospital.hospital.lat,
          lng: newHospital.hospital.lng,
          eta: `${newHospital.eta} min`,
        },
        newRoute: {
          routeId: newRoute.routeId,
          polyline: newRoute.polyline,
          navigationSteps: newRoute.navigationSteps,
          totalDistanceKm: newRoute.totalDistanceKm,
          totalTimeMinutes: newRoute.totalTimeMinutes,
        },
        timestamp: new Date().toISOString(),
      });
    }

    res.json({
      alert: "Hospital changed — rerouting now.",
      newHospital: {
        name: newHospital.hospital.name,
        address: newHospital.hospital.address,
        eta: `${newHospital.eta} min`,
        lat: newHospital.hospital.lat,
        lng: newHospital.hospital.lng,
      },
      route: {
        routeId: newRoute.routeId,
        polyline: newRoute.polyline,
        navigationSteps: newRoute.navigationSteps,
      },
    });
  } catch (err) {
    console.error("[FAILOVER ERROR]", err);
    res.status(500).json({ error: "Failover error" });
  }
};

// ---------------------------------------------------------------------------
// POST /api/ambulance/end-session
// ---------------------------------------------------------------------------
exports.endSession = async (req, res) => {
  try {
    const { ambulanceId } = req.body;

    const ambulance = await Ambulance.findOne({ ambulanceId });
    if (!ambulance) return res.status(404).json({ error: "Ambulance not found" });

    const { routeId, assignedHospitalId, emergencyId, dispatchTime, gps } = ambulance.activeSession || {};

    // Release hospital bed
    if (assignedHospitalId) {
      const hospital = await Hospital.findOne({ hospitalId: assignedHospitalId });
      if (hospital) await hospital.releaseBed();
    }

    // Clear corridor
    if (routeId) clearCorridor(routeId);

    // Complete emergency record
    if (emergencyId) {
      const emergency = await Emergency.findOne({ emergencyId });
      if (emergency) {
        emergency.status = "completed";
        emergency.completedAt = new Date();
        emergency.arrivedAt = emergency.arrivedAt || new Date();
        if (dispatchTime) {
          emergency.actualTravelTimeMinutes = Math.round(
            (new Date() - new Date(dispatchTime)) / 60000
          );
        }
        await emergency.save();
      }
    }

    // Clear ambulance session
    await ambulance.clearSession();

    const io = req.app.get("io");
    if (io) {
      io.emit("emergency_ended", {
        ambulanceId,
        emergencyId,
        timestamp: new Date().toISOString(),
      });
    }

    logEvent("AMBULANCE_CTRL", `Session ended for ${ambulanceId} (${emergencyId})`);
    res.json({ status: "Emergency session ended. Ambulance returned to idle." });
  } catch (err) {
    console.error("[END SESSION ERROR]", err);
    res.status(500).json({ error: "Failed to end session" });
  }
};

// ---------------------------------------------------------------------------
// GET /api/ambulance/:ambulanceId/status
// ---------------------------------------------------------------------------
exports.getStatus = async (req, res) => {
  try {
    const { ambulanceId } = req.params;
    const ambulance = await Ambulance.findOne({ ambulanceId });
    if (!ambulance) return res.status(404).json({ error: "Ambulance not found" });

    // If active, fetch current emergency data
    let emergencyData = null;
    if (ambulance.status === "active" && ambulance.activeSession?.emergencyId) {
      emergencyData = await Emergency.findOne(
        { emergencyId: ambulance.activeSession.emergencyId },
        "-gpsTrack"
      ).lean();
    }

    res.json({
      ambulanceId: ambulance.ambulanceId,
      status: ambulance.status,
      lastKnownGps: ambulance.lastKnownGps,
      lastSeenAt: ambulance.lastSeenAt,
      session: ambulance.status === "active" ? ambulance.activeSession : null,
      emergency: emergencyData,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch status" });
  }
};

// ---------------------------------------------------------------------------
// GET /api/ambulance — All ambulances
// ---------------------------------------------------------------------------
exports.getAllAmbulances = async (req, res) => {
  try {
    const ambulances = await Ambulance.find({}, "-gpsHistory").lean();
    res.json(ambulances);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch ambulances" });
  }
};

// ---------------------------------------------------------------------------
// GET /api/ambulance/active — Active emergencies
// ---------------------------------------------------------------------------
exports.getActiveEmergencies = async (req, res) => {
  try {
    const emergencies = await Emergency.find(
      { status: { $in: ["triggered", "hospital_selection", "routing", "en_route"] } },
      "-gpsTrack"
    ).lean();
    res.json(emergencies);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch active emergencies" });
  }
};

// ---------------------------------------------------------------------------
// POST /api/ambulance/register — Register new ambulance
// ---------------------------------------------------------------------------
exports.registerAmbulance = async (req, res) => {
  try {
    const { ambulanceId, driverName, contactNumber, vehicleNumber } = req.body;
    if (!ambulanceId) return res.status(400).json({ error: "ambulanceId required" });

    const existing = await Ambulance.findOne({ ambulanceId });
    if (existing) return res.status(409).json({ error: "Ambulance already registered" });

    const ambulance = await Ambulance.create({
      ambulanceId: ambulanceId.toUpperCase(),
      driverName,
      contactNumber,
      vehicleNumber,
      status: "idle",
    });

    logEvent("AMBULANCE_CTRL", `Ambulance registered: ${ambulance.ambulanceId}`);
    res.status(201).json(ambulance);
  } catch (err) {
    res.status(500).json({ error: "Failed to register ambulance" });
  }
};

// ---------------------------------------------------------------------------
// GET /api/ambulance/:id/history — GPS track for an emergency
// ---------------------------------------------------------------------------
exports.getGpsHistory = async (req, res) => {
  try {
    const { ambulanceId } = req.params;
    const { emergencyId } = req.query;

    if (emergencyId) {
      const emergency = await Emergency.findOne({ emergencyId }, "gpsTrack").lean();
      if (!emergency) return res.status(404).json({ error: "Emergency not found" });
      return res.json({ emergencyId, track: emergency.gpsTrack });
    }

    const ambulance = await Ambulance.findOne({ ambulanceId }, "gpsHistory").lean();
    if (!ambulance) return res.status(404).json({ error: "Ambulance not found" });
    res.json({ ambulanceId, history: ambulance.gpsHistory });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch GPS history" });
  }
};