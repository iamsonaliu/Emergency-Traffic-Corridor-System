const mongoose = require("mongoose");

// GPS point sub-schema
const GpsSchema = new mongoose.Schema(
  {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    accuracy: { type: Number, default: 0 },
    heading: { type: Number, default: 0 },   // degrees 0-360
    speed: { type: Number, default: 0 },     // km/h
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

// Active session sub-schema (cleared after emergency ends)
const ActiveSessionSchema = new mongoose.Schema(
  {
    emergencyId: { type: String },
    gps: { type: GpsSchema },
    emergencyType: { type: String, default: "general" },
    assignedHospitalId: { type: String },
    routeId: { type: String },
    eta: { type: Number },                    // minutes remaining
    distanceRemaining: { type: Number },      // km
    currentSignalIndex: { type: Number, default: 0 },
    dispatchTime: { type: Date },
    arrivedAt: { type: Date },

    // Live route polyline (GeoJSON LineString)
    routePolyline: {
      type: { type: String, enum: ["LineString"], default: "LineString" },
      coordinates: { type: [[Number]], default: [] }, // [[lng, lat], ...]
    },
  },
  { _id: false }
);

// GPS history (capped for performance)
const GpsHistorySchema = new mongoose.Schema(
  {
    lat: Number,
    lng: Number,
    speed: Number,
    heading: Number,
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const AmbulanceSchema = new mongoose.Schema(
  {
    ambulanceId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    driverName: { type: String, trim: true, default: "Unknown Driver" },
    contactNumber: { type: String },
    vehicleNumber: { type: String, trim: true },

    status: {
      type: String,
      enum: ["idle", "active", "maintenance"],
      default: "idle",
      index: true,
    },

    // Last known position (even when idle)
    lastKnownGps: { type: GpsSchema },

    // Session data — exists only during active emergency
    activeSession: { type: ActiveSessionSchema, default: null },

    // Rolling GPS history (last 200 points)
    gpsHistory: {
      type: [GpsHistorySchema],
      default: [],
      validate: [(arr) => arr.length <= 200, "GPS history exceeds 200 points"],
    },

    // Metadata
    registeredAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Indexes
AmbulanceSchema.index({ "lastKnownGps.lat": 1, "lastKnownGps.lng": 1 });

// Push GPS point to history (keep last 200)
AmbulanceSchema.methods.pushGpsHistory = async function (gpsPoint) {
  this.gpsHistory.push(gpsPoint);
  if (this.gpsHistory.length > 200) {
    this.gpsHistory = this.gpsHistory.slice(-200);
  }
  this.lastKnownGps = gpsPoint;
  this.lastSeenAt = new Date();
  await this.save();
};

// Clear session on emergency end
AmbulanceSchema.methods.clearSession = async function () {
  this.activeSession = null;
  this.status = "idle";
  this.lastSeenAt = new Date();
  await this.save();
};

module.exports = mongoose.model("Ambulance", AmbulanceSchema);