const Corridor = require("../models/Corridor");
const { logEvent } = require("../utils/auditLogger");
const { SIGNAL_PREP_BUFFER_SECONDS, SIGNAL_RESTORE_DELAY_SECONDS } = require("../config/constants");

// ---------------------------------------------------------------------------
// In-memory corridor map (fast lookups)
// Synced with DB on init/restore
// ---------------------------------------------------------------------------
const activeCorridors = new Map(); // routeId → corridorState

// ---------------------------------------------------------------------------
// Initialize Green Corridor
// ---------------------------------------------------------------------------
async function initCorridor(routeResult, io) {
  const { routeId, signals, totalTimeMinutes } = routeResult;

  logEvent("TRAFFIC_SERVICE", `Initializing corridor ${routeId} with ${signals.length} signals`);

  // Persist to DB
  let dbCorridor = await Corridor.findOne({ routeId });
  if (!dbCorridor) {
    dbCorridor = await Corridor.create({
      routeId,
      emergencyId: routeResult.emergencyId || routeId,
      ambulanceId: routeResult.ambulanceId || "UNKNOWN",
      state: "active",
      signals: signals.map((s) => ({ ...s, status: "pending" })),
      totalSignals: signals.length,
      passedCount: 0,
    });
  }

  // In-memory state
  const corridorState = {
    routeId,
    emergencyId: routeResult.emergencyId,
    ambulanceId: routeResult.ambulanceId,
    signals: signals.map((s) => ({ ...s, status: "pending" })),
    passedCount: 0,
    timers: [],
    dbId: dbCorridor._id,
  };

  activeCorridors.set(routeId, corridorState);

  // Schedule signal state transitions
  signals.forEach((signal, index) => {
    const etaMs = new Date(signal.etaTimestamp).getTime();
    const now = Date.now();

    const prepMs = etaMs - SIGNAL_PREP_BUFFER_SECONDS * 1000 - now;
    const activateMs = etaMs - now;
    const restoreMs = etaMs + SIGNAL_RESTORE_DELAY_SECONDS * 1000 - now;

    // Preparing (30s before ETA)
    if (prepMs > 0) {
      corridorState.timers.push(
        setTimeout(() => updateSignalStatus(routeId, signal.signalId, "preparing", io), prepMs)
      );
    } else if (activateMs > 0) {
      // Already past prep time — go straight to green
      updateSignalStatus(routeId, signal.signalId, "preparing", io);
    }

    // Green (at ETA)
    if (activateMs > 0) {
      corridorState.timers.push(
        setTimeout(() => updateSignalStatus(routeId, signal.signalId, "green", io), activateMs)
      );
    } else if (restoreMs > 0) {
      // Already past green — restore immediately
      updateSignalStatus(routeId, signal.signalId, "green", io);
    }

    // Restore (30s after ETA)
    const restoreDelay = restoreMs > 0 ? restoreMs : 5000;
    corridorState.timers.push(
      setTimeout(async () => {
        updateSignalStatus(routeId, signal.signalId, "restored", io);
        corridorState.passedCount = index + 1;

        // Update DB progress
        await Corridor.updateOne(
          { routeId },
          { $set: { passedCount: index + 1 } }
        );

        emitCorridorProgress(routeId, corridorState, io);

        // Corridor complete when all signals restored
        if (index === signals.length - 1) {
          logEvent("TRAFFIC_SERVICE", `Corridor ${routeId} COMPLETE`);
          await Corridor.updateOne(
            { routeId },
            { $set: { state: "completed", completedAt: new Date() } }
          );
          emitCorridorComplete(routeId, io);
          clearCorridor(routeId);
        }
      }, restoreDelay)
    );
  });

  // Broadcast initial state
  if (io) {
    io.emit("corridor_initialized", {
      routeId,
      emergencyId: routeResult.emergencyId,
      signals: corridorState.signals,
      totalSignals: signals.length,
      timestamp: new Date().toISOString(),
    });
  }

  logEvent("TRAFFIC_SERVICE", `Corridor ${routeId} initialized — ${signals.length} signal timers scheduled`);
  return corridorState;
}

// ---------------------------------------------------------------------------
// Update a single signal's status
// ---------------------------------------------------------------------------
function updateSignalStatus(routeId, signalId, newStatus, io) {
  const corridor = activeCorridors.get(routeId);
  if (!corridor) return;

  const signal = corridor.signals.find((s) => s.signalId === signalId);
  if (!signal) return;

  const prevStatus = signal.status;
  signal.status = newStatus;

  // Timestamps
  if (newStatus === "green") signal.clearedAt = new Date().toISOString();
  if (newStatus === "restored") signal.restoredAt = new Date().toISOString();

  logEvent("TRAFFIC_SERVICE", `Signal ${signalId} on ${routeId}: ${prevStatus} → ${newStatus}`);

  // Persist to DB (non-blocking)
  Corridor.updateOne(
    { routeId, "signals.signalId": signalId },
    { $set: { "signals.$.status": newStatus } }
  ).catch(() => {});

  if (io) {
    io.emit("signal_update", {
      routeId,
      signalId,
      status: newStatus,
      lat: signal.lat,
      lng: signal.lng,
      name: signal.name,
      timestamp: new Date().toISOString(),
    });
  }
}

