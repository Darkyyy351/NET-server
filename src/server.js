require('dotenv').config();
const app = require('./app');

const PORT = process.env.PORT || 3000;
const telemetryHistory = require('./services/telemetryHistory.service');

const server = app.listen(PORT, () => {
  require('./services/availability.service').start();
  console.log(`NET Backend running on port ${PORT}`);
});

function shutdown() {
  try {
    telemetryHistory.close();
  } catch (error) {
    console.warn('Telemetry history could not be saved during shutdown:', error.message);
  }
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}

process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
