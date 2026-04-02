const Hospital = require("../models/Hospital");
const Emergency = require("../models/Emergency");
const { discoverAndSyncHospitals, queryNearestHospitals } = require("../services/hospitalService");
const { logEvent } = require("../utils/auditLogger");

// ---------------------------------------------------------------------------
// GET /api/hospital — All hospitals
// ---------------------------------------------------------------------------
exports.getAllHospitals = async (req, res) => {
  try {
    const { lat, lng, radius = 20 } = req.query;

    let hospitals;
    if (lat && lng) {
      hospitals = await Hospital.find({
        location: {
          $near: {
            $geometry: { type: "Point", coordinates: [parseFloat(lng), parseFloat(lat)] },
            $maxDistance: parseFloat(radius) * 1000,
          },
        },
      }).select("-pendingRequests").lean();
    } else {
      hospitals = await Hospital.find({}).select("-pendingRequests").lean();
    }

    res.json(hospitals);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch hospitals" });
  }
};

// ---------------------------------------------------------------------------
// GET /api/hospital/nearby — Hospitals near a GPS point (for ambulance)
// ---------------------------------------------------------------------------
exports.getNearbyHospitals = async (req, res) => {
  try {
    const { lat, lng, radius = 15, emergencyType } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ error: "lat and lng required" });
    }

    // Sync from OSM in background
    discoverAndSyncHospitals(parseFloat(lat), parseFloat(lng), parseFloat(radius) * 1000).catch(() => {});

    const candidates = await queryNearestHospitals(
      parseFloat(lat),
      parseFloat(lng),
      parseFloat(radius),
      emergencyType
    );

    res.json(
      candidates.map((c) => ({
        hospitalId: c.hospital.hospitalId,
        name: c.hospital.name,
        address: c.hospital.address,
        lat: c.hospital.lat,
        lng: c.hospital.lng,
        distanceKm: c.distanceKm,
        etaMinutes: c.eta,
        availableBeds: c.hospital.emergencyBeds.available,
        totalBeds: c.hospital.emergencyBeds.total,
        status: c.hospital.status,
        specialties: c.hospital.specialties,
        traumaLevel: c.hospital.traumaLevel,
      }))
    );
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch nearby hospitals" });
  }
};

// ---------------------------------------------------------------------------
// GET /api/hospital/:hospitalId
// ---------------------------------------------------------------------------
exports.getHospital = async (req, res) => {
  try {
    const hospital = await Hospital.findOne({ hospitalId: req.params.hospitalId });
    if (!hospital) return res.status(404).json({ error: "Hospital not found" });
    res.json(hospital);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch hospital" });
  }
};

