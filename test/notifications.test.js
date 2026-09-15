const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const app = require('../src/app');
const availability = require('../src/services/availability.service');
const files = ['notifications.json', 'logs.json'].map(name => path.join(__dirname, '../data', name));
const originals = files.map(file => fs.existsSync(file) ? fs.readFileSync(file) : null);

(async () => {
  process.env.API_TOKEN = 'test-notifications';
  fs.mkdirSync(path.dirname(files[0]), { recursive: true });
  files.forEach(file => fs.writeFileSync(file, '[]'));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    const device = { id: 'fixture', name: 'Test ESP', status: 'online' };
    const scan = availability.createMonitor(() => [device]);
    scan();
    for (let i = 0; i < 102; i++) {
      device.status = device.status === 'online' ? 'offline' : 'online';
      scan(); scan();
    }
    const history = availability.getRecent();
    assert.equal(history.length, 100);
    assert.equal(new Set(history.map(item => item.id)).size, 100);
    assert.equal(history[0].state, 'online');
    assert.equal(history[0].deviceId, 'fixture');
    assert.equal(JSON.parse(fs.readFileSync(files[0])).length, 100);
    const url = `http://127.0.0.1:${server.address().port}/api/v1/notifications`;
    assert.equal((await fetch(url)).status, 401);
    const response = await fetch(url, { headers: { Authorization: 'Bearer test-notifications' } });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).data.length, 100);
    console.log('Notification storage, retention, deduplication and API authentication tests passed');
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    files.forEach((file, index) => { if (originals[index] === null) fs.rmSync(file, { force: true }); else fs.writeFileSync(file, originals[index]); });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
