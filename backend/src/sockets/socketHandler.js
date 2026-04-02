const { logEvent } = require("../utils/auditLogger");

/**
 * Socket Handler — Real-Time Sync Layer
 *
 * Manages WebSocket connections for all four entities:
 *  1. Ambulance Driver App
 *  2. Control Department Dashboard
 *  3. Hospital Portal
 *  4. Traffic Control System
 *
 * All updates must propagate within 2 seconds (per cross-system rules).
 *
 * Socket Events (Server → Clients):
 *  - emergency_dispatched      → All entities notified of new emergency
 *  - ambulance_location_update → Live GPS broadcast
 *  - signal_update             → Individual signal state change
 *  - corridor_initialized      → New green corridor ready
 *  - corridor_progress         → Ambulance passed N/total signals
 *  - corridor_complete         → All signals restored
 *  - corridor_cancelled        → Corridor cleared (reroute)
 *  - hospital_accepted         → Hospital confirmed bed reservation
 *  - hospital_rejected         → Hospital rejected request
 *  - hospital_beds_updated     → Bed count changed
 *  - ambulance_rerouted        → New route after failover
 *  - emergency_ended           → Session complete, data cleared
 *  - corridor_force_cleared    → Operator manually cleared corridor
 *
 * Socket Events (Clients → Server):
 *  - join_room                 → Entity registers to its room
 *  - ambulance_gps             → Ambulance pushes GPS update
 *  - hospital_response         → Hospital accepts/rejects via socket
 *  - ping                      → Heartbeat
 */

const ROOMS = {
  AMBULANCE: "room:ambulance",
  CONTROL: "room:control",
  HOSPITAL: "room:hospital",
  TRAFFIC: "room:traffic",
};

module.exports = function initSocketHandler(io) {
  io.on("connection", (socket) => {
    const clientIp = socket.handshake.address;
    logEvent("SOCKET", `Client connected: ${socket.id} (${clientIp})`);

    // -------------------------------------------------------------------------
    // Room Registration
    // -------------------------------------------------------------------------

    socket.on("join_room", ({ entityType, entityId }) => {
      const validEntities = ["ambulance", "control", "hospital", "traffic"];
      if (!validEntities.includes(entityType)) {
        socket.emit("error", { message: "Invalid entity type" });
        return;
      }

      const room = `room:${entityType}`;
      socket.join(room);

      // Also join entity-specific room if ID provided
      if (entityId) {
        socket.join(`room:${entityType}:${entityId}`);
      }

      logEvent("SOCKET", `${socket.id} joined room: ${room}${entityId ? ` (${entityId})` : ""}`);

      socket.emit("joined", {
        room,
        entityId,
        message: `Connected to ${entityType} channel`,
        timestamp: new Date().toISOString(),
      });
    });

    // -------------------------------------------------------------------------
    // Ambulance → Live GPS Push
    // -------------------------------------------------------------------------

    socket.on("ambulance_gps", async ({ ambulanceId, lat, lng, currentSignalIndex, routeId }) => {
      if (!ambulanceId || lat === undefined || lng === undefined) return;

      // Broadcast to control + traffic rooms
      socket.to(ROOMS.CONTROL).emit("ambulance_location_update", {
        ambulanceId, lat, lng, routeId, currentSignalIndex,
        timestamp: new Date().toISOString(),
      });

      socket.to(ROOMS.TRAFFIC).emit("ambulance_location_update", {
        ambulanceId, lat, lng, routeId, currentSignalIndex,
        timestamp: new Date().toISOString(),
      });
    });

    // -------------------------------------------------------------------------
    // Hospital → Respond to request via socket (alternative to REST)
    // -------------------------------------------------------------------------

    socket.on("hospital_response", async ({ hospitalId, ambulanceId, action }) => {
      logEvent("SOCKET", `Hospital ${hospitalId} ${action}ed request from ambulance ${ambulanceId}`);

      // Notify ambulance and control
      const event = action === "accept" ? "hospital_accepted" : "hospital_rejected";
      io.to(ROOMS.AMBULANCE).emit(event, {
        hospitalId, ambulanceId,
        timestamp: new Date().toISOString(),
      });
      io.to(ROOMS.CONTROL).emit(event, {
        hospitalId, ambulanceId,
        timestamp: new Date().toISOString(),
      });
    });

    // -------------------------------------------------------------------------
    // Ping / Heartbeat
    // -------------------------------------------------------------------------

    socket.on("ping", () => {
      socket.emit("pong", { timestamp: new Date().toISOString() });
    });

    // -------------------------------------------------------------------------
    // Request current corridor state (on reconnect)
    // -------------------------------------------------------------------------

    socket.on("request_corridor_state", ({ routeId }) => {
      const { getCorridorState } = require("../services/trafficService");
      const state = getCorridorState(routeId);
      if (state) {
        socket.emit("corridor_state_sync", { ...state, timestamp: new Date().toISOString() });
      } else {
        socket.emit("corridor_state_sync", { error: "Corridor not found", routeId });
      }
    });

    // -------------------------------------------------------------------------
    // Disconnect
    // -------------------------------------------------------------------------

    socket.on("disconnect", (reason) => {
      logEvent("SOCKET", `Client disconnected: ${socket.id} — reason: ${reason}`);
    });

    socket.on("error", (err) => {
      logEvent("SOCKET", `Socket error on ${socket.id}: ${err.message}`);
    });
  });

  // Make rooms accessible globally if needed
  io.ROOMS = ROOMS;

  logEvent("SOCKET", "WebSocket handler initialized — all entity rooms ready");
};