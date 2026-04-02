module.exports = {
  // Hospital selection
  HOSPITAL_RESPONSE_TIMEOUT_MS: 8000,
  MAX_HOSPITALS_TO_QUERY: 5,
  AMBULANCE_AVG_SPEED_KMH: 45, // city speed with corridor

  // Signal corridor
  SIGNAL_PREP_BUFFER_SECONDS: 30,
  SIGNAL_GREEN_HOLD_SECONDS: 60,
  SIGNAL_RESTORE_DELAY_SECONDS: 30,

  // Geospatial
  EARTH_RADIUS_KM: 6371,
  MAX_ROUTE_DISTANCE_KM: 50,

  // OSRM public routing API (free, no key)
  OSRM_BASE_URL: process.env.OSRM_API || "http://router.project-osrm.org",

  // Overpass API for hospital discovery (free OpenStreetMap)
  OVERPASS_API_URL: process.env.OVERPASS_API || "https://overpass-api.de/api/interpreter",

  // Default city center (override via env)
  DEFAULT_CITY_LAT: parseFloat(process.env.CITY_LAT) || 30.3165,
  DEFAULT_CITY_LNG: parseFloat(process.env.CITY_LNG) || 78.0322,
  DEFAULT_CITY_RADIUS_KM: parseFloat(process.env.CITY_RADIUS_KM) || 15,

  // Socket rooms
  ROOMS: {
    AMBULANCE: "room:ambulance",
    CONTROL: "room:control",
    HOSPITAL: "room:hospital",
    TRAFFIC: "room:traffic",
  },

  // Emergency statuses
  EMERGENCY_STATUS: {
    TRIGGERED: "triggered",
    HOSPITAL_SELECTION: "hospital_selection",
    ROUTING: "routing",
    EN_ROUTE: "en_route",
    ARRIVED: "arrived",
    COMPLETED: "completed",
    CANCELLED: "cancelled",
    FAILED: "failed",
  },
};