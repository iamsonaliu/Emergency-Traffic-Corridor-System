const Hospital = require("../models/Hospital");
const { logEvent } = require("../utils/auditLogger");

// ---------------------------------------------------------------------------
// GET /api/hospital — All hospitals (control dashboard)
// ---------------------------------------------------------------------------

exports.getAllHospitals = async (req, res) => {
  try {
    const hospitals = await Hospital.find({}, "-pendingRequests");
    res.json(hospitals);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch hospitals" });
  }
};

// ---------------------------------------------------------------------------
// GET /api/hospital/:hospitalId — Single hospital status
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
// GET /api/hospital/:hospitalId/requests — Pending ambulance requests (portal)
// ---------------------------------------------------------------------------

exports.getPendingRequests = async (req, res) => {
  try {
    const hospital = await Hospital.findOne({ hospitalId: req.params.hospitalId });
    if (!hospital) return res.status(404).json({ error: "Hospital not found" });

    const pending = hospital.pendingRequests.filter((r) => r.responseStatus === "pending");

    res.json({
      entity: "HOSPITAL_PORTAL",
      hospitalId: hospital.hospitalId,
      hospitalName: hospital.name,
      availableBeds: hospital.emergencyBeds.available,
      status: hospital.status,
      pendingRequests: pending.map((r) => ({
        ambulanceId: r.ambulanceId,
        eta: `${r.eta} min`,
        emergencyType: r.emergencyType,
        requestedAt: r.requestedAt,
        action: "ACCEPT or REJECT",
      })),
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch pending requests" });
  }
};

// ---------------------------------------------------------------------------
// POST /api/hospital/:hospitalId/respond — Accept or Reject a request
// Body: { ambulanceId, action: "accept" | "reject" }
// ---------------------------------------------------------------------------

exports.respondToRequest = async (req, res) => {
  try {
    const { hospitalId } = req.params;
    const { ambulanceId, action } = req.body;

    if (!ambulanceId || !["accept", "reject"].includes(action)) {
      return res.status(400).json({ error: "ambulanceId and action (accept/reject) are required" });
    }

    const hospital = await Hospital.findOne({ hospitalId });
    if (!hospital) return res.status(404).json({ error: "Hospital not found" });

    const request = hospital.pendingRequests.find(
      (r) => r.ambulanceId === ambulanceId && r.responseStatus === "pending"
    );

    if (!request) {
      return res.status(404).json({ error: "No pending request found for this ambulance" });
    }

    const io = req.app.get("io");

    if (action === "accept") {
      const reserved = await hospital.reserveBed(ambulanceId);
      if (!reserved) {
        return res.status(409).json({ error: "No beds available to reserve" });
      }

      logEvent("HOSPITAL_CONTROLLER", `Hospital "${hospital.name}" ACCEPTED request from ambulance ${ambulanceId}`);

      if (io) {
        io.emit("hospital_accepted", {
          hospitalId,
          hospitalName: hospital.name,
          ambulanceId,
          bedsRemaining: hospital.emergencyBeds.available,
          timestamp: new Date().toISOString(),
        });
      }

      return res.json({
        entity: "HOSPITAL_PORTAL",
        status: "accepted",
        message: `Bed reserved for ambulance ${ambulanceId}`,
        bedsRemaining: hospital.emergencyBeds.available,
        hospitalStatus: hospital.status,
      });
    }

    // Reject
    request.responseStatus = "rejected";
    await hospital.save();

    logEvent("HOSPITAL_CONTROLLER", `Hospital "${hospital.name}" REJECTED request from ambulance ${ambulanceId}`);

    if (io) {
      io.emit("hospital_rejected", {
        hospitalId,
        ambulanceId,
        timestamp: new Date().toISOString(),
      });
    }

    return res.json({
      entity: "HOSPITAL_PORTAL",
      status: "rejected",
      message: `Request from ambulance ${ambulanceId} rejected`,
    });
  } catch (err) {
    console.error("[HOSPITAL RESPOND ERROR]", err);
    res.status(500).json({ error: "Failed to process response" });
  }
};

// ---------------------------------------------------------------------------
// PUT /api/hospital/:hospitalId/beds — Update bed count (admin/portal)
// Body: { available, total }
// ---------------------------------------------------------------------------

exports.updateBeds = async (req, res) => {
  try {
    const { hospitalId } = req.params;
    const { available, total } = req.body;

    const hospital = await Hospital.findOne({ hospitalId });
    if (!hospital) return res.status(404).json({ error: "Hospital not found" });

    if (total !== undefined) hospital.emergencyBeds.total = total;
    if (available !== undefined) {
      hospital.emergencyBeds.available = available;
      hospital.status = available >= 1 ? "available" : "full";
    }

    await hospital.save();

    logEvent("HOSPITAL_CONTROLLER", `Beds updated for "${hospital.name}": available=${hospital.emergencyBeds.available}, total=${hospital.emergencyBeds.total}`);

    const io = req.app.get("io");
    if (io) {
      io.emit("hospital_beds_updated", {
        hospitalId,
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
    const { hospitalId, name, address, lat, lng, totalBeds, contactNumber } = req.body;

    if (!hospitalId || !name || !address || lat === undefined || lng === undefined) {
      return res.status(400).json({ error: "hospitalId, name, address, lat, lng are required" });
    }

    const existing = await Hospital.findOne({ hospitalId });
    if (existing) return res.status(409).json({ error: "Hospital already exists" });

    const hospital = await Hospital.create({
      hospitalId,
      name,
      address,
      location: { lat, lng },
      emergencyBeds: { total: totalBeds || 0, available: totalBeds || 0 },
      contactNumber,
      status: totalBeds > 0 ? "available" : "full",
    });

    logEvent("HOSPITAL_CONTROLLER", `New hospital registered: "${name}" (${hospitalId})`);
    res.status(201).json(hospital);
  } catch (err) {
    res.status(500).json({ error: "Failed to create hospital" });
  }
};