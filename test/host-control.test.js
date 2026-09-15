const assert = require('node:assert/strict');
const host = require('../src/services/hostControl.service');
const app = require('../src/app');

(async () => {
  process.env.API_TOKEN = 'device-token';
  const requests = [];
  host.request = async payload => { requests.push(payload); return { available: true }; };
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    const url = `http://127.0.0.1:${server.address().port}/api/v1/system/host-control/`;
    const post = (action, body, token = 'device-token') => fetch(url + action, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body)
    });
    assert.equal((await post('reboot', {})).status, 400);
    assert.equal((await post('reboot', { credential: 'x'.repeat(64), confirmation: 'yes' })).status, 400);
    assert.equal((await post('shell', { credential: 'x'.repeat(64) })).status, 400);
    assert.equal((await post('check', {}, 'bad-token')).status, 403);
    assert.equal(requests.length, 0);
    assert.equal((await post('install', { credential: 'x'.repeat(64), confirmation: 'UPDATE NET', version: '0.2.1', backend: 'main', frontend: 'main' })).status, 400);
    assert.equal((await post('reboot', { credential: 'x'.repeat(64), confirmation: 'RESTART CM5', command: 'injected' })).status, 202);
    assert.deepEqual(Object.keys(requests[0]).sort(), ['action', 'confirmation', 'credential']);
    assert.equal((await post('check', { command: 'injected', credential: 'ignored' })).status, 202);
    assert.deepEqual(requests[1], { action: 'check' });
    host.request = async () => { throw new Error('Unavailable'); };
    assert.equal((await post('check', {})).status, 503);
    console.log('Host control authentication, validation and failure tests passed');
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
