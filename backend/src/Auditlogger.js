/**
 * Audit Logger
 *
 * Logs every system event in the format:
 * [Timestamp] [Entity] [Action]
 *
 * In production, replace console output with a persistent store
 * (MongoDB audit collection, Winston file transport, etc.)
 */

function logEvent(entity, action) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] [${entity}] ${action}`;
  console.log(line);
  // Future: write to DB audit collection or log file
}

module.exports = { logEvent };