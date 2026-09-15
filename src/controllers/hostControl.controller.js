const host = require('../services/hostControl.service');
const logs = require('../services/logs.service');

exports.status = async (req, res) => res.json({ success: true, data: await host.status() });
exports.action = async (req, res) => {
  const action = req.params.action;
  if (!['check', 'install', 'reboot', 'poweroff', 'cancel-power'].includes(action)) {
    return res.status(400).json({ success: false, error: 'Unknown host action' });
  }
  const body = req.body || {};
  if (action !== 'check' && (typeof body.credential !== 'string' || body.credential.length < 32 || body.credential.length > 128)) {
    return res.status(400).json({ success: false, error: 'Separate administrator key required' });
  }
  const confirmation = { install: 'UPDATE NET', reboot: 'RESTART CM5', poweroff: 'VYPNOUT CM5' }[action];
  if (confirmation && body.confirmation !== confirmation) {
    return res.status(400).json({ success: false, error: 'Explicit confirmation required' });
  }
  if (action === 'install' && (typeof body.version !== 'string' || body.version.length > 80 ||
      !/^[0-9a-f]{40}$/.test(body.backend || '') || !/^[0-9a-f]{40}$/.test(body.frontend || ''))) {
    return res.status(400).json({ success: false, error: 'Exact release commits required' });
  }
  try {
    const payload = { action };
    if (action !== 'check') payload.credential = body.credential;
    if (confirmation) payload.confirmation = confirmation;
    if (action === 'install') Object.assign(payload, { version: body.version, backend: body.backend, frontend: body.frontend });
    const data = await host.request(payload);
    if (action !== 'check') logs.append({ type: 'sys', message: `Host action accepted: ${action}`, meta: { action } });
    res.status(202).json({ success: true, data });
  } catch (error) {
    res.status(503).json({ success: false, error: error.message });
  }
};
