const mongoose = require("mongoose");

const ambulanceSchema = new mongoose.Schema(
  {
    ambulanceId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    driverName: {
      type: String,
      trim: true,
    },
    contactNumber: {
      type: String,
    },
    status: {
      type: String,
      enum: ["idle", "active", "completed"],
      default: "idle",
    },
    // Current active session (session-based, not persisted after emergency ends)
    activeSession: {
      gps: {
        lat: { type: Number },
        lng: { type: Number },
      },
      timestamp: { type: Date },
      emergencyType: { type: String },
      assignedHospitalId: { type: String },
      routeId: { type: String },
      eta: { type: Number }, // minutes
    },
  },
  { timestamps: true }
);

// Clear session data on completion
ambulanceSchema.methods.clearSession = async function () {
  this.activeSession = {};
  this.status = "idle";
  await this.save();
};

module.exports = mongoose.model("Ambulance", ambulanceSchema);