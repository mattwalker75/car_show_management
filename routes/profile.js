// routes/profile.js - Shared profile routes for all roles
// Handles profile page, photo upload, email update, and password change.
// One implementation serves admin, judge, registrar, and user — eliminating 4x duplication.

const express = require('express');
const router = express.Router();

module.exports = function (db, appConfig, upload) {
  const { requireAuth, requireAdmin, requireJudge, requireRegistrar, requireVendor, hashPassword, verifyPassword } = require('../middleware/auth');
  const { handleProfilePhotoUpload } = require('../helpers/imageUpload');
  const { errorPage, successPage, getAppBackgroundStyles } = require('../views/layout');
  const { getInitials, getAvatarContent, adminNav, judgeNav, registrarNav, vendorNav, userNav } = require('../views/components');

  // Role-specific configuration: middleware, titles, nav, redirect paths
  const roleConfig = {
    admin: {
      middleware: requireAdmin,
      heading: 'Admin Dashboard',
      title: 'My Profile - Admin Dashboard',
      redirect: '/admin/dashboard',
      getNav: (activeTab, chatEnabled) => adminNav(activeTab, chatEnabled)
    },
    judge: {
      middleware: requireJudge,
      heading: 'Judge Dashboard',
      title: 'My Profile - Judge Dashboard',
      redirect: '/judge',
      getNav: (activeTab, chatEnabled) => judgeNav(activeTab, chatEnabled)
    },
    registrar: {
      middleware: requireRegistrar,
      heading: 'Registrar Dashboard',
      title: 'My Profile - Registrar Dashboard',
      redirect: '/registrar',
      getNav: (activeTab, chatEnabled) => registrarNav(activeTab, chatEnabled)
    },
    vendor: {
      middleware: requireVendor,
      heading: 'Vendor Dashboard',
      title: 'My Profile - Vendor',
      redirect: '/vendor',
      getNav: (activeTab, chatEnabled) => vendorNav(activeTab, chatEnabled)
    },
    user: {
      middleware: requireAuth,
      heading: 'Car Show Manager',
      title: 'My Profile',
      redirect: '/user',
      getNav: (activeTab, chatEnabled) => userNav(activeTab, chatEnabled)
    }
  };

  // Inline CSS for profile page (shared across all roles)
  const profileStyles = `
    <style>
      .profile-image-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        margin-bottom: 20px;
      }
      .profile-image, .profile-image-placeholder {
        width: 120px;
        height: 120px;
        border-radius: 50%;
        object-fit: cover;
        margin-bottom: 15px;
        border: 4px solid #e94560;
      }
      .profile-image-placeholder {
        background: linear-gradient(135deg, #e94560 0%, #ff6b6b 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 42px;
        font-weight: 700;
      }
      #updatePhotoBtn:hover {
        background: #d63851;
      }
    </style>`;

  // Register routes for each role
  Object.entries(roleConfig).forEach(([role, config]) => {

    // ==========================================
    // GET /{role}/profile — Show profile page
    // ==========================================
    router.get(`/${role}/profile`, config.middleware, (req, res) => {
      const user = req.session.user;
      const initials = getInitials(user.name);

      db.get('SELECT user_id as id, username, name, email, phone, image_url FROM users WHERE user_id = ?', [user.user_id], (err, currentUser) => {
        if (err || !currentUser) {
          res.redirect(config.redirect);
          return;
        }

        const avatarContent = currentUser.image_url
          ? `<img src="${currentUser.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
          : initials;

        const profileImageHtml = currentUser.image_url
          ? `<img src="${currentUser.image_url}" alt="Profile" class="profile-image">`
          : `<div class="profile-image-placeholder">${initials}</div>`;

        const nav = config.getNav('', (appConfig.chatEnabled !== false && req.session.user.chat_enabled));

        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>${config.title}</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            <link rel="stylesheet" href="/css/styles.css">
            <link rel="stylesheet" href="/css/admin.css">
            <script src="/js/configSubnav.js"></script>
            <script src="/socket.io/socket.io.js"></script>
            <script src="/js/notifications.js"></script>
        ${getAppBackgroundStyles(appConfig)}
            ${profileStyles}
          </head>
          <body data-user-role="${role}" data-user-id="${user.user_id}" data-user-name="${user.name}" data-user-image="${user.image_url || ''}">
            <div class="container dashboard-container">
              <div class="dashboard-header">
                <h1>🏎️ ${config.heading}</h1>
                <div class="user-info">
                  <div class="user-avatar">${avatarContent}</div>
                  <a href="/${role}/profile" class="profile-btn">Profile</a>
                  <a href="/logout" class="logout-btn">Sign Out</a>
                </div>
              </div>

              ${nav}

              <div class="profile-card">
                <h3>Profile Picture</h3>
                <div class="profile-image-container">
                  ${profileImageHtml}
                </div>
                <button type="button" id="updatePhotoBtn" style="display:block;width:100%;padding:12px;background:#e94560;color:white;border:none;border-radius:8px;font-size:16px;font-weight:600;cursor:pointer;">Update Photo</button>
                <div style="text-align:center;margin-top:6px;color:#999;font-size:12px;">(JPEG, PNG, GIF, or WebP - Max 5MB)</div>
                <input type="file" id="profilePhotoInput" accept="image/jpeg,image/png,image/gif,image/webp" style="display:none;">
                <div id="photoPreviewModal" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:1000;align-items:center;justify-content:center;">
                  <div style="background:white;border-radius:12px;padding:24px;max-width:320px;width:90%;text-align:center;">
                    <h4 style="margin:0 0 16px;color:#2c3e50;">Preview</h4>
                    <img id="photoPreviewImg" style="max-width:200px;max-height:200px;border-radius:8px;border:2px solid #e1e1e1;">
                    <div style="margin-top:16px;display:flex;gap:10px;justify-content:center;">
                      <button type="button" id="photoSaveBtn" style="padding:10px 28px;background:#27ae60;color:white;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;">Save</button>
                      <button type="button" id="photoCancelBtn" style="padding:10px 28px;background:#95a5a6;color:white;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;">Cancel</button>
                    </div>
                  </div>
                </div>
                <script src="/js/imageUpload.js"></script>
              </div>

              <div class="profile-card" style="padding:10px 20px;margin-top:-8px;margin-bottom:-8px;text-align:center;">
                <strong style="font-size:18px;">${currentUser.username}</strong>
              </div>

              <div class="profile-card">
                <h3>Update Email</h3>
                <form method="POST" action="/${role}/update-email">
                  <div class="form-group">
                    <label>Current Email</label>
                    <input type="email" value="${currentUser.email}" disabled>
                  </div>
                  <div class="form-group">
                    <label>New Email Address</label>
                    <input type="email" name="email" required placeholder="Enter new email">
                  </div>
                  <button type="submit">Update Email</button>
                </form>
              </div>

              <div class="profile-card">
                <h3>Change Password</h3>
                <form method="POST" action="/${role}/change-password">
                  <div class="form-group">
                    <label>Current Password</label>
                    <input type="password" name="current_password" required placeholder="Enter current password">
                  </div>
                  <div class="form-group">
                    <label>New Password</label>
                    <input type="password" name="new_password" required placeholder="Enter new password">
                  </div>
                  <div class="form-group">
                    <label>Confirm New Password</label>
                    <input type="password" name="confirm_password" required placeholder="Confirm new password">
                  </div>
                  <button type="submit">Change Password</button>
                </form>
              </div>

              <div class="links" style="margin-top:20px;">
                <a href="${config.redirect}">← Back to Dashboard</a>
              </div>
            </div>
          </body>
          </html>
        `);
      });
    });

    // ==========================================
    // POST /{role}/upload-photo — Profile photo upload
    // ==========================================
    router.post(`/${role}/upload-photo`, config.middleware, upload.single('profile_photo'), async (req, res) => {
      try {
        const user = req.session.user;

        if (!req.file) {
          return res.status(400).json({ success: false, error: 'Please select an image file.' });
        }

        const result = await handleProfilePhotoUpload(db, user.user_id, req.file);

        if (result.success) {
          req.session.user.image_url = result.imageUrl;
          res.json({ success: true, imageUrl: result.imageUrl });
        } else {
          res.status(400).json({ success: false, error: result.error });
        }
      } catch (err) {
        console.error('Error uploading profile photo:', err.message);
        res.status(500).json({ success: false, error: 'An unexpected error occurred.' });
      }
    });

    // ==========================================
    // POST /{role}/update-email — Email update
    // ==========================================
    router.post(`/${role}/update-email`, config.middleware, (req, res) => {
      const user = req.session.user;
      const { email } = req.body;

      db.run('UPDATE users SET email = ? WHERE user_id = ?', [email, user.user_id], function (err) {
        if (err) {
          console.error('Error updating email:', err.message);
          res.send(errorPage('Error updating email. Please try again.', `/${role}/profile`, 'Try Again'));
        } else {
          req.session.user.email = email;
          res.send(successPage('Email updated successfully!', `/${role}/profile`, 'Back to Profile'));
        }
      });
    });

    // ==========================================
    // POST /{role}/change-password — Password change
    // ==========================================
    router.post(`/${role}/change-password`, config.middleware, (req, res) => {
      const user = req.session.user;
      const { current_password, new_password, confirm_password } = req.body;

      db.get('SELECT password_hash FROM users WHERE user_id = ?', [user.user_id], async (err, row) => {
        if (err || !row) {
          return res.send(errorPage('Error retrieving user data.', `/${role}/profile`, 'Try Again'));
        }

        if (!await verifyPassword(current_password, row.password_hash)) {
          return res.send(errorPage('Current password is incorrect.', `/${role}/profile`, 'Try Again'));
        }

        if (new_password !== confirm_password) {
          return res.send(errorPage('New passwords do not match.', `/${role}/profile`, 'Try Again'));
        }

        const hashedPassword = await hashPassword(new_password);
        db.run('UPDATE users SET password_hash = ? WHERE user_id = ?', [hashedPassword, user.user_id], function (err) {
          if (err) {
            console.error('Error updating password:', err.message);
            res.send(errorPage('Error updating password. Please try again.', `/${role}/profile`, 'Try Again'));
          } else {
            res.send(successPage('Password changed successfully!', `/${role}/profile`, 'Back to Profile'));
          }
        });
      });
    });
  });

  return router;
};
