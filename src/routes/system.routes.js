const express = require('express');
const auth = require('../middleware/auth.middleware');
const {
  getStatus,
  setOperatingMode,
  getFanControl,
  startFanTest,
  stopFanTest
} = require('../controllers/system.controller');

const router = express.Router();

router.use(auth);
const hostControl = require('../controllers/hostControl.controller');
router.get('/host-control', hostControl.status);
router.post('/host-control/:action', hostControl.action);
router.get('/status', getStatus);
router.post('/mode', setOperatingMode);
router.get('/fan-control', getFanControl);
router.post('/fan-control/test', startFanTest);
router.post('/fan-control/stop', stopFanTest);

module.exports = router;
