// routes/admin/dashboard.js - Admin dashboard route
const express = require('express');

module.exports = function (db, appConfig, upload) {
  const router = express.Router();
  const { requireAdmin } = require('../../middleware/auth');
  const {
    styles,
    adminStyles,
    getBodyTag,
    getAppBgStyles,
    getAdminNav,
    getAvatarContent,
    isChatEnabled,
    profileButton
  } = require('./shared');

  // ============================================================
  // Admin Dashboard - Stats overview
  // ============================================================
  router.get('/dashboard', requireAdmin, (req, res) => {
    const user = req.session.user;
    const avatarContent = getAvatarContent(user);

    db.all(`SELECT role, COUNT(*) as count FROM users WHERE is_active = 1 GROUP BY role`, (err, roleCounts) => {
      const stats = { admin: 0, judge: 0, registrar: 0, user: 0 };
      if (!err && roleCounts) {
        roleCounts.forEach(r => { stats[r.role] = r.count; });
      }

      db.get(`SELECT COUNT(*) as total, SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active FROM cars`, (err, carStats) => {
        if (err) carStats = { total: 0, active: 0 };
        const totalVehicles = carStats.total || 0;
        const activeVehicles = carStats.active || 0;
        const inactiveVehicles = totalVehicles - activeVehicles;

        const judgeStatus = appConfig.judgeVotingStatus || 'Close';
        const specialtyStatus = appConfig.specialtyVotingStatus || 'Close';

        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Admin Dashboard - Car Show Manager</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            ${styles}
            ${adminStyles}
        ${getAppBgStyles(appConfig)}
          </head>
          ${getBodyTag(req)}
            <div class="container dashboard-container">
              <div class="dashboard-header">
                <h1>Admin Dashboard</h1>
                <div class="user-info">
                  <div class="user-avatar">${avatarContent}</div>
                  ${profileButton('admin')}
                  <a href="/logout" class="logout-btn">Sign Out</a>
                </div>
              </div>

              <div class="welcome-card">
                <h2>Welcome, ${user.name}!</h2>
                <p>Manage users, judges, and system settings.</p>
              </div>

              ${getAdminNav('dashboard', isChatEnabled(appConfig, user))}

              <div class="stats-grid">
                <div class="stat-card">
                  <div class="stat-number">${stats.user}</div>
                  <div class="stat-label">Users</div>
                </div>
                <div class="stat-card">
                  <div class="stat-number">${stats.judge}</div>
                  <div class="stat-label">Judges</div>
                </div>
                <div class="stat-card">
                  <div class="stat-number">${stats.registrar}</div>
                  <div class="stat-label">Registrars</div>
                </div>
                <div class="stat-card">
                  <div class="stat-number">${activeVehicles}</div>
                  <div class="stat-label">Active Vehicles</div>
                </div>
                <div class="stat-card">
                  <div class="stat-number">${inactiveVehicles}</div>
                  <div class="stat-label">Pending Vehicles</div>
                </div>
                <div class="stat-card">
                  <div class="stat-number">${judgeStatus}</div>
                  <div class="stat-label">Judge Voting</div>
                </div>
                <div class="stat-card">
                  <div class="stat-number">${specialtyStatus}</div>
                  <div class="stat-label">Specialty Voting</div>
                </div>
              </div>
            </div>
          </body>
          </html>
        `);
      });
    });
  });

  return router;
};
