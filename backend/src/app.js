const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const ambulanceRoutes = require("./routes/ambulanceRoutes");
const hospitalRoutes = require("./routes/hospitalRoutes");
const trafficRoutes = require("./routes/trafficRoutes");

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// Routes
app.use("/api/ambulance", ambulanceRoutes);
app.use("/api/hospital", hospitalRoutes);
app.use("/api/traffic", trafficRoutes);

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(`[ERROR] ${err.message}`);
  res.status(err.status || 500).json({ error: err.message || "Internal Server Error" });
});

module.exports = app;