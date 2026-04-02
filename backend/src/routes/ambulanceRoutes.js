const express = require("express");
const router = express.Router();
const {
  triggerEmergency,
  updateLocation,
  triggerFailover,
  endSession,
  getStatus,
} = require("../controllers/ambulanceController");

// Emergency trigger
router.post("/trigger", triggerEmergency);

// Live GPS update
router.post("/update-location", updateLocation);

// Failover (hospital became unavailable)
router.post("/failover", triggerFailover);

// End session & clear data
router.post("/end-session", endSession);

// Get ambulance status
router.get("/:ambulanceId/status", getStatus);

module.exports = router;