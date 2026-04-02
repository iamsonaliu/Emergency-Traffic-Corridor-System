/**
 * Road Network Utility
 *
 * Provides the weighted intersection graph and node metadata
 * used by routeService for Dijkstra pathfinding.
 *
 * In production, replace this with:
 *   - Google Maps Routes API (Directions / Distance Matrix)
 *   - HERE Routing API
 *   - OSRM (Open Source Routing Machine) self-hosted
 *   - OpenRouteService
 *
 * Structure:
 *   graph: { nodeId: [{ to: nodeId, weight: travelTimeMinutes }] }
 *   nodeMetadata: {
 *     nodeId: {
 *       name: string,
 *       lat: number,
 *       lng: number,
 *       isSignal: boolean,
 *       direction: string,        // e.g. "Turn left"
 *       distanceFromPrev: string  // e.g. "300m"
 *     }
 *   }
 *
 * Extend this file with actual city intersection data for your deployment area.
 */

const roadNetwork = {
  graph: {
    // Format: nodeId → [{ to: nodeId, weight: minutes }]
    // Example city grid — replace with real data

    "AMB_START": [
      { to: "SIG_001", weight: 1.5 },
      { to: "SIG_002", weight: 2.0 },
    ],
    "SIG_001": [
      { to: "AMB_START", weight: 1.5 },
      { to: "SIG_003", weight: 1.0 },
      { to: "SIG_004", weight: 2.5 },
    ],
    "SIG_002": [
      { to: "AMB_START", weight: 2.0 },
      { to: "SIG_004", weight: 1.5 },
    ],
    "SIG_003": [
      { to: "SIG_001", weight: 1.0 },
      { to: "SIG_005", weight: 1.0 },
      { to: "HOSP_A",  weight: 2.0 },
    ],
    "SIG_004": [
      { to: "SIG_001", weight: 2.5 },
      { to: "SIG_002", weight: 1.5 },
      { to: "SIG_006", weight: 1.0 },
    ],
    "SIG_005": [
      { to: "SIG_003", weight: 1.0 },
      { to: "HOSP_A",  weight: 1.0 },
      { to: "HOSP_B",  weight: 3.0 },
    ],
    "SIG_006": [
      { to: "SIG_004", weight: 1.0 },
      { to: "HOSP_B",  weight: 2.0 },
      { to: "HOSP_C",  weight: 3.5 },
    ],
    "HOSP_A": [
      { to: "SIG_003", weight: 2.0 },
      { to: "SIG_005", weight: 1.0 },
    ],
    "HOSP_B": [
      { to: "SIG_005", weight: 3.0 },
      { to: "SIG_006", weight: 2.0 },
    ],
    "HOSP_C": [
      { to: "SIG_006", weight: 3.5 },
    ],
  },

  nodeMetadata: {
    "AMB_START": {
      name: "Ambulance Start",
      lat: 30.3165,
      lng: 78.0322,
      isSignal: false,
      direction: "Depart",
      distanceFromPrev: "0m",
    },
    "SIG_001": {
      name: "Main Chowk Signal",
      lat: 30.3180,
      lng: 78.0340,
      isSignal: true,
      direction: "Continue straight",
      distanceFromPrev: "400m",
    },
    "SIG_002": {
      name: "Clock Tower Junction",
      lat: 30.3150,
      lng: 78.0360,
      isSignal: true,
      direction: "Turn right",
      distanceFromPrev: "600m",
    },
    "SIG_003": {
      name: "Rajpur Road Signal",
      lat: 30.3195,
      lng: 78.0355,
      isSignal: true,
      direction: "Continue straight",
      distanceFromPrev: "350m",
    },
    "SIG_004": {
      name: "Paltan Bazaar Signal",
      lat: 30.3162,
      lng: 78.0390,
      isSignal: true,
      direction: "Turn left",
      distanceFromPrev: "500m",
    },
    "SIG_005": {
      name: "Dharampur Crossing",
      lat: 30.3210,
      lng: 78.0370,
      isSignal: true,
      direction: "Continue straight",
      distanceFromPrev: "300m",
    },
    "SIG_006": {
      name: "Chakrata Road Signal",
      lat: 30.3175,
      lng: 78.0415,
      isSignal: true,
      direction: "Turn right",
      distanceFromPrev: "450m",
    },
    "HOSP_A": {
      name: "City Hospital",
      lat: 30.3225,
      lng: 78.0380,
      isSignal: false,
      direction: "Arrive at destination",
      distanceFromPrev: "200m",
    },
    "HOSP_B": {
      name: "General Hospital",
      lat: 30.3188,
      lng: 78.0435,
      isSignal: false,
      direction: "Arrive at destination",
      distanceFromPrev: "250m",
    },
    "HOSP_C": {
      name: "Medical College Hospital",
      lat: 30.3145,
      lng: 78.0460,
      isSignal: false,
      direction: "Arrive at destination",
      distanceFromPrev: "300m",
    },
  },
};

/**
 * Returns the road network.
 * Extend this to accept lat/lng and dynamically build from a maps API.
 */
function getRoadNetwork() {
  return roadNetwork;
}

/**
 * Dynamically add a new node (e.g. from real-time map data).
 */
function addNode(nodeId, metadata, edges) {
  roadNetwork.nodeMetadata[nodeId] = metadata;
  roadNetwork.graph[nodeId] = edges;
  // Add reverse edges
  edges.forEach(({ to, weight }) => {
    if (!roadNetwork.graph[to]) roadNetwork.graph[to] = [];
    const exists = roadNetwork.graph[to].find((e) => e.to === nodeId);
    if (!exists) roadNetwork.graph[to].push({ to: nodeId, weight });
  });
}

module.exports = { getRoadNetwork, addNode };