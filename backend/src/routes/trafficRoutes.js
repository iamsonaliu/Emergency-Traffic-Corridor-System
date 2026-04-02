const express = require("express");
const router = express.Router();
const {
  getAllCorridors,
  getCorridorState,
  overrideSignal,
  updateAmbulancePosition,
  clearCorridorManually,
} = require("../controllers/trafficController");

// All active green corridors
router.get("/corridors", getAllCorridors);

// Single corridor state + signal list
router.get("/corridor/:routeId", getCorridorState);

// Manual signal override (Phase 1 - rule-based)
router.post("/signal/override", overrideSignal);

// Update ambulance's current signal position
router.post("/ambulance-position", updateAmbulancePosition);

// Force-clear a corridor
router.delete("/corridor/:routeId", clearCorridorManually);

module.exports = router;