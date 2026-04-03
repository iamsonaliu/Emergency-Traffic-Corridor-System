const express = require("express");
const router = express.Router();
const {
  triggerEmergency,
  updateLocation,
  triggerFailover,
  endSession,
  getStatus,
  getAllAmbulances,
  getActiveEmergencies,
} = require("../controllers/ambulanceController");

// Emergency trigger
router.post("/trigger", triggerEmergency);

// Get all ambulances
router.get("/", getAllAmbulances);

// Get active emergencies (ambulances)
router.get("/active", getActiveEmergencies);

// Live GPS update
router.post("/update-location", updateLocation);

// Failover (hospital became unavailable)
router.post("/failover", triggerFailover);

// End session & clear data
router.post("/end-session", endSession);

// Get ambulance status
router.get("/:ambulanceId/status", getStatus);

module.exports = router;