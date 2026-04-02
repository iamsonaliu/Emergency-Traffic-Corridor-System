const Hospital = require("../models/Hospital");
const { logEvent } = require("../utils/auditLogger");

const HOSPITAL_RESPONSE_TIMEOUT_MS = 8000;

/**
 * Haversine formula — straight-line distance in km between two lat/lng points.
 */
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Estimate ETA in minutes given distance in km.
 * Assumes average ambulance speed of 60 km/h in city.
 */
function estimateETA(distanceKm) {
  const avgSpeedKmH = 60;
  return Math.ceil((distanceKm / avgSpeedKmH) * 60);
}

/**
 * Query 3–4 nearest hospitals from the registry.
 * Returns hospitals sorted by distance with ETA, filtered by availability.
 */
async function queryNearestHospitals(ambulanceLat, ambulanceLng, emergencyType = null) {
  const allHospitals = await Hospital.find({});

  // Attach distance + ETA
  const withDistance = allHospitals.map((h) => {
    const dist = haversineDistance(ambulanceLat, ambulanceLng, h.location.lat, h.location.lng);
    const eta = estimateETA(dist);
    return { hospital: h, distanceKm: parseFloat(dist.toFixed(2)), eta };
  });

  // Sort by distance, pick nearest 4
  withDistance.sort((a, b) => a.distanceKm - b.distanceKm);
  const nearest = withDistance.slice(0, 4);

  logEvent("HOSPITAL_SERVICE", `Queried ${nearest.length} nearest hospitals for ambulance at (${ambulanceLat}, ${ambulanceLng})`);

  return nearest;
}

/**
 * Simulate hospital response with timeout handling.
 * In production, this would call each hospital's portal API.
 * Here we read live DB status and simulate async response.
 */
async function fetchHospitalResponse(hospitalEntry) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve({ ...hospitalEntry, responseStatus: "no_response" });
    }, HOSPITAL_RESPONSE_TIMEOUT_MS);

    // Simulate instant DB read (replace with real HTTP call if hospitals have their own service)
    const h = hospitalEntry.hospital;
    clearTimeout(timeout);

    const status =
      h.emergencyBeds.available >= 1
        ? "available"
        : "full";

    resolve({ ...hospitalEntry, responseStatus: status });
  });
}

/**
 * Rank hospitals:
 *  1. Must have ≥1 emergency bed (mandatory)
 *  2. Shortest ETA
 *  3. Fewest signals on route (approximated by distance here; routeService adds signal count)
 */
function rankHospitals(respondedHospitals) {
  const eligible = respondedHospitals.filter(
    (h) => h.responseStatus === "available" && h.hospital.emergencyBeds.available >= 1
  );

  eligible.sort((a, b) => {
    if (a.eta !== b.eta) return a.eta - b.eta;
    return a.distanceKm - b.distanceKm;
  });

  return eligible;
}

/**
 * Main orchestration: query → fetch responses → rank → return best candidate.
 */
async function selectBestHospital(ambulanceLat, ambulanceLng, emergencyType, ambulanceId) {
  const nearest = await queryNearestHospitals(ambulanceLat, ambulanceLng, emergencyType);

  logEvent("HOSPITAL_SERVICE", `Sending bed availability requests to ${nearest.length} hospitals`);

  // Parallel response fetch with timeout
  const responses = await Promise.all(nearest.map(fetchHospitalResponse));

  // Log each response
  responses.forEach((r) => {
    logEvent(
      "HOSPITAL_SERVICE",
      `Hospital "${r.hospital.name}" responded: ${r.responseStatus} | ETA: ${r.eta} min | Beds: ${r.hospital.emergencyBeds.available}`
    );
  });

  const ranked = rankHospitals(responses);

  if (ranked.length === 0) {
    logEvent("HOSPITAL_SERVICE", "No eligible hospitals found — all full or unresponsive");
    return { selected: null, candidates: responses };
  }

  const selected = ranked[0];

  // Push pending request to hospital record
  await Hospital.findByIdAndUpdate(selected.hospital._id, {
    $push: {
      pendingRequests: {
        ambulanceId,
        eta: selected.eta,
        emergencyType,
        requestedAt: new Date(),
        responseStatus: "pending",
      },
    },
  });

  logEvent(
    "HOSPITAL_SERVICE",
    `Selected hospital: "${selected.hospital.name}" | ETA: ${selected.eta} min | Distance: ${selected.distanceKm} km`
  );

  return { selected, candidates: responses };
}

/**
 * Failover: called when selected hospital becomes unavailable mid-route.
 * Excludes the failed hospital and recomputes.
 */
async function failoverHospital(ambulanceLat, ambulanceLng, emergencyType, ambulanceId, excludeHospitalId) {
  logEvent("HOSPITAL_SERVICE", `FAILOVER triggered — excluding hospital ${excludeHospitalId}`);

  const nearest = await queryNearestHospitals(ambulanceLat, ambulanceLng, emergencyType);
  const filtered = nearest.filter(
    (h) => h.hospital.hospitalId !== excludeHospitalId && h.hospital._id.toString() !== excludeHospitalId
  );

  const responses = await Promise.all(filtered.map(fetchHospitalResponse));
  const ranked = rankHospitals(responses);

  if (ranked.length === 0) {
    logEvent("HOSPITAL_SERVICE", "FAILOVER: No alternative hospitals available");
    return null;
  }

  const newSelected = ranked[0];
  logEvent(
    "HOSPITAL_SERVICE",
    `FAILOVER resolved: New hospital "${newSelected.hospital.name}" | ETA: ${newSelected.eta} min`
  );

  return newSelected;
}

module.exports = {
  selectBestHospital,
  failoverHospital,
  queryNearestHospitals,
  haversineDistance,
  estimateETA,
};