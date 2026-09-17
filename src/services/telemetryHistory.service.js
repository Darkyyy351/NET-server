const path = require('path');
const { readJsonObject, writeJsonObject } = require('./jsonStore');

const filePath = process.env.TELEMETRY_HISTORY_FILE || path.join(__dirname, '../../data/telemetry-history.json');
const DEFAULT_SAMPLE_SECONDS = 60;
const DEFAULT_RETENTION_HOURS = 24;
const DEFAULT_FLUSH_SECONDS = 300;

function boundedInteger(value, fallback, min, max) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

function settings() {
  return {
    sampleIntervalSeconds: boundedInteger(process.env.TELEMETRY_HISTORY_SAMPLE_SECONDS, DEFAULT_SAMPLE_SECONDS, 15, 3600),
    retentionHours: boundedInteger(process.env.TELEMETRY_HISTORY_RETENTION_HOURS, DEFAULT_RETENTION_HOURS, 1, 168),
    flushIntervalSeconds: boundedInteger(process.env.TELEMETRY_HISTORY_FLUSH_SECONDS, DEFAULT_FLUSH_SECONDS, 30, 900)
  };
}

function loadStore() {
  try {
    const data = readJsonObject(filePath, { schemaVersion: 1, devices: {}, availability: {} });
    if (data.schemaVersion !== 1 || !data.devices || typeof data.devices !== 'object' || Array.isArray(data.devices)) {
      throw new Error('Unsupported telemetry history schema');
    }
    return { ...data, availability: data.availability && typeof data.availability === 'object' && !Array.isArray(data.availability) ? data.availability : {} };
  } catch (error) {
    console.warn('Telemetry history unavailable, starting with an empty store:', error.message);
    return { schemaVersion: 1, devices: {}, availability: {} };
  }
}

let store = loadStore();
let dirty = false;
let flushTimer = null;

function validSample(sample) {
  return sample && typeof sample === 'object' && Number.isInteger(sample.rssi) &&
    Number.isSafeInteger(sample.uptimeSeconds) && Number.isInteger(sample.freeHeapBytes);
}

function pruneSamples(samples, cutoff) {
  if (!Array.isArray(samples)) return [];
  return samples.filter(sample => validSample(sample) && typeof sample.at === 'string' && Date.parse(sample.at) >= cutoff);
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    try {
      exports.flush();
    } catch (error) {
      console.warn('Telemetry history could not be saved:', error.message);
      scheduleFlush();
    }
  }, settings().flushIntervalSeconds * 1000);
  flushTimer.unref();
}

exports.record = (deviceId, sample, timestamp = new Date()) => {
  if (!validSample(sample) || typeof deviceId !== 'string') return false;
  const at = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (!Number.isFinite(at.getTime())) return false;
  const config = settings();
  const cutoff = at.getTime() - config.retentionHours * 60 * 60 * 1000;
  const samples = pruneSamples(store.devices[deviceId], cutoff);
  const previousAt = samples.length ? Date.parse(samples[samples.length - 1].at) : 0;
  if (previousAt && at.getTime() - previousAt < config.sampleIntervalSeconds * 1000) {
    store.devices[deviceId] = samples;
    return false;
  }
  samples.push({
    at: at.toISOString(),
    rssi: sample.rssi,
    uptimeSeconds: sample.uptimeSeconds,
    freeHeapBytes: sample.freeHeapBytes
  });
  const maximumSamples = Math.ceil(config.retentionHours * 3600 / config.sampleIntervalSeconds) + 2;
  store.devices[deviceId] = samples.slice(-maximumSamples);
  dirty = true;
  scheduleFlush();
  return true;
};

exports.recordAvailability = (deviceId, state, timestamp = new Date()) => {
  if (typeof deviceId !== 'string' || !['online', 'offline'].includes(state)) return false;
  const at = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (!Number.isFinite(at.getTime())) return false;
  const cutoff = at.getTime() - settings().retentionHours * 60 * 60 * 1000;
  const events = Array.isArray(store.availability[deviceId])
    ? store.availability[deviceId].filter(event => ['online', 'offline'].includes(event.state) && Date.parse(event.at) >= cutoff)
    : [];
  if (events[events.length - 1]?.state === state) return false;
  events.push({ at: at.toISOString(), state });
  store.availability[deviceId] = events.slice(-200);
  dirty = true;
  scheduleFlush();
  return true;
};

exports.getMany = (deviceIds, hours = 6) => {
  const config = settings();
  const requestedHours = Number(hours);
  const selectedHours = Math.min(Number.isInteger(requestedHours) && requestedHours > 0 ? requestedHours : 6, config.retentionHours);
  const now = Date.now();
  const cutoff = now - selectedHours * 60 * 60 * 1000;
  const retentionCutoff = now - config.retentionHours * 60 * 60 * 1000;
  const series = deviceIds.map(deviceId => {
    const samples = pruneSamples(store.devices[deviceId], retentionCutoff);
    if (samples.length !== (store.devices[deviceId] || []).length) {
      store.devices[deviceId] = samples;
      dirty = true;
      scheduleFlush();
    }
    const storedEvents = Array.isArray(store.availability[deviceId]) ? store.availability[deviceId] : [];
    const retainedEvents = storedEvents.filter(event => ['online', 'offline'].includes(event.state) && Date.parse(event.at) >= retentionCutoff);
    if (retainedEvents.length !== storedEvents.length) {
      store.availability[deviceId] = retainedEvents;
      dirty = true;
      scheduleFlush();
    }
    const events = retainedEvents.filter(event => Date.parse(event.at) >= cutoff);
    return { deviceId, samples: samples.filter(sample => Date.parse(sample.at) >= cutoff), events };
  });
  return {
    sampleIntervalSeconds: config.sampleIntervalSeconds,
    retentionHours: config.retentionHours,
    hours: selectedHours,
    from: new Date(cutoff).toISOString(),
    to: new Date(now).toISOString(),
    series
  };
};

exports.remove = deviceId => {
  const present = Object.prototype.hasOwnProperty.call(store.devices, deviceId) ||
    Object.prototype.hasOwnProperty.call(store.availability, deviceId);
  if (!present) return false;
  delete store.devices[deviceId];
  delete store.availability[deviceId];
  dirty = true;
  exports.flush();
  return true;
};

exports.flush = () => {
  if (!dirty) return false;
  writeJsonObject(filePath, store);
  dirty = false;
  return true;
};

exports.close = () => {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  exports.flush();
};
