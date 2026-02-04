// routes/admin/index.js - Admin routes aggregator
// Combines all admin sub-routers into a single router for app.js

const express = require('express');

module.exports = function (db, appConfig, upload) {
  const router = express.Router();

  // Mount sub-routers
  router.use('/', require('./dashboard')(db, appConfig, upload));
  router.use('/', require('./users')(db, appConfig, upload));
  router.use('/', require('./vehicles')(db, appConfig, upload));
  router.use('/', require('./vendors')(db, appConfig, upload));

  return router;
};
