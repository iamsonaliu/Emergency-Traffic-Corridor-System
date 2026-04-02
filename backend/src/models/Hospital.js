const mongoose = require("mongoose");

const hospitalSchema = new mongoose.Schema(
  {
    hospitalId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      type: String,
      required: true,
    },
    location: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },
    emergencyBeds: {
      total: { type: Number, default: 0 },
      available: { type: Number, default: 0 },
    },
    status: {
      type: String,
      enum: ["available", "full", "no_response"],
      default: "available",
    },
    contactNumber: {
      type: String,
    },
    // Incoming ambulance requests
    pendingRequests: [
      {
        ambulanceId: String,
        eta: Number, // minutes
        emergencyType: String,
        requestedAt: { type: Date, default: Date.now },
        responseStatus: {
          type: String,
          enum: ["pending", "accepted", "rejected"],
          default: "pending",
        },
      },
    ],
  },
  { timestamps: true }
);

// Reserve a bed for incoming ambulance
hospitalSchema.methods.reserveBed = async function (ambulanceId) {
  if (this.emergencyBeds.available > 0) {
    this.emergencyBeds.available -= 1;
    if (this.emergencyBeds.available === 0) this.status = "full";
    const req = this.pendingRequests.find((r) => r.ambulanceId === ambulanceId);
    if (req) req.responseStatus = "accepted";
    await this.save();
    return true;
  }
  return false;
};

// Release a bed when ambulance session ends
hospitalSchema.methods.releaseBed = async function () {
  if (this.emergencyBeds.available < this.emergencyBeds.total) {
    this.emergencyBeds.available += 1;
    this.status = "available";
    await this.save();
  }
};

module.exports = mongoose.model("Hospital", hospitalSchema);