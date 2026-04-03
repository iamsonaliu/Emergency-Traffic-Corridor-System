const mongoose = require("mongoose");

const SignalStateSchema = new mongoose.Schema(
  {
    signalId: { type: String, required: true },
    name: { type: String },
    lat: { type: Number },
    lng: { type: Number },
    status: {
      type: String,
      enum: ["pending", "preparing", "green", "restored", "skipped", "normal"],
      default: "pending",
    },
    etaMinutes: { type: Number },
    etaTimestamp: { type: Date },
    isSignal: { type: Boolean, default: true },
    manualOverride: { type: Boolean, default: false },
  },
  { _id: false }
);

const CorridorSchema = new mongoose.Schema(
  {
    routeId: { type: String, required: true, unique: true },
    emergencyId: { type: String, required: true, index: true },
    ambulanceId: { type: String, required: true },

    state: {
      type: String,
      enum: ["active", "completed", "cancelled", "rerouted"],
      default: "active",
      index: true,
    },

    signals: { type: [SignalStateSchema], default: [] },

    passedCount: { type: Number, default: 0 },
    totalSignals: { type: Number, default: 0 },

    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date },

    // Override log
    overrides: [
      {
        signalId: String,
        previousStatus: String,
        newStatus: String,
        operator: { type: String, default: "SYSTEM" },
        timestamp: { type: Date, default: Date.now },
        _id: false,
      },
    ],
  },
  { timestamps: true }
);


CorridorSchema.index({ startedAt: -1 });

module.exports = mongoose.model("Corridor", CorridorSchema);