// ---------------------------------------------------------------------------
// GET /api/hospital/:hospitalId/requests — Pending requests for hospital portal
// ---------------------------------------------------------------------------
exports.getPendingRequests = async (req, res) => {
  try {
    const hospital = await Hospital.findOne({ hospitalId: req.params.hospitalId });
    if (!hospital) return res.status(404).json({ error: "Hospital not found" });

    const pending = hospital.pendingRequests.filter((r) => r.responseStatus === "pending");

    res.json({
      hospitalId: hospital.hospitalId,
      hospitalName: hospital.name,
      availableBeds: hospital.emergencyBeds.available,
      totalBeds: hospital.emergencyBeds.total,
      status: hospital.status,
      pendingRequests: pending.map((r) => ({
        requestId: r._id,
        ambulanceId: r.ambulanceId,
        emergencyId: r.emergencyId,
        eta: `${r.eta} min`,
        emergencyType: r.emergencyType,
        requestedAt: r.requestedAt,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch pending requests" });
  }
};

// ---------------------------------------------------------------------------
// POST /api/hospital/:hospitalId/respond — Accept or reject
// ---------------------------------------------------------------------------
exports.respondToRequest = async (req, res) => {
  try {
    const { hospitalId } = req.params;
    const { ambulanceId, action } = req.body;

    if (!ambulanceId || !["accept", "reject"].includes(action)) {
      return res.status(400).json({ error: "ambulanceId and action (accept/reject) required" });
    }

    const hospital = await Hospital.findOne({ hospitalId });
    if (!hospital) return res.status(404).json({ error: "Hospital not found" });

    const request = hospital.pendingRequests.find(
      (r) => r.ambulanceId === ambulanceId && r.responseStatus === "pending"
    );

    if (!request) {
      return res.status(404).json({ error: "No pending request found" });
    }

    const io = req.app.get("io");

    if (action === "accept") {
      const reserved = await hospital.reserveBed(ambulanceId, request.emergencyId);
      if (!reserved) {
        return res.status(409).json({ error: "No beds available" });
      }

      logEvent("HOSPITAL_CTRL", `${hospital.name} ACCEPTED ambulance ${ambulanceId}`);

      if (io) {
        io.emit("hospital_accepted", {
          hospitalId,
          hospitalName: hospital.name,
          ambulanceId,
          emergencyId: request.emergencyId,
          bedsRemaining: hospital.emergencyBeds.available,
          timestamp: new Date().toISOString(),
        });
      }

      return res.json({
        status: "accepted",
        message: `Bed reserved for ambulance ${ambulanceId}`,
        bedsRemaining: hospital.emergencyBeds.available,
        hospitalStatus: hospital.status,
      });
    }

    // Reject
    request.responseStatus = "rejected";
    request.respondedAt = new Date();
    await hospital.save();

    logEvent("HOSPITAL_CTRL", `${hospital.name} REJECTED ambulance ${ambulanceId}`);

    if (io) {
      io.emit("hospital_rejected", {
        hospitalId,
        ambulanceId,
        emergencyId: request.emergencyId,
        timestamp: new Date().toISOString(),
      });
    }

    return res.json({ status: "rejected", message: `Request from ${ambulanceId} rejected` });
  } catch (err) {
    console.error("[HOSPITAL RESPOND ERROR]", err);
    res.status(500).json({ error: "Failed to process response" });
  }
};

// ---------------------------------------------------------------------------
// PUT /api/hospital/:hospitalId/beds — Update bed counts
// ---------------------------------------------------------------------------
exports.updateBeds = async (req, res) => {
  try {
    const { hospitalId } = req.params;
    const { available, total } = req.body;

    const hospital = await Hospital.findOne({ hospitalId });
    if (!hospital) return res.status(404).json({ error: "Hospital not found" });

    if (total !== undefined) hospital.emergencyBeds.total = Math.max(0, total);
    if (available !== undefined) {
      hospital.emergencyBeds.available = Math.max(0, Math.min(available, hospital.emergencyBeds.total));
    }

    await hospital.save();

    logEvent("HOSPITAL_CTRL", `Beds updated for ${hospital.name}: avail=${hospital.emergencyBeds.available}, total=${hospital.emergencyBeds.total}`);

    const io = req.app.get("io");
    if (io) {
      io.emit("hospital_beds_updated", {
        hospitalId,
        hospitalName: hospital.name,
        available: hospital.emergencyBeds.available,
        total: hospital.emergencyBeds.total,
        status: hospital.status,
        timestamp: new Date().toISOString(),
      });
    }

    res.json({
      hospitalId,
      emergencyBeds: hospital.emergencyBeds,
      status: hospital.status,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to update beds" });
  }
};

// ---------------------------------------------------------------------------
// POST /api/hospital — Create hospital (admin)
// ---------------------------------------------------------------------------
exports.createHospital = async (req, res) => {
  try {
    const { hospitalId, name, address, lat, lng, totalBeds, contactNumber, specialties, traumaLevel } = req.body;

    if (!hospitalId || !name || !address || lat === undefined || lng === undefined) {
      return res.status(400).json({ error: "hospitalId, name, address, lat, lng required" });
    }

    const existing = await Hospital.findOne({ hospitalId });
    if (existing) return res.status(409).json({ error: "Hospital already exists" });

    const hospital = await Hospital.create({
      hospitalId: hospitalId.toUpperCase(),
      name,
      address,
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      location: { type: "Point", coordinates: [parseFloat(lng), parseFloat(lat)] },
      emergencyBeds: {
        total: totalBeds || 10,
        available: totalBeds || 10,
        reserved: 0,
      },
      status: totalBeds > 0 ? "available" : "full",
      contactNumber,
      specialties: specialties || ["General Emergency"],
      traumaLevel: traumaLevel || "Level 2",
      source: "manual",
    });

    logEvent("HOSPITAL_CTRL", `New hospital: "${name}" (${hospitalId})`);
    res.status(201).json(hospital);
  } catch (err) {
    res.status(500).json({ error: "Failed to create hospital" });
  }
};

// ---------------------------------------------------------------------------
// POST /api/hospital/sync-osm — Trigger OSM hospital discovery for area
// ---------------------------------------------------------------------------
exports.syncFromOSM = async (req, res) => {
  try {
    const { lat, lng, radiusKm = 15 } = req.body;

    if (!lat || !lng) {
      return res.status(400).json({ error: "lat and lng required" });
    }

    logEvent("HOSPITAL_CTRL", `OSM sync triggered for (${lat}, ${lng}) radius ${radiusKm}km`);

    const synced = await discoverAndSyncHospitals(parseFloat(lat), parseFloat(lng), parseFloat(radiusKm) * 1000);

    res.json({
      message: `Synced ${synced.length} hospitals from OpenStreetMap`,
      count: synced.length,
      hospitals: synced.map((h) => ({
        hospitalId: h.hospitalId,
        name: h.name,
        lat: h.lat,
        lng: h.lng,
        source: h.source,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to sync from OSM" });
  }
};

// ---------------------------------------------------------------------------
// DELETE /api/hospital/:hospitalId — Remove hospital (admin)
// ---------------------------------------------------------------------------
exports.deleteHospital = async (req, res) => {
  try {
    const { hospitalId } = req.params;
    const result = await Hospital.deleteOne({ hospitalId });
    if (result.deletedCount === 0) return res.status(404).json({ error: "Hospital not found" });
    logEvent("HOSPITAL_CTRL", `Deleted hospital: ${hospitalId}`);
    res.json({ message: `Hospital ${hospitalId} deleted` });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete hospital" });
  }
};