const {
  getCorridorState,
  getAllActiveCorridors,
  manualOverrideSignal,
  updateAmbulancePosition,
  clearCorridor,
} = require("../services/trafficService");
const { logEvent } = require("../utils/auditLogger");

// ---------------------------------------------------------------------------
// GET /api/traffic/corridors — All active corridors (traffic control dashboard)
// ---------------------------------------------------------------------------

exports.getAllCorridors = (req, res) => {
  const corridors = getAllActiveCorridors();
  res.json({
    entity: "TRAFFIC_CONTROL",
    activeCorridors: corridors.length,
    corridors,
    timestamp: new Date().toISOString(),
  });
};

// ---------------------------------------------------------------------------
// GET /api/traffic/corridor/:routeId — Single corridor state
// ---------------------------------------------------------------------------

exports.getCorridorState = (req, res) => {
  const { routeId } = req.params;
  const state = getCorridorState(routeId);

  if (!state) {
    return res.status(404).json({ error: "Corridor not found or already completed" });
  }

  res.json({
    entity: "TRAFFIC_CONTROL",
    ...state,
    signals: state.signals.map((s) => ({
      signalId: s.signalId,
      name: s.name,
      status: s.status,
      etaMinutes: s.etaMinutes,
      etaTimestamp: s.etaTimestamp,
    })),
    timestamp: new Date().toISOString(),
  });
};

// ---------------------------------------------------------------------------
// POST /api/traffic/signal/override — Manual signal override (Phase 1)
// Body: { routeId, signalId, status: "green" | "normal" | "preparing" }
// ---------------------------------------------------------------------------

exports.overrideSignal = (req, res) => {
  const { routeId, signalId, status } = req.body;

  const validStatuses = ["green", "normal", "preparing", "restored"];
  if (!routeId || !signalId || !validStatuses.includes(status)) {
    return res.status(400).json({
      error: `routeId, signalId, and status (${validStatuses.join(" | ")}) are required`,
    });
  }

  const io = req.app.get("io");
  const updatedCorridor = manualOverrideSignal(routeId, signalId, status, io);

  if (!updatedCorridor) {
    return res.status(404).json({ error: "Corridor or signal not found" });
  }

  logEvent("TRAFFIC_CONTROLLER", `Manual override: Signal ${signalId} → ${status} on route ${routeId}`);

  res.json({
    entity: "TRAFFIC_CONTROL",
    message: `Signal ${signalId} manually set to ${status.toUpperCase()}`,
    routeId,
    signalId,
    newStatus: status,
    corridor: updatedCorridor,
  });
};

// ---------------------------------------------------------------------------
// POST /api/traffic/ambulance-position — Update ambulance position in corridor
// Body: { routeId, currentSignalIndex }
// ---------------------------------------------------------------------------

exports.updateAmbulancePosition = (req, res) => {
  const { routeId, currentSignalIndex } = req.body;

  if (!routeId || currentSignalIndex === undefined) {
    return res.status(400).json({ error: "routeId and currentSignalIndex are required" });
  }

  const io = req.app.get("io");
  updateAmbulancePosition(routeId, currentSignalIndex, io);

  const state = getCorridorState(routeId);

  res.json({
    entity: "TRAFFIC_CONTROL",
    message: `Position updated — ambulance at signal ${currentSignalIndex}`,
    progress: state ? state.progress : "Corridor not found",
    timestamp: new Date().toISOString(),
  });
};

// ---------------------------------------------------------------------------
// DELETE /api/traffic/corridor/:routeId — Force-clear a corridor (operator)
// ---------------------------------------------------------------------------

exports.clearCorridorManually = (req, res) => {
  const { routeId } = req.params;

  const state = getCorridorState(routeId);
  if (!state) {
    return res.status(404).json({ error: "Corridor not found" });
  }

  clearCorridor(routeId);

  const io = req.app.get("io");
  if (io) {
    io.emit("corridor_force_cleared", {
      routeId,
      message: "Corridor manually cleared by operator",
      timestamp: new Date().toISOString(),
    });
  }

  logEvent("TRAFFIC_CONTROLLER", `Corridor ${routeId} force-cleared by operator`);

  res.json({ message: `Corridor ${routeId} cleared`, routeId });
};