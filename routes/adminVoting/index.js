// routes/adminVoting/index.js - Aggregates all adminVoting sub-routers
const express = require('express');

module.exports = function (db, appConfig, upload, saveConfig) {
  const router = express.Router();
  router.use('/', require('./judgeStatus')(db, appConfig, upload, saveConfig));
  router.use('/', require('./voteStatus')(db, appConfig, upload, saveConfig));
  router.use('/', require('./reports')(db, appConfig, upload));
  return router;
};
