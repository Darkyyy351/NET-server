function parseTelemetry(value) {
  if (value === undefined || value === null) return null;
  const valid = typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).every(key => ['rssi', 'uptimeSeconds', 'freeHeapBytes'].includes(key)) &&
    Number.isInteger(value.rssi) && value.rssi >= -127 && value.rssi <= 0 &&
    Number.isSafeInteger(value.uptimeSeconds) && value.uptimeSeconds >= 0 &&
    Number.isInteger(value.freeHeapBytes) && value.freeHeapBytes >= 0 && value.freeHeapBytes <= 1048576;
  if (!valid) {
    const error = new Error('Invalid device telemetry');
    error.status = error.statusCode = 400;
    throw error;
  }
  return { rssi: value.rssi, uptimeSeconds: value.uptimeSeconds, freeHeapBytes: value.freeHeapBytes };
}

module.exports = { parseTelemetry };
