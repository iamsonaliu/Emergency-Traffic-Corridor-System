const mongoose = require("mongoose");

// Individual signal state within a corridor
const SignalSchema = new mongoose.Schema(
  {
    signalId: { type: String, required: true },
    name: { type: String },
    lat: { type: Number },
    lng: { type: Number },
    status: {
      type: String,
      enum: ["pending", "preparing", "green", "restored", "skipped"],
      default: "pending",
    },
    etaMinutes: { type: Number },
    etaTimestamp: { type: Date },
    clearedAt: { type: Date },
    restoredAt: { type: Date },
    isSignal: { type: Boolean, default: true },
  },
  { _id: false }
);

// GPS snapshot for tracking
const GpsSnapshotSchema = new mongoose.Schema(
  {
    lat: Number,
    lng: Number,
    speed: Number,
    heading: Number,
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const EmergencySchema = new mongoose.Schema(
  {
    emergencyId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    ambulanceId: { type: String, required: true, index: true },
    emergencyType: {
      type: String,
      enum: ["cardiac", "trauma", "stroke", "respiratory", "general", "maternity", "pediatric"],
      default: "general",
    },

    status: {
      type: String,
      enum: ["triggered", "hospital_selection", "routing", "en_route", "arrived", "completed", "cancelled", "failed"],
      default: "triggered",
      index: true,
    },

    // Origin
    origin: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
      address: { type: String },
    },

    // Assigned hospital
    assignedHospital: {
      hospitalId: { type: String },
      name: { type: String },
      lat: { type: Number },
      lng: { type: Number },
      address: { type: String },
      etaMinutes: { type: Number },
      distanceKm: { type: Number },
    },

    // Alternative candidates (for display)
    hospitalCandidates: [
      {
        hospitalId: String,
        name: String,
        etaMinutes: Number,
        distanceKm: Number,
        availableBeds: Number,
        responseStatus: String,
        _id: false,
      },
    ],

    // Route data
    route: {
      routeId: { type: String },
      totalDistanceKm: { type: Number },
      totalTimeMinutes: { type: Number },
      // GeoJSON LineString for map rendering
      polyline: {
        type: { type: String, enum: ["LineString"] },
        coordinates: { type: [[Number]] }, // [[lng, lat], ...]
      },
      navigationSteps: [{ type: String }],
    },

    // Signal corridor
    corridor: {
      routeId: { type: String },
      signalCount: { type: Number, default: 0 },
      passedCount: { type: Number, default: 0 },
    },
    signals: { type: [SignalSchema], default: [] },

    // Live GPS tracking (snapshots during emergency)
    gpsTrack: { type: [GpsSnapshotSchema], default: [] },

    // Timestamps
    triggeredAt: { type: Date, default: Date.now },
    dispatchedAt: { type: Date },
    arrivedAt: { type: Date },
    completedAt: { type: Date },

    // Metrics
    actualTravelTimeMinutes: { type: Number },
    totalDistanceTravelledKm: { type: Number },

    // Notes / audit
    notes: [
      {
        timestamp: { type: Date, default: Date.now },
        message: { type: String },
        author: { type: String, default: "SYSTEM" },
        _id: false,
      },
    ],
  },
  { timestamps: true }
);

// Indexes
EmergencySchema.index({ emergencyId: 1 });
EmergencySchema.index({ ambulanceId: 1, status: 1 });
EmergencySchema.index({ triggeredAt: -1 });
EmergencySchema.index({ "assignedHospital.hospitalId": 1 });

// Add note helper
EmergencySchema.methods.addNote = async function (message, author = "SYSTEM") {
  this.notes.push({ message, author });
  await this.save();
};

// Push GPS snapshot (capped at 500)
EmergencySchema.methods.pushGpsSnapshot = async function (snap) {
  this.gpsTrack.push(snap);
  if (this.gpsTrack.length > 500) {
    this.gpsTrack = this.gpsTrack.slice(-500);
  }
  await this.save();
};

module.exports = mongoose.model("Emergency", EmergencySchema);