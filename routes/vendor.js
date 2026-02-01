// routes/vendor.js - Vendor dashboard and business info routes
// Provides a mocked-up vendor dashboard with placeholder sections.
const express = require('express');
const router = express.Router();

module.exports = function (db, appConfig, upload) {
  const { requireVendor } = require('../middleware/auth');
  const { getAvatarContent, vendorNav } = require('../views/components');

  const styles = '<link rel="stylesheet" href="/css/styles.css">';
  const adminStyles = '<link rel="stylesheet" href="/css/admin.css"><script src="/js/configSubnav.js"></script>';

  // ── Vendor Dashboard ───────────────────────────────────────────────
  router.get('/', requireVendor, (req, res) => {
    const user = req.session.user;
    const avatarContent = getAvatarContent(user);

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Vendor Dashboard - ${appConfig.appTitle || 'Car Show Manager'}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        ${styles}
        ${adminStyles}
        <style>
          .vendor-section {
            background: #f8f9fa;
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 16px;
            border: 1px solid #e1e1e1;
          }
          .vendor-section h4 {
            color: #1a1a2e;
            margin-bottom: 12px;
            font-size: 16px;
          }
          .vendor-placeholder {
            background: #fff3cd;
            border: 1px dashed #f39c12;
            border-radius: 8px;
            padding: 16px;
            text-align: center;
            color: #856404;
            font-size: 13px;
          }
        </style>
      </head>
      <body>
        <div class="container dashboard-container">
          <div class="dashboard-header">
            <h1>🏪 Vendor</h1>
            <div class="user-info">
              <div class="user-avatar">${avatarContent}</div>
              <a href="/vendor/profile" class="profile-btn">Profile</a>
              <a href="/logout" class="logout-btn">Sign Out</a>
            </div>
          </div>

          ${vendorNav('dashboard')}

          <div class="welcome-card">
            <h2>Welcome, ${user.name}!</h2>
            <p>Manage your vendor profile and business information.</p>
          </div>

          <div class="vendor-section">
            <h4>Business Information</h4>
            <div class="vendor-placeholder">
              Business profile editing coming soon. Contact an admin to update your vendor details.
            </div>
          </div>

          <div class="vendor-section">
            <h4>Products &amp; Services</h4>
            <div class="vendor-placeholder">
              Product and service listings coming soon. This section will allow you to showcase what you offer at the car show.
            </div>
          </div>

          <div class="vendor-section">
            <h4>Booth Information</h4>
            <div class="vendor-placeholder">
              Booth assignment and location details will appear here once configured by event administrators.
            </div>
          </div>
        </div>
      </body>
      </html>
    `);
  });

  return router;
};
