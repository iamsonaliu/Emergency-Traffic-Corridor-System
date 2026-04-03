const mongoose = require("mongoose");

// Pending ambulance request sub-doc
const PendingRequestSchema = new mongoose.Schema(
  {
    ambulanceId: { type: String, required: true },
    emergencyId: { type: String },
    eta: { type: Number },                // minutes
    emergencyType: { type: String },
    requestedAt: { type: Date, default: Date.now },
    respondedAt: { type: Date },
    responseStatus: {
      type: String,
      enum: ["pending", "accepted", "rejected", "timeout"],
      default: "pending",
    },
  },
  { _id: true }
);

const HospitalSchema = new mongoose.Schema(
  {
    hospitalId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    name: { type: String, required: true, trim: true },
    address: { type: String, required: true },

    // GeoJSON Point for geospatial indexing
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
      },
    },

    // Flat lat/lng for quick Haversine (mirrors GeoJSON coordinates)
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },

    // Bed tracking
    emergencyBeds: {
      total: { type: Number, default: 0, min: 0 },
      available: { type: Number, default: 0, min: 0 },
      reserved: { type: Number, default: 0, min: 0 },
    },

    status: {
      type: String,
      enum: ["available", "full", "no_response", "offline"],
      default: "available",
      index: true,
    },

    // Capabilities
    specialties: {
      type: [String],
      default: ["General Emergency"],
    },
    traumaLevel: {
      type: String,
      enum: ["Level 1", "Level 2", "Level 3", "None"],
      default: "Level 2",
    },
    hasICU: { type: Boolean, default: true },
    hasBloodBank: { type: Boolean, default: false },

    contactNumber: { type: String },
    contactEmail: { type: String },

    // Source of data
    source: {
      type: String,
      enum: ["manual", "osm", "seed"],
      default: "manual",
    },
    osmId: { type: String },  // OpenStreetMap node ID

    // Incoming ambulance requests
    pendingRequests: { type: [PendingRequestSchema], default: [] },

    // Stats
    totalEmergenciesHandled: { type: Number, default: 0 },
    lastUpdated: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// 2dsphere index for geospatial queries
HospitalSchema.index({ location: "2dsphere" });
HospitalSchema.index({ "emergencyBeds.available": 1 });

// Pre-save: keep status in sync with bed count
HospitalSchema.pre("save", function (next) {
  if (this.emergencyBeds.available > 0) {
    if (this.status !== "offline" && this.status !== "no_response") {
      this.status = "available";
    }
  } else {
    if (this.status === "available") {
      this.status = "full";
    }
  }
  this.lastUpdated = new Date();
  next();
});

// Reserve a bed (atomic)
HospitalSchema.methods.reserveBed = async function (ambulanceId, emergencyId) {
  if (this.emergencyBeds.available < 1) return false;

  this.emergencyBeds.available -= 1;
  this.emergencyBeds.reserved += 1;
  if (this.emergencyBeds.available === 0) this.status = "full";

  // Mark request as accepted
  const req = this.pendingRequests.find(
    (r) => r.ambulanceId === ambulanceId && r.responseStatus === "pending"
  );
  if (req) {
    req.responseStatus = "accepted";
    req.respondedAt = new Date();
  }

  this.totalEmergenciesHandled += 1;
  await this.save();
  return true;
};

// Release a bed when ambulance departs or session ends
HospitalSchema.methods.releaseBed = async function () {
  if (this.emergencyBeds.reserved > 0) {
    this.emergencyBeds.reserved -= 1;
  }
  if (this.emergencyBeds.available < this.emergencyBeds.total) {
    this.emergencyBeds.available += 1;
  }
  if (this.emergencyBeds.available > 0 && this.status === "full") {
    this.status = "available";
  }
  await this.save();
};

// Add a pending request
HospitalSchema.methods.addRequest = async function (ambulanceId, emergencyId, eta, emergencyType) {
  // Avoid duplicates
  const existing = this.pendingRequests.find(
    (r) => r.ambulanceId === ambulanceId && r.responseStatus === "pending"
  );
  if (existing) return this;

  this.pendingRequests.push({ ambulanceId, emergencyId, eta, emergencyType });
  await this.save();
  return this;
};

module.exports = mongoose.model("Hospital", HospitalSchema);