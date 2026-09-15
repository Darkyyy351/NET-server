const net = require('net');

function request(payload) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(process.env.NET_HOST_CONTROL_SOCKET || '/run/net-host-control/control.sock');
    let response = '';
    let settled = false;
    const finish = (error, data) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      if (error) reject(error); else resolve(data);
    };
    const timer = setTimeout(() => finish(new Error('Host helper timed out. Check status before retrying.')), 5000);
    socket.setEncoding('utf8');
    socket.on('connect', () => socket.end(`${JSON.stringify(payload)}\n`));
    socket.on('data', chunk => {
      response += chunk;
      if (response.length > 32768) finish(new Error('Invalid host helper response'));
    });
    socket.on('error', () => finish(new Error('Host helper is unavailable')));
    socket.on('end', () => {
      try {
        const result = JSON.parse(response);
        if (!result.ok) return finish(new Error(result.error || 'Host action rejected'));
        finish(null, result.data);
      } catch { finish(new Error('Invalid host helper response')); }
    });
  });
}

exports.request = request;
exports.status = async () => {
  try { return await request({ action: 'status' }); }
  catch (error) {
    return { available: false, powerAvailable: false, updateState: 'unavailable',
      checkedAt: null, release: null, checking: false, operation: { state: 'idle' }, error: error.message };
  }
};
