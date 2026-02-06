// routes/adminConfig/index.js - Aggregates all adminConfig sub-routers
const express = require('express');

module.exports = function (db, appConfig, upload, saveConfig) {
  const router = express.Router();

  router.use('/', require('./vehicleConfig')(db, appConfig, upload));
  router.use('/', require('./classes')(db, appConfig, upload));
  router.use('/', require('./categories')(db, appConfig, upload));
  router.use('/', require('./specialtyVotes')(db, appConfig, upload));
  router.use('/', require('./products')(db, appConfig, upload));
  router.use('/', require('./appConfig')(db, appConfig, upload, saveConfig));

  return router;
};
