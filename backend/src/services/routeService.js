const { logEvent } = require("../utils/auditLogger");

/**
 * Route Service
 *
 * In a production system this would integrate with a mapping API
 * (Google Maps Routes API, HERE, or OpenStreetMap/OSRM).
 *
 * This implementation:
 *  - Builds a weighted graph from intersection/signal data
 *  - Runs Dijkstra's algorithm to find the shortest path
 *  - Extracts ordered signal sequence with per-signal ETA
 *
 * The graph nodes represent named intersections/signals.
 * The graph edges represent road segments with travel time (weight in minutes).
 */

// ---------------------------------------------------------------------------
// Dijkstra's Algorithm
// ---------------------------------------------------------------------------

/**
 * @param {Object} graph  - Adjacency list: { nodeId: [{ to, weight }] }
 * @param {string} start  - Start node ID
 * @param {string} end    - End node ID
 * @returns {{ path: string[], totalTime: number }}
 */
function dijkstra(graph, start, end) {
  const dist = {};
  const prev = {};
  const visited = new Set();
  const queue = new Map(); // node → tentative distance

  Object.keys(graph).forEach((node) => {
    dist[node] = Infinity;
    prev[node] = null;
  });
  dist[start] = 0;
  queue.set(start, 0);

  while (queue.size > 0) {
    // Pick node with minimum distance
    let u = null;
    let minDist = Infinity;
    for (const [node, d] of queue) {
      if (d < minDist) {
        minDist = d;
        u = node;
      }
    }
    queue.delete(u);

    if (!u || u === end) break;
    if (visited.has(u)) continue;
    visited.add(u);

    for (const { to, weight } of graph[u] || []) {
      if (visited.has(to)) continue;
      const alt = dist[u] + weight;
      if (alt < dist[to]) {
        dist[to] = alt;
        prev[to] = u;
        queue.set(to, alt);
      }
    }
  }

  // Reconstruct path
  const path = [];
  let cur = end;
  while (cur) {
    path.unshift(cur);
    cur = prev[cur];
  }

  if (path[0] !== start) return { path: [], totalTime: Infinity }; // no path

  return { path, totalTime: parseFloat(dist[end].toFixed(2)) };
}

// ---------------------------------------------------------------------------
// Signal Sequence Builder
// ---------------------------------------------------------------------------

/**
 * Converts a path (array of node IDs) into an ordered signal/intersection list
 * with cumulative ETA timestamps.
 *
 * @param {string[]} path           - Ordered node IDs
 * @param {Object}   graph          - Graph (to get edge weights)
 * @param {Object}   nodeMetadata   - { nodeId: { name, lat, lng, isSignal } }
 * @param {Date}     dispatchTime   - When the ambulance departs
 * @returns {Array}  signals array
 */
function buildSignalSequence(path, graph, nodeMetadata, dispatchTime) {
  const signals = [];
  let cumulativeMinutes = 0;

  for (let i = 0; i < path.length; i++) {
    const nodeId = path[i];
    const meta = nodeMetadata[nodeId] || { name: nodeId, isSignal: true };

    if (i > 0) {
      // Find edge weight from previous node
      const prev = path[i - 1];
      const edge = (graph[prev] || []).find((e) => e.to === nodeId);
      cumulativeMinutes += edge ? edge.weight : 0;
    }

    const eta = new Date(dispatchTime.getTime() + cumulativeMinutes * 60 * 1000);

    signals.push({
      signalId: nodeId,
      name: meta.name || nodeId,
      isSignal: meta.isSignal !== false, // default true
      lat: meta.lat || null,
      lng: meta.lng || null,
      etaMinutes: parseFloat(cumulativeMinutes.toFixed(2)),
      etaTimestamp: eta.toISOString(),
      status: "pending", // will be updated by trafficService
    });
  }

  return signals;
}

// ---------------------------------------------------------------------------
// Main Route Computation
// ---------------------------------------------------------------------------

/**
 * Compute the shortest route from ambulance to hospital.
 *
 * @param {Object} ambulanceLocation  - { lat, lng, nodeId }
 * @param {Object} hospitalLocation   - { lat, lng, nodeId }
 * @param {Object} roadNetwork        - { graph, nodeMetadata }
 * @param {string} ambulanceId
 * @returns {Object} routeResult
 */
function computeRoute(ambulanceLocation, hospitalLocation, roadNetwork, ambulanceId) {
  const { graph, nodeMetadata } = roadNetwork;
  const startNode = ambulanceLocation.nodeId;
  const endNode = hospitalLocation.nodeId;

  logEvent("ROUTE_SERVICE", `Computing route: ${startNode} → ${endNode} for ambulance ${ambulanceId}`);

  const { path, totalTime } = dijkstra(graph, startNode, endNode);

  if (path.length === 0) {
    logEvent("ROUTE_SERVICE", `No path found from ${startNode} to ${endNode}`);
    return null;
  }

  const dispatchTime = new Date();
  const signals = buildSignalSequence(path, graph, nodeMetadata, dispatchTime);
  const signalCount = signals.filter((s) => s.isSignal).length;

  logEvent(
    "ROUTE_SERVICE",
    `Route computed: ${path.length} nodes | ${signalCount} signals | ETA: ${totalTime} min`
  );

  const navigationSteps = generateNavigationSteps(path, nodeMetadata);

  return {
    routeId: `ROUTE-${ambulanceId}-${Date.now()}`,
    startNode,
    endNode,
    path,
    totalTimeMinutes: totalTime,
    signalCount,
    signals,
    navigationSteps,
    dispatchTime: dispatchTime.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Navigation Steps Generator (Turn-by-turn for Ambulance Driver)
// ---------------------------------------------------------------------------

function generateNavigationSteps(path, nodeMetadata) {
  const steps = [];
  for (let i = 1; i < path.length; i++) {
    const prev = nodeMetadata[path[i - 1]] || { name: path[i - 1] };
    const curr = nodeMetadata[path[i]] || { name: path[i] };
    const direction = curr.direction || "Continue straight";
    const distance = curr.distanceFromPrev || "next intersection";
    steps.push(`${direction} at ${prev.name} → ${curr.name} (${distance})`);
  }
  return steps;
}

// ---------------------------------------------------------------------------
// Reroute (called on failover or road block)
// ---------------------------------------------------------------------------

function rerouteAmbulance(currentNodeId, newHospitalNodeId, roadNetwork, ambulanceId) {
  logEvent("ROUTE_SERVICE", `REROUTE initiated from ${currentNodeId} to new hospital ${newHospitalNodeId}`);
  return computeRoute(
    { nodeId: currentNodeId },
    { nodeId: newHospitalNodeId },
    roadNetwork,
    ambulanceId
  );
}

module.exports = {
  computeRoute,
  rerouteAmbulance,
  dijkstra,
  buildSignalSequence,
  generateNavigationSteps,
};