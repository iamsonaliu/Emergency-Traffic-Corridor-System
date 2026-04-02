require("dotenv").config();
const http = require("http");
const { Server } = require("socket.io");

const app = require("./app");
const connectDB = require("./config/db");
const initSocketHandler = require("./sockets/socketHandler");
const { logEvent } = require("./utils/auditLogger");

const PORT = process.env.PORT || 5000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:3000";

// Create HTTP server
const server = http.createServer(app);

// Attach Socket.IO
const io = new Server(server, {
  cors: {
    origin: CLIENT_ORIGIN,
    methods: ["GET", "POST"],
  },
  pingTimeout: 10000,
  pingInterval: 5000,
});

// Make io accessible in controllers via req.app.get("io")
app.set("io", io);

// Initialize WebSocket event handlers
initSocketHandler(io);

// Start server after DB connection
const start = async () => {
  await connectDB();

  server.listen(PORT, () => {
    logEvent("SERVER", `Emergency Green Corridor System running on port ${PORT}`);
    logEvent("SERVER", `WebSocket server ready — CORS origin: ${CLIENT_ORIGIN}`);
  });
};

start();