// routes/vendor/index.js - Vendor routes aggregator
// Combines all vendor-related routes into a single router

const express = require('express');

module.exports = function (db, appConfig, upload) {
  const router = express.Router();

  // Mount sub-routers
  router.use('/', require('./dashboard')(db, appConfig, upload));
  router.use('/', require('./business')(db, appConfig, upload));
  router.use('/', require('./products')(db, appConfig, upload));
  router.use('/', require('./browse')(db, appConfig, upload));

  return router;
};
