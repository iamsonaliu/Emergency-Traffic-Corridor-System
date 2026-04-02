const axios = require("axios");
const { logEvent } = require("../utils/auditLogger");
const { OSRM_BASE_URL, AMBULANCE_AVG_SPEED_KMH } = require("../config/constants");
const { haversineDistance } = require("./hospitalService");

// ---------------------------------------------------------------------------
// OSRM Routing (free, no API key required)
// Falls back to straight-line if OSRM is unreachable
// ---------------------------------------------------------------------------

async function getOSRMRoute(fromLat, fromLng, toLat, toLng) {
  try {
    const url = `${OSRM_BASE_URL}/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson&steps=true&annotations=false`;

    const resp = await axios.get(url, { timeout: 8000 });

    if (resp.data?.code !== "Ok" || !resp.data?.routes?.length) {
      throw new Error("OSRM: No route found");
    }

    const route = resp.data.routes[0];
    return {
      distanceKm: parseFloat((route.distance / 1000).toFixed(2)),
      durationMinutes: parseFloat((route.duration / 60).toFixed(2)),
      // GeoJSON coordinates [[lng, lat], ...]
      polylineCoords: route.geometry.coordinates,
      steps: extractNavigationSteps(route.legs?.[0]?.steps || []),
    };
  } catch (err) {
    logEvent("ROUTE_SERVICE", `OSRM failed (${err.message}) — using straight-line fallback`);
    return straightLineFallback(fromLat, fromLng, toLat, toLng);
  }
}

function straightLineFallback(fromLat, fromLng, toLat, toLng) {
  const distanceKm = haversineDistance(fromLat, fromLng, toLat, toLng);
  // Assume city routing is ~1.4x straight line
  const roadDistanceKm = parseFloat((distanceKm * 1.4).toFixed(2));
  const durationMinutes = parseFloat(((roadDistanceKm / AMBULANCE_AVG_SPEED_KMH) * 60).toFixed(2));

  // Simple interpolated polyline (5 waypoints)
  const coords = [];
  for (let i = 0; i <= 4; i++) {
    const t = i / 4;
    coords.push([
      parseFloat((fromLng + (toLng - fromLng) * t).toFixed(6)),
      parseFloat((fromLat + (toLat - fromLat) * t).toFixed(6)),
    ]);
  }

  return {
    distanceKm: roadDistanceKm,
    durationMinutes,
    polylineCoords: coords,
    steps: [
      `Head toward destination (${roadDistanceKm.toFixed(1)} km)`,
      `Arrive at destination`,
    ],
  };
}

function extractNavigationSteps(osrmSteps) {
  return osrmSteps
    .filter((s) => s.maneuver?.type !== "arrive" || osrmSteps.indexOf(s) === osrmSteps.length - 1)
    .map((s) => {
      const maneuver = s.maneuver?.modifier || s.maneuver?.type || "continue";
      const street = s.name || "unnamed road";
      const dist = s.distance ? ` (${(s.distance / 1000).toFixed(1)} km)` : "";
      return `${capitalize(maneuver)} on ${street}${dist}`;
    })
    .filter(Boolean)
    .slice(0, 15);
}

function capitalize(s) {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ---------------------------------------------------------------------------
// Generate signal sequence along route polyline
// Samples points from the polyline to represent traffic signals
// ---------------------------------------------------------------------------
function buildSignalSequence(polylineCoords, totalTimeMinutes, dispatchTime, ambulanceId) {
  if (!polylineCoords || polylineCoords.length < 2) return [];

  // Sample ~6-8 evenly spaced points as "signals"
  const MAX_SIGNALS = Math.min(8, Math.max(3, Math.floor(polylineCoords.length / 3)));
  const step = Math.floor(polylineCoords.length / (MAX_SIGNALS + 1));

  const signals = [];
  let cumulativeTime = 0;

  for (let i = 1; i <= MAX_SIGNALS; i++) {
    const idx = i * step;
    if (idx >= polylineCoords.length) break;

    const [lng, lat] = polylineCoords[idx];
    cumulativeTime = (totalTimeMinutes * i) / (MAX_SIGNALS + 1);
    const etaTimestamp = new Date(dispatchTime.getTime() + cumulativeTime * 60 * 1000);

    signals.push({
      signalId: `${ambulanceId}-SIG-${String(i).padStart(2, "0")}`,
      name: `Signal ${i}`,
      lat: parseFloat(lat.toFixed(6)),
      lng: parseFloat(lng.toFixed(6)),
      etaMinutes: parseFloat(cumulativeTime.toFixed(2)),
      etaTimestamp: etaTimestamp.toISOString(),
      status: "pending",
      isSignal: true,
    });
  }

  return signals;
}

// ---------------------------------------------------------------------------
// Main: compute route from ambulance → hospital
// ---------------------------------------------------------------------------
async function computeRoute(fromLat, fromLng, toLat, toLng, ambulanceId) {
  logEvent("ROUTE_SERVICE", `Computing route: (${fromLat},${fromLng}) → (${toLat},${toLng}) for ${ambulanceId}`);

  const routeData = await getOSRMRoute(fromLat, fromLng, toLat, toLng);
  const dispatchTime = new Date();
  const routeId = `ROUTE-${ambulanceId}-${Date.now()}`;

  const signals = buildSignalSequence(
    routeData.polylineCoords,
    routeData.durationMinutes,
    dispatchTime,
    ambulanceId
  );

  logEvent(
    "ROUTE_SERVICE",
    `Route computed: ${routeData.distanceKm}km | ${routeData.durationMinutes}min | ${signals.length} signals`
  );

  return {
    routeId,
    totalDistanceKm: routeData.distanceKm,
    totalTimeMinutes: routeData.durationMinutes,
    signalCount: signals.length,
    signals,
    polyline: {
      type: "LineString",
      coordinates: routeData.polylineCoords, // [[lng, lat], ...]
    },
    navigationSteps: routeData.steps,
    dispatchTime: dispatchTime.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Reroute: recompute from current position to new hospital
// ---------------------------------------------------------------------------
async function rerouteAmbulance(currentLat, currentLng, newHospitalLat, newHospitalLng, ambulanceId) {
  logEvent("ROUTE_SERVICE", `REROUTE: ${ambulanceId} from (${currentLat},${currentLng})`);
  return computeRoute(currentLat, currentLng, newHospitalLat, newHospitalLng, ambulanceId);
}

module.exports = {
  computeRoute,
  rerouteAmbulance,
  getOSRMRoute,
  buildSignalSequence,
};