const { logEvent } = require("../utils/auditLogger");

/**
 * Traffic Service — Green Corridor Management
 *
 * Responsibilities:
 *  - Receive route signal sequence from routeService
 *  - Activate signals sequentially based on ambulance ETA
 *  - Emit real-time signal state updates via WebSocket
 *  - Restore normal signal operation after ambulance passes
 *
 * Signal States:
 *  - "normal"    → Regular traffic cycle (default)
 *  - "preparing" → About to turn green (30s buffer)
 *  - "green"     → Cleared for ambulance
 *  - "restored"  → Ambulance passed, back to normal
 */

// In-memory store for active corridors (keyed by routeId)
const activeCorridors = new Map();

const PREP_BUFFER_MS = 30 * 1000; // 30 seconds before ETA to prepare signal

// ---------------------------------------------------------------------------
// Initialize Corridor
// ---------------------------------------------------------------------------

/**
 * Set up the green corridor for a given route.
 * Schedules signal activation timers based on ETA timestamps.
 *
 * @param {Object} routeResult  - Output from routeService.computeRoute()
 * @param {Object} io           - Socket.IO server instance
 */
function initCorridor(routeResult, io) {
  const { routeId, signals } = routeResult;

  logEvent("TRAFFIC_SERVICE", `Initializing green corridor for route ${routeId} | ${signals.length} signals`);

  const corridorState = {
    routeId,
    signals: signals.map((s) => ({ ...s, status: "normal" })),
    passedCount: 0,
    timers: [],
  };

  activeCorridors.set(routeId, corridorState);

  // Schedule each signal
  signals.forEach((signal, index) => {
    const etaMs = new Date(signal.etaTimestamp).getTime();
    const now = Date.now();

    const prepTime = etaMs - PREP_BUFFER_MS - now;
    const activateTime = etaMs - now;
    const restoreTime = etaMs + 30 * 1000 - now; // 30s after ambulance passes

    // Prepare (30s before)
    if (prepTime > 0) {
      const prepTimer = setTimeout(() => {
        updateSignalStatus(routeId, signal.signalId, "preparing", io);
      }, prepTime);
      corridorState.timers.push(prepTimer);
    }

    // Activate (at ETA)
    if (activateTime > 0) {
      const activateTimer = setTimeout(() => {
        updateSignalStatus(routeId, signal.signalId, "green", io);
      }, activateTime);
      corridorState.timers.push(activateTimer);
    }

    // Restore (30s after ETA)
    const restoreTimer = setTimeout(() => {
      updateSignalStatus(routeId, signal.signalId, "restored", io);
      corridorState.passedCount = index + 1;

      emitCorridorProgress(routeId, corridorState, io);

      // If last signal restored → corridor complete
      if (index === signals.length - 1) {
        logEvent("TRAFFIC_SERVICE", `Corridor ${routeId} fully completed — all signals restored`);
        emitCorridorComplete(routeId, io);
        clearCorridor(routeId);
      }
    }, restoreTime > 0 ? restoreTime : 5000);
    corridorState.timers.push(restoreTimer);
  });

  // Emit initial corridor state
  if (io) {
    io.emit("corridor_initialized", {
      routeId,
      signals: corridorState.signals,
      timestamp: new Date().toISOString(),
    });
  }

  logEvent("TRAFFIC_SERVICE", `Corridor ${routeId} initialized — timers scheduled`);
  return corridorState;
}

// ---------------------------------------------------------------------------
// Signal State Update
// ---------------------------------------------------------------------------

function updateSignalStatus(routeId, signalId, newStatus, io) {
  const corridor = activeCorridors.get(routeId);
  if (!corridor) return;

  const signal = corridor.signals.find((s) => s.signalId === signalId);
  if (!signal) return;

  signal.status = newStatus;

  logEvent(
    "TRAFFIC_SERVICE",
    `Signal ${signalId} on route ${routeId} → ${newStatus.toUpperCase()}`
  );

  if (io) {
    io.emit("signal_update", {
      routeId,
      signalId,
      status: newStatus,
      timestamp: new Date().toISOString(),
    });
  }
}

// ---------------------------------------------------------------------------
// Manual Override (Phase 1 - Rule-based)
// ---------------------------------------------------------------------------

/**
 * Manually override a specific signal's state.
 * Used by traffic control operators.
 */
function manualOverrideSignal(routeId, signalId, newStatus, io) {
  logEvent("TRAFFIC_SERVICE", `MANUAL OVERRIDE: Signal ${signalId} on route ${routeId} → ${newStatus}`);
  updateSignalStatus(routeId, signalId, newStatus, io);
  return getCorridorState(routeId);
}

// ---------------------------------------------------------------------------
// Ambulance Position Update
// ---------------------------------------------------------------------------

/**
 * Called when ambulance reports its current GPS position.
 * Marks signals behind ambulance as restored.
 */
function updateAmbulancePosition(routeId, currentSignalIndex, io) {
  const corridor = activeCorridors.get(routeId);
  if (!corridor) return;

  corridor.passedCount = currentSignalIndex;

  // Restore all signals before current position
  for (let i = 0; i < currentSignalIndex; i++) {
    const s = corridor.signals[i];
    if (s.status !== "restored") {
      updateSignalStatus(routeId, s.signalId, "restored", io);
    }
  }

  emitCorridorProgress(routeId, corridor, io);
}

// ---------------------------------------------------------------------------
// Corridor State
// ---------------------------------------------------------------------------

function getCorridorState(routeId) {
  const corridor = activeCorridors.get(routeId);
  if (!corridor) return null;
  return {
    routeId: corridor.routeId,
    signals: corridor.signals,
    passedCount: corridor.passedCount,
    totalSignals: corridor.signals.length,
    progress: `Ambulance passed signal ${corridor.passedCount}/${corridor.signals.length}`,
  };
}

function getAllActiveCorridors() {
  const result = [];
  for (const [routeId, corridor] of activeCorridors.entries()) {
    result.push(getCorridorState(routeId));
  }
  return result;
}

// ---------------------------------------------------------------------------
// Reroute — Clear old corridor, init new
// ---------------------------------------------------------------------------

function rerouteCorridor(oldRouteId, newRouteResult, io) {
  logEvent("TRAFFIC_SERVICE", `REROUTE: Clearing corridor ${oldRouteId}, starting new route ${newRouteResult.routeId}`);
  clearCorridor(oldRouteId);

  if (io) {
    io.emit("corridor_cancelled", { routeId: oldRouteId, timestamp: new Date().toISOString() });
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
// Socket Emitters
// ---------------------------------------------------------------------------

function emitCorridorProgress(routeId, corridor, io) {
  if (!io) return;
  io.emit("corridor_progress", {
    routeId,
    passedCount: corridor.passedCount,
    totalSignals: corridor.signals.length,
    progress: `Ambulance passed signal ${corridor.passedCount}/${corridor.signals.length}`,
    timestamp: new Date().toISOString(),
  });
}

function emitCorridorComplete(routeId, io) {
  if (!io) return;
  io.emit("corridor_complete", {
    routeId,
    message: "Green corridor completed. All signals restored to normal.",
    timestamp: new Date().toISOString(),
  });
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
};