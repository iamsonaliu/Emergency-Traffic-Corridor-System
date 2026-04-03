const axios = require("axios");
// generate route id
function generateRouteId() {
  return `ROUTE-${Date.now()}`;
}
async function computeRoute(startLat, startLng, endLat, endLng, ambulanceId) {
  try {

    const url =
      `http://router.project-osrm.org/route/v1/driving/` +
      `${startLng},${startLat};${endLng},${endLat}` +
      `?overview=full&geometries=geojson&steps=true`;

    const response = await axios.get(url);

    const route = response.data.routes[0];

    if (!route) return null;

    // extract navigation instructions
    const navigationSteps = route.legs[0].steps.map(step => ({
      instruction: step.maneuver.instruction,
      distance: step.distance,
      duration: step.duration
    }));

    return {
      routeId: generateRouteId(),

      totalDistanceKm: route.distance / 1000,

      totalTimeMinutes: Math.ceil(route.duration / 60),

      polyline: route.geometry,

      navigationSteps,

      signals: [],   // will add traffic signals later
      signalCount: 0
    };

  } catch (err) {
    console.error("OSM routing error:", err.message);
    return null;
  }
}

module.exports = {
  computeRoute
};