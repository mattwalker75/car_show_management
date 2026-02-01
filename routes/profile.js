// routes/profile.js - Shared profile routes for all roles
// Handles profile page, photo upload, email update, and password change.
// One implementation serves admin, judge, registrar, and user — eliminating 4x duplication.

const express = require('express');
const router = express.Router();

module.exports = function (db, appConfig, upload) {
  const { requireAuth, requireAdmin, requireJudge, requireRegistrar, requireVendor, hashPassword, verifyPassword } = require('../middleware/auth');
  const { handleProfilePhotoUpload } = require('../helpers/imageUpload');
  const { errorPage, successPage } = require('../views/layout');
  const { getAvatarContent, adminNav, judgeNav, registrarNav, vendorNav, userNav } = require('../views/components');

  // Role-specific configuration: middleware, titles, nav, redirect paths
  const roleConfig = {
    admin: {
      middleware: requireAdmin,
      heading: 'Admin Dashboard',
      title: 'My Profile - Admin Dashboard',
      redirect: '/admin/dashboard',
      getNav: (activeTab) => adminNav(activeTab)
    },
    judge: {
      middleware: requireJudge,
      heading: 'Judge Dashboard',
      title: 'My Profile - Judge Dashboard',
      redirect: '/judge',
      getNav: (activeTab) => judgeNav(activeTab)
    },
    registrar: {
      middleware: requireRegistrar,
      heading: 'Registrar Dashboard',
      title: 'My Profile - Registrar Dashboard',
      redirect: '/registrar',
      getNav: (activeTab) => registrarNav(activeTab)
    },
    vendor: {
      middleware: requireVendor,
      heading: 'Vendor Dashboard',
      title: 'My Profile - Vendor',
      redirect: '/vendor',
      getNav: (activeTab) => vendorNav(activeTab)
    },
    user: {
      middleware: requireAuth,
      heading: 'Car Show Manager',
      title: 'My Profile',
      redirect: '/user',
      getNav: (activeTab) => userNav(activeTab)
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
      .file-input-wrapper {
        position: relative;
        overflow: hidden;
        display: inline-block;
        width: 100%;
      }
      .file-input-wrapper input[type=file] {
        position: absolute;
        left: 0;
        top: 0;
        opacity: 0;
        width: 100%;
        height: 100%;
        cursor: pointer;
      }
      .file-input-label {
        display: block;
        padding: 14px 16px;
        background: #f8f9fa;
        border: 2px dashed #e1e1e1;
        border-radius: 12px;
        text-align: center;
        color: #666;
        font-size: 14px;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      .file-input-wrapper:hover .file-input-label {
        border-color: #e94560;
        background: #fff5f7;
      }
      .file-input-wrapper.has-file .file-input-label {
        border-color: #27ae60;
        background: rgba(39, 174, 96, 0.1);
        color: #27ae60;
      }
      .file-name {
        margin-top: 8px;
        font-size: 13px;
        color: #27ae60;
        text-align: center;
        font-weight: 600;
      }
    </style>`;

  // Register routes for each role
  Object.entries(roleConfig).forEach(([role, config]) => {

    // ==========================================
    // GET /{role}/profile — Show profile page
    // ==========================================
    router.get(`/${role}/profile`, config.middleware, (req, res) => {
      const user = req.session.user;
      const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

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

        const nav = config.getNav('');

        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>${config.title}</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            <link rel="stylesheet" href="/css/styles.css">
            <link rel="stylesheet" href="/css/admin.css">
            <script src="/js/configSubnav.js"></script>
            ${profileStyles}
          </head>
          <body>
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
                <form method="POST" action="/${role}/upload-photo" enctype="multipart/form-data">
                  <div class="form-group">
                    <div class="file-input-wrapper" id="fileWrapper">
                      <div class="file-input-label">
                        Click or tap to select an image<br>
                        <small>(JPEG, PNG, GIF, or WebP - Max 5MB)</small>
                      </div>
                      <input type="file" name="profile_photo" accept="image/jpeg,image/png,image/gif,image/webp" onchange="updateFileName(this)">
                    </div>
                    <div class="file-name" id="fileName"></div>
                    <img id="imagePreview" style="display:none;max-width:200px;max-height:200px;margin:10px auto 0;border-radius:8px;border:2px solid #e1e1e1;">
                  </div>
                  <button type="submit">Upload Photo</button>
                </form>
                <script src="/js/imageUpload.js"></script>
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
      const user = req.session.user;

      if (!req.file) {
        return res.send(errorPage('Please select an image file to upload.', `/${role}/profile`, 'Try Again'));
      }

      const result = await handleProfilePhotoUpload(db, user.user_id, req.file);

      if (result.success) {
        req.session.user.image_url = result.imageUrl;
        res.send(successPage('Profile photo uploaded successfully!', `/${role}/profile`, 'Back to Profile'));
      } else {
        res.send(errorPage(`Error saving photo: ${result.error}`, `/${role}/profile`, 'Try Again'));
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

      db.get('SELECT password_hash FROM users WHERE user_id = ?', [user.user_id], (err, row) => {
        if (err || !row) {
          return res.send(errorPage('Error retrieving user data.', `/${role}/profile`, 'Try Again'));
        }

        if (!verifyPassword(current_password, row.password_hash)) {
          return res.send(errorPage('Current password is incorrect.', `/${role}/profile`, 'Try Again'));
        }

        if (new_password !== confirm_password) {
          return res.send(errorPage('New passwords do not match.', `/${role}/profile`, 'Try Again'));
        }

        const hashedPassword = hashPassword(new_password);
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
