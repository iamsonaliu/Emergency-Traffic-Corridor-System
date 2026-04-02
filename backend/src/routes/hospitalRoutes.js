const express = require("express");
const router = express.Router();
const {
  getAllHospitals,
  getHospital,
  getPendingRequests,
  respondToRequest,
  updateBeds,
  createHospital,
} = require("../controllers/hospitalController");

// Admin — create hospital
router.post("/", createHospital);

// Control dashboard — all hospitals
router.get("/", getAllHospitals);

// Single hospital details
router.get("/:hospitalId", getHospital);

// Hospital portal — pending ambulance requests
router.get("/:hospitalId/requests", getPendingRequests);

// Hospital portal — accept or reject a request
router.post("/:hospitalId/respond", respondToRequest);

// Admin/Portal — update bed counts
router.put("/:hospitalId/beds", updateBeds);

module.exports = router;