// ---------------------------------------------------------------------------
// Manual operator override
// ---------------------------------------------------------------------------
async function manualOverrideSignal(routeId, signalId, newStatus, io, operator = "OPERATOR") {
  logEvent("TRAFFIC_SERVICE", `MANUAL OVERRIDE: ${signalId} → ${newStatus} by ${operator}`);

  const corridor = activeCorridors.get(routeId);
  if (!corridor) return null;

  const signal = corridor.signals.find((s) => s.signalId === signalId);
  const prevStatus = signal?.status || "unknown";

  updateSignalStatus(routeId, signalId, newStatus, io);

  // Log override in DB
  await Corridor.updateOne(
    { routeId },
    {
      $push: {
        overrides: {
          signalId,
          previousStatus: prevStatus,
          newStatus,
          operator,
          timestamp: new Date(),
        },
      },
    }
  ).catch(() => {});

  return getCorridorState(routeId);
}

// ---------------------------------------------------------------------------
// Update ambulance position (advance corridor)
// ---------------------------------------------------------------------------
async function updateAmbulancePosition(routeId, currentSignalIndex, io) {
  const corridor = activeCorridors.get(routeId);
  if (!corridor) return;

  corridor.passedCount = currentSignalIndex;

  // Restore all signals before current index
  for (let i = 0; i < currentSignalIndex && i < corridor.signals.length; i++) {
    if (corridor.signals[i].status !== "restored") {
      updateSignalStatus(routeId, corridor.signals[i].signalId, "restored", io);
    }
  }

  // Update DB
  await Corridor.updateOne({ routeId }, { $set: { passedCount: currentSignalIndex } }).catch(() => {});

  emitCorridorProgress(routeId, corridor, io);
}

// ---------------------------------------------------------------------------
// Corridor state queries
// ---------------------------------------------------------------------------
function getCorridorState(routeId) {
  const corridor = activeCorridors.get(routeId);
  if (!corridor) return null;

  return {
    routeId: corridor.routeId,
    emergencyId: corridor.emergencyId,
    ambulanceId: corridor.ambulanceId,
    signals: corridor.signals,
    passedCount: corridor.passedCount,
    totalSignals: corridor.signals.length,
    progress: `${corridor.passedCount}/${corridor.signals.length}`,
  };
}

function getAllActiveCorridors() {
  const result = [];
  for (const [routeId] of activeCorridors) {
    const state = getCorridorState(routeId);
    if (state) result.push(state);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Reroute — cancel old corridor, start new
// ---------------------------------------------------------------------------
async function rerouteCorridor(oldRouteId, newRouteResult, io) {
  logEvent("TRAFFIC_SERVICE", `REROUTE: clearing ${oldRouteId}, starting ${newRouteResult.routeId}`);

  clearCorridor(oldRouteId);
  await Corridor.updateOne({ routeId: oldRouteId }, { $set: { state: "rerouted" } }).catch(() => {});

  if (io) {
    io.emit("corridor_cancelled", {
      routeId: oldRouteId,
      reason: "reroute",
      timestamp: new Date().toISOString(),
    });
  }

  return initCorridor(newRouteResult, io);
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------
function clearCorridor(routeId) {
  const corridor = activeCorridors.get(routeId);
  if (!corridor) return;

  corridor.timers.forEach((t) => clearTimeout(t));
  activeCorridors.delete(routeId);
  logEvent("TRAFFIC_SERVICE", `Corridor ${routeId} cleared from memory`);
}

// ---------------------------------------------------------------------------
// Socket emitters
// ---------------------------------------------------------------------------
function emitCorridorProgress(routeId, corridor, io) {
  if (!io) return;
  io.emit("corridor_progress", {
    routeId,
    passedCount: corridor.passedCount,
    totalSignals: corridor.signals.length,
    progress: `${corridor.passedCount}/${corridor.signals.length}`,
    timestamp: new Date().toISOString(),
  });
}

function emitCorridorComplete(routeId, io) {
  if (!io) return;
  io.emit("corridor_complete", {
    routeId,
    message: "Green corridor completed — all signals restored",
    timestamp: new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// Restore in-memory corridors from DB on server restart
// ---------------------------------------------------------------------------
async function restoreActiveCorrridorsFromDB(io) {
  try {
    const active = await Corridor.find({ state: "active" });
    logEvent("TRAFFIC_SERVICE", `Restoring ${active.length} active corridors from DB`);

    for (const dbCorridor of active) {
      // Only restore if signals have future ETAs
      const hasFutureSignals = dbCorridor.signals.some(
        (s) => s.etaTimestamp && new Date(s.etaTimestamp) > new Date()
      );

      if (hasFutureSignals) {
        await initCorridor(
          {
            routeId: dbCorridor.routeId,
            emergencyId: dbCorridor.emergencyId,
            ambulanceId: dbCorridor.ambulanceId,
            signals: dbCorridor.signals,
            totalTimeMinutes: 30,
          },
          io
        );
      } else {
        // Mark as completed
        await Corridor.updateOne(
          { _id: dbCorridor._id },
          { $set: { state: "completed", completedAt: new Date() } }
        );
      }
    }
  } catch (err) {
    logEvent("TRAFFIC_SERVICE", `Failed to restore corridors: ${err.message}`);
  }
}

module.exports = {
  initCorridor,
  updateSignalStatus,
  manualOverrideSignal,
  updateAmbulancePosition,
  getCorridorState,
  getAllActiveCorridors,
  rerouteCorridor,
  clearCorridor,
  restoreActiveCorrridorsFromDB,
};