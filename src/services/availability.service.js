const path = require('path');
const crypto = require('crypto');
const devices = require('./devices.service');
const logs = require('./logs.service');
const { readJsonArray, writeJsonArray } = require('./jsonStore');
const telemetryHistory = require('./telemetryHistory.service');
const file = path.join(__dirname, '../../data/notifications.json');

function append(device, state) {
  const event = { id: crypto.randomUUID(), time: new Date().toISOString(),
    deviceId: device.id, deviceName: device.name, state,
    message: state === 'offline' ? `Zařízení ${device.name} je offline.` : `Zařízení ${device.name} je znovu online.` };
  const events = readJsonArray(file);
  writeJsonArray(file, [...events, event].slice(-100));
  telemetryHistory.recordAvailability(device.id, state, event.time);
  try {
    logs.append({ type: 'availability', level: state === 'offline' ? 'warn' : 'info',
      message: event.message, meta: { deviceId: device.id, state, notificationId: event.id } });
  } catch (error) { console.warn('Availability log unavailable:', error.message); }
}

function createMonitor(read = devices.getAll, notify = append) {
  const previous = new Map();
  let initialized = false;
  return () => {
    // A failed read throws before any state is changed. It is not an offline snapshot.
    const snapshot = read();
    const ids = new Set(snapshot.map(device => device.id));
    for (const id of previous.keys()) if (!ids.has(id)) previous.delete(id);
    for (const device of snapshot) {
      const before = previous.get(device.id);
      const after = device.status;
      if (initialized && ((before === 'online' && after === 'offline') || (before === 'offline' && after === 'online'))) {
        notify(device, after);
      }
      previous.set(device.id, after);
    }
    initialized = true;
  };
}

exports.getRecent = () => readJsonArray(file).slice(-100).reverse();
exports.createMonitor = createMonitor;
exports.start = () => {
  const scan = createMonitor();
  let failed = false;
  const tick = () => {
    try { scan(); failed = false; }
    catch (error) {
      if (!failed) console.warn('Availability scan unavailable:', error.message);
      failed = true;
    }
  };
  tick();
  const timer = setInterval(tick, 5000);
  timer.unref();
  return () => clearInterval(timer);
};
