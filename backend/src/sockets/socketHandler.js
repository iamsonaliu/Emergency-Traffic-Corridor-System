const Ambulance = require("../models/Ambulance");
const Emergency = require("../models/Emergency");
const { getCorridorState } = require("../services/trafficService");
const { logEvent } = require("../utils/auditLogger");

const ROOMS = {
  AMBULANCE: "room:ambulance",
  CONTROL: "room:control",
  HOSPITAL: "room:hospital",
  TRAFFIC: "room:traffic",
};

// Connected clients registry: socketId → { entityType, entityId, room }
const connectedClients = new Map();

module.exports = function initSocketHandler(io) {

  io.on("connection", (socket) => {
    const clientIp = socket.handshake.address;
    logEvent("SOCKET", `Client connected: ${socket.id} (${clientIp})`);

    // -----------------------------------------------------------------------
    // ROOM REGISTRATION
    // join_room: { entityType: "ambulance"|"control"|"hospital"|"traffic", entityId: string }
    // -----------------------------------------------------------------------
    socket.on("join_room", ({ entityType, entityId }) => {
      const valid = ["ambulance", "control", "hospital", "traffic"];
      if (!valid.includes(entityType)) {
        socket.emit("error", { message: "Invalid entity type" });
        return;
      }

      const room = `room:${entityType}`;
      socket.join(room);

      // Entity-specific room (e.g. room:ambulance:ALPHA-ONE)
      if (entityId) {
        socket.join(`room:${entityType}:${entityId}`);
      }

      connectedClients.set(socket.id, { entityType, entityId, room });

      logEvent("SOCKET", `${socket.id} joined ${room}${entityId ? `:${entityId}` : ""}`);

      socket.emit("joined", {
        room,
        entityId,
        message: `Connected to ${entityType} channel`,
        timestamp: new Date().toISOString(),
      });

      // Send current active corridors to traffic/control clients
      if (entityType === "traffic" || entityType === "control") {
        const { getAllActiveCorridors } = require("../services/trafficService");
        const corridors = getAllActiveCorridors();
        socket.emit("corridors_sync", { corridors, timestamp: new Date().toISOString() });
      }
    });

    // -----------------------------------------------------------------------
    // GPS STREAM — Ambulance pushes live location
    // ambulance_gps: { ambulanceId, lat, lng, heading, speed, routeId, currentSignalIndex }
    // -----------------------------------------------------------------------
    socket.on("ambulance_gps", async ({ ambulanceId, lat, lng, heading = 0, speed = 0, routeId, currentSignalIndex }) => {
      if (!ambulanceId || lat === undefined || lng === undefined) return;

      const gpsPayload = {
        ambulanceId,
        lat,
        lng,
        heading,
        speed,
        routeId,
        currentSignalIndex,
        timestamp: new Date().toISOString(),
      };

      // Broadcast to control and traffic rooms
      socket.to(ROOMS.CONTROL).emit("ambulance_location_update", gpsPayload);
      socket.to(ROOMS.TRAFFIC).emit("ambulance_location_update", gpsPayload);

      // Persist GPS to DB (non-blocking)
      try {
        await Ambulance.updateOne(
          { ambulanceId },
          {
            $set: {
              lastKnownGps: { lat, lng, heading, speed, timestamp: new Date() },
              lastSeenAt: new Date(),
              "activeSession.gps": { lat, lng, heading, speed, timestamp: new Date() },
            },
            $push: {
              gpsHistory: {
                $each: [{ lat, lng, speed, heading, timestamp: new Date() }],
                $slice: -200,
              },
            },
          }
        );

        // Update corridor signal position
        if (routeId && currentSignalIndex !== undefined) {
          const { updateAmbulancePosition } = require("../services/trafficService");
          await updateAmbulancePosition(routeId, currentSignalIndex, io);
        }

        // Update emergency GPS track
        const ambulance = await Ambulance.findOne({ ambulanceId }, "activeSession").lean();
        if (ambulance?.activeSession?.emergencyId) {
          await Emergency.updateOne(
            { emergencyId: ambulance.activeSession.emergencyId },
            {
              $push: {
                gpsTrack: { $each: [{ lat, lng, speed, heading, timestamp: new Date() }], $slice: -500 },
              },
            }
          );
        }
      } catch (err) {
        logEvent("SOCKET", `GPS persist error for ${ambulanceId}: ${err.message}`);
      }
    });

    // -----------------------------------------------------------------------
    // HOSPITAL RESPONSE via socket (alternative to REST)
    // hospital_response: { hospitalId, ambulanceId, emergencyId, action: "accept"|"reject" }
    // -----------------------------------------------------------------------
    socket.on("hospital_response", async ({ hospitalId, ambulanceId, emergencyId, action }) => {
      logEvent("SOCKET", `Hospital ${hospitalId} ${action}ed request from ${ambulanceId}`);

      const Hospital = require("../models/Hospital");

      try {
        const hospital = await Hospital.findOne({ hospitalId });
        if (!hospital) return socket.emit("error", { message: "Hospital not found" });

        if (action === "accept") {
          const ok = await hospital.reserveBed(ambulanceId, emergencyId);
          if (!ok) {
            socket.emit("error", { message: "No beds available" });
            return;
          }
        } else {
          const req = hospital.pendingRequests.find(
            (r) => r.ambulanceId === ambulanceId && r.responseStatus === "pending"
          );
          if (req) {
            req.responseStatus = "rejected";
            req.respondedAt = new Date();
            await hospital.save();
          }
        }

        const event = action === "accept" ? "hospital_accepted" : "hospital_rejected";
        const payload = {
          hospitalId,
          hospitalName: hospital.name,
          ambulanceId,
          emergencyId,
          bedsRemaining: hospital.emergencyBeds.available,
          timestamp: new Date().toISOString(),
        };

        io.to(ROOMS.AMBULANCE).emit(event, payload);
        io.to(ROOMS.CONTROL).emit(event, payload);
        io.to(`room:ambulance:${ambulanceId}`).emit(event, payload);
      } catch (err) {
        logEvent("SOCKET", `hospital_response error: ${err.message}`);
      }
    });

    // -----------------------------------------------------------------------
    // REQUEST CORRIDOR STATE (on reconnect)
    // -----------------------------------------------------------------------
    socket.on("request_corridor_state", ({ routeId }) => {
      const state = getCorridorState(routeId);
      if (state) {
        socket.emit("corridor_state_sync", { ...state, timestamp: new Date().toISOString() });
      } else {
        socket.emit("corridor_state_sync", { error: "Corridor not found", routeId });
      }
    });

    // -----------------------------------------------------------------------
    // REQUEST EMERGENCY STATE (on reconnect)
    // -----------------------------------------------------------------------
    socket.on("request_emergency_state", async ({ emergencyId }) => {
      try {
        const emergency = await Emergency.findOne({ emergencyId }, "-gpsTrack").lean();
        if (emergency) {
          socket.emit("emergency_state_sync", { ...emergency, timestamp: new Date().toISOString() });
        } else {
          socket.emit("emergency_state_sync", { error: "Emergency not found", emergencyId });
        }
      } catch (err) {
        socket.emit("emergency_state_sync", { error: err.message });
      }
    });

    // -----------------------------------------------------------------------
    // REQUEST ALL AMBULANCE POSITIONS (control dashboard join)
    // -----------------------------------------------------------------------
    socket.on("request_all_positions", async () => {
      try {
        const ambulances = await Ambulance.find(
          {}, // include all ambulances so map initially shows seeded idle units
          "ambulanceId status lastKnownGps activeSession.routeId activeSession.eta driverName"
        ).lean();

        socket.emit("all_positions", {
          ambulances,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        logEvent("SOCKET", `request_all_positions error: ${err.message}`);
      }
    });

    // -----------------------------------------------------------------------
    // PING / HEARTBEAT
    // -----------------------------------------------------------------------
    socket.on("ping", () => {
      socket.emit("pong", { timestamp: new Date().toISOString() });
    });

    // -----------------------------------------------------------------------
    // DISCONNECT
    // -----------------------------------------------------------------------
    socket.on("disconnect", (reason) => {
      const client = connectedClients.get(socket.id);
      connectedClients.delete(socket.id);
      logEvent("SOCKET", `Disconnected: ${socket.id} (${client?.entityType || "unknown"}) — ${reason}`);
    });

    socket.on("error", (err) => {
      logEvent("SOCKET", `Error on ${socket.id}: ${err.message}`);
    });
  });

  // Expose for global use
  io.ROOMS = ROOMS;
  io.connectedClients = connectedClients;

  logEvent("SOCKET", "WebSocket handler initialized — all entity rooms ready");

  // -------------------------------------------------------------------------
  // Server-side: broadcast ambulance telemetry every 2s for active units
  // (ensures control dashboard gets updates even without socket GPS push)
  // -------------------------------------------------------------------------
  setInterval(async () => {
    try {
      const active = await Ambulance.find(
        {}, // broadcast all ambulances for visualization
        "ambulanceId status lastKnownGps activeSession.routeId activeSession.eta activeSession.currentSignalIndex"
      ).lean();

      if (active.length > 0) {
        io.to(ROOMS.CONTROL).emit("ambulances_telemetry", {
          ambulances: active.map((a) => ({
            ambulanceId: a.ambulanceId,
            lat: a.lastKnownGps?.lat,
            lng: a.lastKnownGps?.lng,
            heading: a.lastKnownGps?.heading,
            speed: a.lastKnownGps?.speed,
            routeId: a.activeSession?.routeId,
            eta: a.activeSession?.eta,
            currentSignalIndex: a.activeSession?.currentSignalIndex,
          })),
          timestamp: new Date().toISOString(),
        });
      }
    } catch (err) {
      // non-critical
    }
  }, 2000);
};