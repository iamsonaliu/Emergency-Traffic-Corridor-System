const axios = require("axios");
const Hospital = require("../models/Hospital");
const { logEvent } = require("../utils/auditLogger");
const {
  OVERPASS_API_URL,
  MAX_HOSPITALS_TO_QUERY,
  HOSPITAL_RESPONSE_TIMEOUT_MS,
  AMBULANCE_AVG_SPEED_KMH,
  EARTH_RADIUS_KM,
} = require("../config/constants");

// ---------------------------------------------------------------------------
// Haversine Distance
// ---------------------------------------------------------------------------
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = EARTH_RADIUS_KM;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function estimateETA(distanceKm) {
  return Math.ceil((distanceKm / AMBULANCE_AVG_SPEED_KMH) * 60);
}

// ---------------------------------------------------------------------------
// Discover hospitals from OpenStreetMap via Overpass API
// and upsert them into the DB
// ---------------------------------------------------------------------------
async function discoverAndSyncHospitals(lat, lng, radiusMeters = 10000) {
  logEvent("HOSPITAL_SERVICE", `Discovering hospitals via Overpass within ${radiusMeters}m of (${lat}, ${lng})`);

  const query = `
    [out:json][timeout:15];
    (
      node["amenity"="hospital"](around:${radiusMeters},${lat},${lng});
      way["amenity"="hospital"](around:${radiusMeters},${lat},${lng});
      node["amenity"="clinic"](around:${radiusMeters},${lat},${lng});
    );
    out center;
  `;

  try {
    const resp = await axios.post(OVERPASS_API_URL, `data=${encodeURIComponent(query)}`, {
      timeout: 15000,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    const elements = resp.data?.elements || [];
    logEvent("HOSPITAL_SERVICE", `Overpass returned ${elements.length} hospital nodes`);

    const upserted = [];

    for (const el of elements) {
      const elLat = el.lat ?? el.center?.lat;
      const elLng = el.lon ?? el.center?.lon;
      if (!elLat || !elLng) continue;

      const name = el.tags?.name || el.tags?.["name:en"] || "Unknown Hospital";
      const osmId = String(el.id);
      const hospitalId = `OSM-${osmId}`;

      try {
        const doc = await Hospital.findOneAndUpdate(
          { hospitalId },
          {
            $setOnInsert: {
              hospitalId,
              name,
              address: el.tags?.["addr:full"] || el.tags?.["addr:street"] || "Address not available",
              lat: elLat,
              lng: elLng,
              location: { type: "Point", coordinates: [elLng, elLat] },
              emergencyBeds: { total: 10, available: 8, reserved: 0 },
              status: "available",
              source: "osm",
              osmId,
              specialties: buildSpecialties(el.tags),
              traumaLevel: el.tags?.["healthcare:speciality"] ? "Level 2" : "Level 3",
            },
            $set: {
              name,
              lastUpdated: new Date(),
            },
          },
          { upsert: true, new: true }
        );
        upserted.push(doc);
      } catch (err) {
        // Skip duplicates silently
      }
    }

    logEvent("HOSPITAL_SERVICE", `Synced ${upserted.length} hospitals from OSM`);
    return upserted;
  } catch (err) {
    logEvent("HOSPITAL_SERVICE", `Overpass API failed: ${err.message} — using DB only`);
    return [];
  }
}

function buildSpecialties(tags = {}) {
  const specs = ["General Emergency"];
  if (tags["healthcare:speciality"]) {
    specs.push(...tags["healthcare:speciality"].split(";").map((s) => s.trim()));
  }
  return [...new Set(specs)];
}

// ---------------------------------------------------------------------------
// Query nearest hospitals from DB (after sync)
// ---------------------------------------------------------------------------
async function queryNearestHospitals(lat, lng, radiusKm = 15, emergencyType = null) {
  // Try geospatial query first
  let hospitals = await Hospital.find({
    location: {
      $near: {
        $geometry: { type: "Point", coordinates: [lng, lat] },
        $maxDistance: radiusKm * 1000,
      },
    },
    status: { $ne: "offline" },
  }).limit(MAX_HOSPITALS_TO_QUERY + 2);

  // Fallback: if geospatial index not ready, use simple find
  if (!hospitals || hospitals.length === 0) {
    hospitals = await Hospital.find({ status: { $ne: "offline" } }).limit(10);
  }

  // Attach distance + ETA
  const withMeta = hospitals.map((h) => {
    const dist = haversineDistance(lat, lng, h.lat, h.lng);
    return {
      hospital: h,
      distanceKm: parseFloat(dist.toFixed(2)),
      eta: estimateETA(dist),
      responseStatus: h.status,
    };
  });

  // Sort by distance
  withMeta.sort((a, b) => a.distanceKm - b.distanceKm);
  return withMeta.slice(0, MAX_HOSPITALS_TO_QUERY);
}

// ---------------------------------------------------------------------------
// Get live availability (reads from DB — no HTTP to hospitals in this version)
// ---------------------------------------------------------------------------
async function fetchHospitalResponse(entry) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve({ ...entry, responseStatus: "no_response" });
    }, HOSPITAL_RESPONSE_TIMEOUT_MS);

    const h = entry.hospital;
    clearTimeout(timeout);

    const status =
      h.emergencyBeds.available >= 1 && h.status !== "offline"
        ? "available"
        : h.status === "offline"
        ? "no_response"
        : "full";

    resolve({ ...entry, responseStatus: status });
  });
}

