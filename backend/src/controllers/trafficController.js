const {
  getCorridorState,
  getAllActiveCorridors,
  manualOverrideSignal,
  updateAmbulancePosition,
  clearCorridor,
} = require("../services/trafficService");
const Corridor = require("../models/Corridor");
const { logEvent } = require("../utils/auditLogger");

// ---------------------------------------------------------------------------
// GET /api/traffic/corridors — All active corridors
// ---------------------------------------------------------------------------
exports.getAllCorridors = (req, res) => {
  const corridors = getAllActiveCorridors();
  res.json({
    activeCorridors: corridors.length,
    corridors,
    timestamp: new Date().toISOString(),
  });
};

// ---------------------------------------------------------------------------
// GET /api/traffic/corridor/:routeId — Single corridor state
// ---------------------------------------------------------------------------
exports.getCorridorState = async (req, res) => {
  const { routeId } = req.params;

  // Try in-memory first
  let state = getCorridorState(routeId);

  // Fallback to DB if not in memory
  if (!state) {
    const dbCorridor = await Corridor.findOne({ routeId }).lean().catch(() => null);
    if (!dbCorridor) {
      return res.status(404).json({ error: "Corridor not found" });
    }
    state = {
      routeId: dbCorridor.routeId,
      emergencyId: dbCorridor.emergencyId,
      signals: dbCorridor.signals,
      passedCount: dbCorridor.passedCount,
      totalSignals: dbCorridor.totalSignals,
      progress: `${dbCorridor.passedCount}/${dbCorridor.totalSignals}`,
      state: dbCorridor.state,
    };
  }

  res.json({
    ...state,
    timestamp: new Date().toISOString(),
  });
};

// ---------------------------------------------------------------------------
// GET /api/traffic/history — Past corridors from DB
// ---------------------------------------------------------------------------
exports.getCorridorHistory = async (req, res) => {
  try {
    const { limit = 20, state } = req.query;
    const filter = state ? { state } : {};

    const corridors = await Corridor.find(filter)
      .sort({ startedAt: -1 })
      .limit(parseInt(limit))
      .select("-overrides")
      .lean();

    res.json(corridors);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch corridor history" });
  }
};

// ---------------------------------------------------------------------------
// POST /api/traffic/signal/override — Manual override
// ---------------------------------------------------------------------------
exports.overrideSignal = async (req, res) => {
  const { routeId, signalId, status, operator = "OPERATOR" } = req.body;

  const validStatuses = ["green", "normal", "preparing", "restored", "pending"];
  if (!routeId || !signalId || !validStatuses.includes(status)) {
    return res.status(400).json({
      error: `routeId, signalId, and status (${validStatuses.join(" | ")}) required`,
    });
  }

  const io = req.app.get("io");
  const updatedCorridor = await manualOverrideSignal(routeId, signalId, status, io, operator);

  if (!updatedCorridor) {
    return res.status(404).json({ error: "Corridor or signal not found" });
  }

  logEvent("TRAFFIC_CTRL", `Manual override: ${signalId} → ${status} on route ${routeId} by ${operator}`);

  res.json({
    message: `Signal ${signalId} set to ${status.toUpperCase()}`,
    routeId,
    signalId,
    newStatus: status,
    corridor: updatedCorridor,
  });
};

// ---------------------------------------------------------------------------
// POST /api/traffic/ambulance-position — Position update from ambulance
// ---------------------------------------------------------------------------
exports.updateAmbulancePosition = (req, res) => {
  const { routeId, currentSignalIndex } = req.body;

  if (!routeId || currentSignalIndex === undefined) {
    return res.status(400).json({ error: "routeId and currentSignalIndex required" });
  }

  const io = req.app.get("io");
  updateAmbulancePosition(routeId, currentSignalIndex, io);

  const state = getCorridorState(routeId);
  res.json({
    message: `Ambulance at signal ${currentSignalIndex}`,
    progress: state ? state.progress : "Corridor not active",
    timestamp: new Date().toISOString(),
  });
};

// ---------------------------------------------------------------------------
// DELETE /api/traffic/corridor/:routeId — Force-clear corridor
// ---------------------------------------------------------------------------
exports.clearCorridorManually = async (req, res) => {
  const { routeId } = req.params;

  const state = getCorridorState(routeId);
  if (!state) {
    // Still try to update DB
    await Corridor.updateOne({ routeId }, { $set: { state: "cancelled" } }).catch(() => {});
    return res.status(404).json({ error: "Corridor not active in memory" });
  }

  clearCorridor(routeId);
  await Corridor.updateOne({ routeId }, { $set: { state: "cancelled", completedAt: new Date() } }).catch(() => {});

  const io = req.app.get("io");
  if (io) {
    io.emit("corridor_force_cleared", {
      routeId,
      message: "Corridor manually cleared by operator",
      timestamp: new Date().toISOString(),
    });
  }

  logEvent("TRAFFIC_CTRL", `Corridor ${routeId} force-cleared`);
  res.json({ message: `Corridor ${routeId} cleared`, routeId });
};

// ---------------------------------------------------------------------------
// GET /api/traffic/stats — Summary stats
// ---------------------------------------------------------------------------
exports.getStats = async (req, res) => {
  try {
    const [total, active, completed, cancelled] = await Promise.all([
      Corridor.countDocuments(),
      Corridor.countDocuments({ state: "active" }),
      Corridor.countDocuments({ state: "completed" }),
      Corridor.countDocuments({ state: "cancelled" }),
    ]);

    const avgSignals = await Corridor.aggregate([
      { $group: { _id: null, avg: { $avg: "$totalSignals" } } },
    ]);

    res.json({
      total,
      active,
      completed,
      cancelled,
      avgSignalsPerCorridor: avgSignals[0]?.avg?.toFixed(1) || 0,
      inMemory: getAllActiveCorridors().length,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch stats" });
  }
};