// ---------------------------------------------------------------------------
// Rank candidates
// ---------------------------------------------------------------------------
function rankHospitals(responded) {
  const eligible = responded.filter(
    (h) => h.responseStatus === "available" && h.hospital.emergencyBeds.available >= 1
  );
  eligible.sort((a, b) => {
    // Primary: ETA, Secondary: available beds (more = better)
    if (a.eta !== b.eta) return a.eta - b.eta;
    return b.hospital.emergencyBeds.available - a.hospital.emergencyBeds.available;
  });
  return eligible;
}

// ---------------------------------------------------------------------------
// Main: select best hospital for an emergency
// ---------------------------------------------------------------------------
async function selectBestHospital(lat, lng, emergencyType, ambulanceId, emergencyId) {
  // 1. Sync hospitals from OSM in background (non-blocking for first call)
  discoverAndSyncHospitals(lat, lng, 15000).catch(() => {});

  // 2. Query DB for nearest
  const nearest = await queryNearestHospitals(lat, lng, 15, emergencyType);

  if (nearest.length === 0) {
    logEvent("HOSPITAL_SERVICE", "No hospitals found in DB — trying wider radius");
    const wider = await queryNearestHospitals(lat, lng, 30, emergencyType);
    if (wider.length === 0) {
      return { selected: null, candidates: [] };
    }
    nearest.push(...wider);
  }

  logEvent("HOSPITAL_SERVICE", `Checking availability for ${nearest.length} hospitals`);

  // 3. Fetch live status
  const responses = await Promise.all(nearest.map(fetchHospitalResponse));

  responses.forEach((r) =>
    logEvent(
      "HOSPITAL_SERVICE",
      `  ${r.hospital.name}: ${r.responseStatus} | ETA ${r.eta}m | Beds ${r.hospital.emergencyBeds.available}`
    )
  );

  // 4. Rank
  const ranked = rankHospitals(responses);

  if (ranked.length === 0) {
    return { selected: null, candidates: responses };
  }

  const selected = ranked[0];

  // 5. Push pending request to hospital
  await selected.hospital.addRequest(ambulanceId, emergencyId, selected.eta, emergencyType);

  logEvent(
    "HOSPITAL_SERVICE",
    `Selected: ${selected.hospital.name} | ETA ${selected.eta}m | ${selected.distanceKm}km`
  );

  return { selected, candidates: responses };
}

// ---------------------------------------------------------------------------
// Failover
// ---------------------------------------------------------------------------
async function failoverHospital(lat, lng, emergencyType, ambulanceId, excludeHospitalId) {
  logEvent("HOSPITAL_SERVICE", `FAILOVER: excluding ${excludeHospitalId}`);

  const nearest = await queryNearestHospitals(lat, lng, 20, emergencyType);
  const filtered = nearest.filter(
    (h) =>
      h.hospital.hospitalId !== excludeHospitalId &&
      h.hospital._id.toString() !== excludeHospitalId
  );

  if (filtered.length === 0) return null;

  const responses = await Promise.all(filtered.map(fetchHospitalResponse));
  const ranked = rankHospitals(responses);

  if (ranked.length === 0) return null;

  const newSelected = ranked[0];
  logEvent("HOSPITAL_SERVICE", `FAILOVER resolved: ${newSelected.hospital.name}`);
  return newSelected;
}

module.exports = {
  selectBestHospital,
  failoverHospital,
  queryNearestHospitals,
  discoverAndSyncHospitals,
  haversineDistance,
  estimateETA,
};