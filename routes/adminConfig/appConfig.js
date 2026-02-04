// routes/adminConfig/appConfig.js - App configuration and background image routes
const express = require('express');

module.exports = function (db, appConfig, upload, saveConfig) {
  const router = express.Router();
  const { requireAdmin } = require('../../middleware/auth');
  const { errorPage } = require('../../views/layout');
  const { handleBackgroundImageUpload, deleteBackgroundImage } = require('../../helpers/imageUpload');
  const {
    styles, adminStyles, getBodyTag, getAppBgStyles,
    getAvatarContent, getInitials, adminHeader, isChatEnabled, getAdminNav
  } = require('./shared');

  // Upload login background image
  router.post('/upload-login-background', requireAdmin, upload.single('backgroundImage'), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No image file selected.' });
    }
    try {
      if (!appConfig.loginBackground) appConfig.loginBackground = {};
      const oldImageUrl = appConfig.loginBackground.imageUrl || null;
      const result = await handleBackgroundImageUpload(req.file, oldImageUrl);
      if (result.success) {
        appConfig.loginBackground.imageUrl = result.imageUrl;
        appConfig.loginBackground.useImage = true;
        saveConfig();
        res.json({ success: true, imageUrl: result.imageUrl });
      } else {
        res.status(400).json({ success: false, error: result.error });
      }
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Remove login background image
  router.post('/remove-login-background', requireAdmin, (req, res) => {
    if (appConfig.loginBackground && appConfig.loginBackground.imageUrl) {
      deleteBackgroundImage(appConfig.loginBackground.imageUrl);
      appConfig.loginBackground.imageUrl = '';
      appConfig.loginBackground.useImage = false;
      saveConfig();
    }
    res.redirect('/admin/app-config?saved=1');
  });

  // Upload app background image
  router.post('/upload-app-background', requireAdmin, upload.single('appBackgroundImage'), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No image file selected.' });
    }
    try {
      if (!appConfig.appBackground) appConfig.appBackground = {};
      const oldImageUrl = appConfig.appBackground.imageUrl || null;
      const result = await handleBackgroundImageUpload(req.file, oldImageUrl);
      if (result.success) {
        appConfig.appBackground.imageUrl = result.imageUrl;
        appConfig.appBackground.useImage = true;
        saveConfig();
        res.json({ success: true, imageUrl: result.imageUrl });
      } else {
        res.status(400).json({ success: false, error: result.error });
      }
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Remove app background image
  router.post('/remove-app-background', requireAdmin, (req, res) => {
    if (appConfig.appBackground && appConfig.appBackground.imageUrl) {
      deleteBackgroundImage(appConfig.appBackground.imageUrl);
      appConfig.appBackground.imageUrl = '';
      appConfig.appBackground.useImage = false;
      saveConfig();
    }
    res.redirect('/admin/app-config?saved=1');
  });

  // App config page
  router.get('/app-config', requireAdmin, (req, res) => {
    const user = req.session.user;
    const chatEnabled = isChatEnabled(appConfig, user);
    const avatarContent = getAvatarContent(user);

    const saved = req.query.saved === '1';
    const bg = appConfig.loginBackground || {
      useImage: false, imageUrl: '', backgroundColor: '#1a1a2e',
      useTint: false, tintColor: '#1a1a2e', tintOpacity: 0.5, cardOpacity: 0.98
    };
    const abg = appConfig.appBackground || {
      useImage: false, imageUrl: '', backgroundColor: '#1a1a2e',
      useTint: false, tintColor: '#1a1a2e', tintOpacity: 0.5, containerOpacity: 0.98
    };

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>App Config - Admin</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        ${styles}
        ${adminStyles}
        ${getAppBgStyles(appConfig)}
      </head>
      ${getBodyTag(req)}
        <div class="container dashboard-container">
          ${adminHeader(user)}
          ${getAdminNav('config', chatEnabled)}

          <h3 class="section-title">Application Configuration</h3>

          ${saved ? '<div class="success-message" style="max-width: 600px; margin-bottom: 20px;">Configuration saved successfully!</div>' : ''}

          <form method="POST" action="/admin/app-config" style="max-width: 600px;">
            <div class="form-group">
              <label>Application Title</label>
              <input type="text" name="appTitle" value="${appConfig.appTitle || ''}" required placeholder="Enter application title">
              <small style="color: #666; display: block; margin-top: 5px;">This appears on the login page</small>
            </div>
            <div class="form-group">
              <label>Login Subtitle</label>
              <input type="text" name="appSubtitle" value="${appConfig.appSubtitle || ''}" placeholder="Enter subtitle (optional)">
              <small style="color: #666; display: block; margin-top: 5px;">Appears below the title on the login page</small>
            </div>
            <div style="border-top:3px solid #000;margin:20px 0;"></div>
            <div class="form-group">
              <label>Default Registration Price</label>
              <div style="display:flex;align-items:center;gap:4px;">
                <span style="font-weight:600;font-size:16px;">$</span>
                <input type="text" name="defaultRegistrationPrice" value="${parseFloat(appConfig.defaultRegistrationPrice || 25).toFixed(2)}" required style="flex:1;" oninput="validatePriceInput(this)" onblur="formatPriceBlur(this)">
              </div>
              <small style="color: #666; display: block; margin-top: 5px;">Default price when creating new vehicle types</small>
            </div>
            <div style="margin-bottom:10px;">
              <label style="font-weight:600;margin-bottom:8px;display:block;">Default Judging Points</label>
              <small style="color: #666; display: block; margin-bottom: 10px;">Default min and max score values when adding new judging questions</small>
              <div style="display:flex;gap:15px;flex-wrap:wrap;">
                <div class="form-group" style="flex:0;min-width:80px;">
                  <label>Min Score</label>
                  <input type="text" name="defaultMinScore" value="${appConfig.defaultMinScore ?? 0}" required maxlength="2" style="width:60px;" oninput="this.value=this.value.replace(/[^0-9]/g,'')" onblur="if(this.value==='')this.value='0'">
                </div>
                <div class="form-group" style="flex:0;min-width:80px;">
                  <label>Max Score</label>
                  <input type="text" name="defaultMaxScore" value="${appConfig.defaultMaxScore ?? 10}" required maxlength="2" style="width:60px;" oninput="this.value=this.value.replace(/[^0-9]/g,'')" onblur="if(this.value==='')this.value='0'">
                </div>
              </div>
            </div>
            <div style="border-top:3px solid #000;margin:20px 0;"></div>
            <div style="margin-bottom:10px;">
              <label style="font-weight:600;margin-bottom:8px;display:block;">Group Chat</label>
              <small style="color: #666; display: block; margin-bottom: 12px;">Enable or disable the group chat feature for all users</small>
              <div style="display:flex;align-items:center;gap:12px;">
                <label class="toggle-switch" style="position:relative;display:inline-block;width:50px;height:26px;margin:0;cursor:pointer;">
                  <input type="hidden" name="chatEnabled" value="${appConfig.chatEnabled !== false ? 'true' : 'false'}" id="chatEnabledInput">
                  <div id="chatToggleTrack" style="position:absolute;top:0;left:0;right:0;bottom:0;background:${appConfig.chatEnabled !== false ? '#27ae60' : '#ccc'};border-radius:26px;transition:0.3s;" onclick="toggleChat()"></div>
                  <div id="chatToggleThumb" style="position:absolute;height:20px;width:20px;left:${appConfig.chatEnabled !== false ? '27px' : '3px'};bottom:3px;background:white;border-radius:50%;transition:0.3s;pointer-events:none;box-shadow:0 1px 3px rgba(0,0,0,0.2);"></div>
                </label>
                <span style="font-size:14px;color:#333;" id="chatToggleLabel">${appConfig.chatEnabled !== false ? 'Enabled' : 'Disabled'} Group Chat</span>
              </div>
              <div style="margin-top:15px;">
                <label style="font-size:14px;color:#333;">Chat Message Limit</label>
                <small style="color: #666; display: block; margin-bottom: 8px;">Maximum number of messages to keep in chat history (older messages are automatically deleted)</small>
                <input type="number" name="chatMessageLimit" value="${appConfig.chatMessageLimit || 200}" min="50" max="10000" style="width:120px;padding:8px 12px;border:2px solid #e1e1e1;border-radius:8px;font-size:14px;">
              </div>
            </div>
            <div style="border-top:3px solid #000;margin:20px 0;"></div>
            <div style="margin-bottom:10px;">
              <label style="font-weight:600;margin-bottom:8px;display:block;">Login Configuration</label>
              <small style="color: #666; display: block; margin-bottom: 12px;">Control the login experience for all users</small>
              <div style="display:flex;align-items:center;gap:12px;">
                <label class="toggle-switch" style="position:relative;display:inline-block;width:50px;height:26px;margin:0;cursor:pointer;">
                  <input type="hidden" name="animatedLogin" value="${appConfig.animatedLogin ? 'true' : 'false'}" id="animatedLoginInput">
                  <div id="toggleTrack" style="position:absolute;top:0;left:0;right:0;bottom:0;background:${appConfig.animatedLogin ? '#27ae60' : '#ccc'};border-radius:26px;transition:0.3s;" onclick="toggleAnimatedLogin()"></div>
                  <div id="toggleThumb" style="position:absolute;height:20px;width:20px;left:${appConfig.animatedLogin ? '27px' : '3px'};bottom:3px;background:white;border-radius:50%;transition:0.3s;pointer-events:none;box-shadow:0 1px 3px rgba(0,0,0,0.2);"></div>
                </label>
                <span style="font-size:14px;color:#333;" id="toggleLabel">${appConfig.animatedLogin ? 'Enabled' : 'Disabled'} Animated Login Experience</span>
              </div>
            </div>

            <div style="margin-top:10px;margin-bottom:10px;border-top:1px solid #e1e1e1;padding-top:15px;">
              <label style="font-weight:600;margin-bottom:8px;display:block;">Login Background Customization</label>
              <small style="color: #666; display: block; margin-bottom: 15px;">Customize the appearance of the login page</small>

              <!-- Background Type Selector -->
              <div class="form-group" style="margin-bottom:15px;">
                <label>Background Type</label>
                <div style="display:flex;gap:10px;margin-top:6px;">
                  <button type="button" id="btnSolidColor" onclick="setBgType('color')"
                    style="flex:1;padding:10px;border:2px solid ${bg.useImage ? '#e1e1e1' : '#e94560'};border-radius:8px;background:${bg.useImage ? '#f8f9fa' : '#fff0f3'};cursor:pointer;font-weight:600;color:${bg.useImage ? '#666' : '#e94560'};">
                    Solid Color
                  </button>
                  <button type="button" id="btnBgImage" onclick="setBgType('image')"
                    style="flex:1;padding:10px;border:2px solid ${bg.useImage ? '#e94560' : '#e1e1e1'};border-radius:8px;background:${bg.useImage ? '#fff0f3' : '#f8f9fa'};cursor:pointer;font-weight:600;color:${bg.useImage ? '#e94560' : '#666'};">
                    Background Image
                  </button>
                </div>
                <input type="hidden" name="loginBgUseImage" id="loginBgUseImage" value="${bg.useImage ? 'true' : 'false'}">
              </div>

              <!-- Solid Color Section -->
              <div id="solidColorSection" style="display:${bg.useImage ? 'none' : 'block'};margin-bottom:15px;">
                <label>Background Color</label>
                <div style="display:flex;align-items:center;gap:12px;margin-top:6px;">
                  <input type="color" name="loginBgColor" id="loginBgColor" value="${bg.backgroundColor || '#1a1a2e'}"
                    style="width:60px;height:40px;border:2px solid #e1e1e1;border-radius:8px;cursor:pointer;padding:2px;">
                  <span id="loginBgColorHex" style="font-family:monospace;color:#666;">${bg.backgroundColor || '#1a1a2e'}</span>
                </div>
              </div>

              <!-- Background Image Section -->
              <div id="bgImageSection" style="display:${bg.useImage ? 'block' : 'none'};margin-bottom:15px;">
                ${bg.imageUrl ? `
                <div style="margin-bottom:12px;">
                  <label>Current Background</label>
                  <div style="position:relative;width:200px;height:120px;border-radius:8px;overflow:hidden;border:2px solid #e1e1e1;margin-top:6px;">
                    <img src="${bg.imageUrl}" style="width:100%;height:100%;object-fit:cover;">
                  </div>
                </div>
                ` : ''}
                <label>${bg.imageUrl ? 'Replace' : 'Upload'} Background Image</label>
                <small style="color:#666;display:block;margin-bottom:8px;">Recommended: 1920x1080 or larger. JPEG, PNG, GIF, or WebP.</small>
                <!-- Placeholder - upload forms will be moved here by JS -->
                <div id="bgImageUploadArea" style="margin-top:8px;"></div>
              </div>
            </div>

            <!-- Tint Overlay (only when image mode) -->
            <div id="tintSection" style="display:${bg.useImage ? 'block' : 'none'};margin-bottom:15px;border-top:1px solid #e1e1e1;padding-top:15px;">
              <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
                <label class="toggle-switch" style="position:relative;display:inline-block;width:50px;height:26px;margin:0;cursor:pointer;">
                  <input type="hidden" name="loginBgUseTint" value="${bg.useTint ? 'true' : 'false'}" id="loginBgUseTintInput">
                  <div id="tintToggleTrack" style="position:absolute;top:0;left:0;right:0;bottom:0;background:${bg.useTint ? '#27ae60' : '#ccc'};border-radius:26px;transition:0.3s;" onclick="toggleTint()"></div>
                  <div id="tintToggleThumb" style="position:absolute;height:20px;width:20px;left:${bg.useTint ? '27px' : '3px'};bottom:3px;background:white;border-radius:50%;transition:0.3s;pointer-events:none;box-shadow:0 1px 3px rgba(0,0,0,0.2);"></div>
                </label>
                <span style="font-size:14px;color:#333;font-weight:600;">Color Tint Overlay</span>
              </div>
              <div id="tintControls" style="display:${bg.useTint ? 'block' : 'none'};">
                <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
                  <label style="margin-bottom:0;min-width:70px;">Tint Color</label>
                  <input type="color" name="loginBgTintColor" id="loginBgTintColor" value="${bg.tintColor || '#1a1a2e'}"
                    style="width:60px;height:40px;border:2px solid #e1e1e1;border-radius:8px;cursor:pointer;padding:2px;">
                  <span id="tintColorHex" style="font-family:monospace;color:#666;">${bg.tintColor || '#1a1a2e'}</span>
                </div>
                <div style="display:flex;align-items:center;gap:12px;">
                  <label style="margin-bottom:0;min-width:70px;">Opacity</label>
                  <input type="range" name="loginBgTintOpacity" id="loginBgTintOpacity" min="0" max="100" value="${Math.round((bg.tintOpacity ?? 0.5) * 100)}"
                    style="flex:1;" oninput="document.getElementById('tintOpacityValue').textContent=this.value+'%'; updatePreview();">
                  <span id="tintOpacityValue" style="font-family:monospace;color:#666;min-width:40px;">${Math.round((bg.tintOpacity ?? 0.5) * 100)}%</span>
                </div>
              </div>
            </div>

            <!-- Card Transparency -->
            <div style="margin-bottom:15px;border-top:1px solid #e1e1e1;padding-top:15px;">
              <label style="font-weight:600;margin-bottom:8px;display:block;">Login Card Transparency</label>
              <small style="color:#666;display:block;margin-bottom:10px;">Controls how see-through the login card is (100% = fully solid, 0% = fully transparent)</small>
              <div style="display:flex;align-items:center;gap:12px;">
                <input type="range" name="loginBgCardOpacity" id="loginBgCardOpacity" min="0" max="100" value="${Math.round((bg.cardOpacity ?? 0.98) * 100)}"
                  style="flex:1;" oninput="document.getElementById('cardOpacityValue').textContent=this.value+'%'; updatePreview();">
                <span id="cardOpacityValue" style="font-family:monospace;color:#666;min-width:40px;">${Math.round((bg.cardOpacity ?? 0.98) * 100)}%</span>
              </div>
            </div>

            <!-- Live Preview -->
            <div style="margin-bottom:20px;border-top:1px solid #e1e1e1;padding-top:15px;">
              <label style="font-weight:600;margin-bottom:8px;display:block;">Live Preview</label>
              <div id="previewPanel" data-has-image="${bg.useImage && bg.imageUrl ? 'true' : 'false'}" style="position:relative;width:100%;max-width:400px;height:250px;border-radius:12px;overflow:hidden;border:2px solid #e1e1e1;${bg.useImage && bg.imageUrl ? `background:url('${bg.imageUrl}') center/cover no-repeat` : `background:${bg.backgroundColor || '#1a1a2e'}`};">
                <div id="previewTint" style="position:absolute;top:0;left:0;width:100%;height:100%;background:${bg.tintColor || '#1a1a2e'};opacity:${bg.useImage && bg.useTint ? (bg.tintOpacity ?? 0.5) : 0};pointer-events:none;"></div>
                <div id="previewCard" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:60%;background:rgba(255,255,255,${bg.cardOpacity ?? 0.98});border-radius:10px;padding:15px;text-align:center;box-shadow:0 4px 15px rgba(0,0,0,0.2);">
                  <div style="font-size:28px;margin-bottom:4px;">🏎️</div>
                  <div style="font-size:11px;font-weight:700;color:#1a1a2e;margin-bottom:8px;">${appConfig.appTitle || 'Car Show'}</div>
                  <div style="width:80%;height:6px;background:#e1e1e1;border-radius:3px;margin:4px auto;"></div>
                  <div style="width:80%;height:6px;background:#e1e1e1;border-radius:3px;margin:4px auto;"></div>
                  <div style="width:50%;height:8px;background:linear-gradient(135deg,#e94560,#ff6b6b);border-radius:4px;margin:8px auto 0;"></div>
                </div>
              </div>
            </div>

            <div style="border-top:3px solid #000;margin:20px 0;"></div>

            <!-- App Background Customization -->
            <div style="margin-bottom:10px;">
              <label style="font-weight:600;margin-bottom:8px;display:block;">App Background Customization</label>
              <small style="color: #666; display: block; margin-bottom: 15px;">Customize the background appearance of the app after login</small>

              <!-- Background Type Selector -->
              <div class="form-group" style="margin-bottom:15px;">
                <label>Background Type</label>
                <div style="display:flex;gap:10px;margin-top:6px;">
                  <button type="button" id="btnAppSolidColor" onclick="setAppBgType('color')"
                    style="flex:1;padding:10px;border:2px solid ${abg.useImage ? '#e1e1e1' : '#e94560'};border-radius:8px;background:${abg.useImage ? '#f8f9fa' : '#fff0f3'};cursor:pointer;font-weight:600;color:${abg.useImage ? '#666' : '#e94560'};">
                    Solid Color
                  </button>
                  <button type="button" id="btnAppBgImage" onclick="setAppBgType('image')"
                    style="flex:1;padding:10px;border:2px solid ${abg.useImage ? '#e94560' : '#e1e1e1'};border-radius:8px;background:${abg.useImage ? '#fff0f3' : '#f8f9fa'};cursor:pointer;font-weight:600;color:${abg.useImage ? '#e94560' : '#666'};">
                    Background Image
                  </button>
                </div>
                <input type="hidden" name="appBgUseImage" id="appBgUseImage" value="${abg.useImage ? 'true' : 'false'}">
              </div>

              <!-- Solid Color Section -->
              <div id="appSolidColorSection" style="display:${abg.useImage ? 'none' : 'block'};margin-bottom:15px;">
                <label>Background Color</label>
                <div style="display:flex;align-items:center;gap:12px;margin-top:6px;">
                  <input type="color" name="appBgColor" id="appBgColor" value="${abg.backgroundColor || '#1a1a2e'}"
                    style="width:60px;height:40px;border:2px solid #e1e1e1;border-radius:8px;cursor:pointer;padding:2px;">
                  <span id="appBgColorHex" style="font-family:monospace;color:#666;">${abg.backgroundColor || '#1a1a2e'}</span>
                </div>
              </div>

              <!-- Background Image Section -->
              <div id="appBgImageSection" style="display:${abg.useImage ? 'block' : 'none'};margin-bottom:15px;">
                ${abg.imageUrl ? `
                <div style="margin-bottom:12px;">
                  <label>Current Background</label>
                  <div style="position:relative;width:200px;height:120px;border-radius:8px;overflow:hidden;border:2px solid #e1e1e1;margin-top:6px;">
                    <img src="${abg.imageUrl}" style="width:100%;height:100%;object-fit:cover;">
                  </div>
                </div>
                ` : ''}
                <label>${abg.imageUrl ? 'Replace' : 'Upload'} Background Image</label>
                <small style="color:#666;display:block;margin-bottom:8px;">Recommended: 1920x1080 or larger. JPEG, PNG, GIF, or WebP.</small>
                <div id="appBgImageUploadArea" style="margin-top:8px;"></div>
              </div>
            </div>

            <!-- App Tint Overlay (only when image mode) -->
            <div id="appTintSection" style="display:${abg.useImage ? 'block' : 'none'};margin-bottom:15px;border-top:1px solid #e1e1e1;padding-top:15px;">
              <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
                <label class="toggle-switch" style="position:relative;display:inline-block;width:50px;height:26px;margin:0;cursor:pointer;">
                  <input type="hidden" name="appBgUseTint" value="${abg.useTint ? 'true' : 'false'}" id="appBgUseTintInput">
                  <div id="appTintToggleTrack" style="position:absolute;top:0;left:0;right:0;bottom:0;background:${abg.useTint ? '#27ae60' : '#ccc'};border-radius:26px;transition:0.3s;" onclick="toggleAppTint()"></div>
                  <div id="appTintToggleThumb" style="position:absolute;height:20px;width:20px;left:${abg.useTint ? '27px' : '3px'};bottom:3px;background:white;border-radius:50%;transition:0.3s;pointer-events:none;box-shadow:0 1px 3px rgba(0,0,0,0.2);"></div>
                </label>
                <span style="font-size:14px;color:#333;font-weight:600;">Color Tint Overlay</span>
              </div>
              <div id="appTintControls" style="display:${abg.useTint ? 'block' : 'none'};">
                <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
                  <label style="margin-bottom:0;min-width:70px;">Tint Color</label>
                  <input type="color" name="appBgTintColor" id="appBgTintColor" value="${abg.tintColor || '#1a1a2e'}"
                    style="width:60px;height:40px;border:2px solid #e1e1e1;border-radius:8px;cursor:pointer;padding:2px;">
                  <span id="appTintColorHex" style="font-family:monospace;color:#666;">${abg.tintColor || '#1a1a2e'}</span>
                </div>
                <div style="display:flex;align-items:center;gap:12px;">
                  <label style="margin-bottom:0;min-width:70px;">Opacity</label>
                  <input type="range" name="appBgTintOpacity" id="appBgTintOpacity" min="0" max="100" value="${Math.round((abg.tintOpacity ?? 0.5) * 100)}"
                    style="flex:1;" oninput="document.getElementById('appTintOpacityValue').textContent=this.value+'%'; updateAppPreview();">
                  <span id="appTintOpacityValue" style="font-family:monospace;color:#666;min-width:40px;">${Math.round((abg.tintOpacity ?? 0.5) * 100)}%</span>
                </div>
              </div>
            </div>

            <!-- App Container Transparency -->
            <div style="margin-bottom:15px;border-top:1px solid #e1e1e1;padding-top:15px;">
              <label style="font-weight:600;margin-bottom:8px;display:block;">App Window Transparency</label>
              <small style="color:#666;display:block;margin-bottom:10px;">Controls how see-through the app window is (100% = fully solid, 0% = fully transparent)</small>
              <div style="display:flex;align-items:center;gap:12px;">
                <input type="range" name="appBgContainerOpacity" id="appBgContainerOpacity" min="0" max="100" value="${Math.round((abg.containerOpacity ?? 0.98) * 100)}"
                  style="flex:1;" oninput="document.getElementById('appContainerOpacityValue').textContent=this.value+'%'; updateAppPreview();">
                <span id="appContainerOpacityValue" style="font-family:monospace;color:#666;min-width:40px;">${Math.round((abg.containerOpacity ?? 0.98) * 100)}%</span>
              </div>
            </div>

            <!-- App Live Preview -->
            <div style="margin-bottom:20px;border-top:1px solid #e1e1e1;padding-top:15px;">
              <label style="font-weight:600;margin-bottom:8px;display:block;">Live Preview</label>
              <div id="appPreviewPanel" data-has-image="${abg.useImage && abg.imageUrl ? 'true' : 'false'}" style="position:relative;width:100%;max-width:400px;height:250px;border-radius:12px;overflow:hidden;border:2px solid #e1e1e1;${abg.useImage && abg.imageUrl ? `background:url('${abg.imageUrl}') center/cover no-repeat` : `background:${abg.backgroundColor || '#1a1a2e'}`};">
                <div id="appPreviewTint" style="position:absolute;top:0;left:0;width:100%;height:100%;background:${abg.tintColor || '#1a1a2e'};opacity:${abg.useImage && abg.useTint ? (abg.tintOpacity ?? 0.5) : 0};pointer-events:none;"></div>
                <div id="appPreviewCard" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:80%;background:rgba(255,255,255,${abg.containerOpacity ?? 0.98});border-radius:10px;padding:15px;box-shadow:0 4px 15px rgba(0,0,0,0.2);">
                  <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
                    <div style="font-size:16px;">🏎️</div>
                    <div style="font-size:11px;font-weight:700;color:#1a1a2e;">Dashboard</div>
                    <div style="margin-left:auto;width:20px;height:20px;background:#e1e1e1;border-radius:50%;"></div>
                  </div>
                  <div style="display:flex;gap:6px;margin-bottom:10px;">
                    <div style="flex:1;height:6px;background:linear-gradient(135deg,#e94560,#ff6b6b);border-radius:3px;"></div>
                    <div style="flex:1;height:6px;background:#e1e1e1;border-radius:3px;"></div>
                    <div style="flex:1;height:6px;background:#e1e1e1;border-radius:3px;"></div>
                  </div>
                  <div style="width:100%;height:8px;background:#f0f0f0;border-radius:3px;margin:4px 0;"></div>
                  <div style="width:70%;height:8px;background:#f0f0f0;border-radius:3px;margin:4px 0;"></div>
                </div>
              </div>
            </div>

            <button type="submit" style="background: #27ae60; color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; font-size: 16px;">Save Configuration</button>
          </form>

          <!-- Login background image upload/remove (outside main form to avoid nesting) -->
          <div id="bgImageUploadForm" style="display:${bg.useImage ? 'block' : 'none'};max-width:600px;margin-top:15px;">
            <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
              <button type="button" id="loginBgUploadBtn" style="background:#3498db;color:white;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;font-weight:600;white-space:nowrap;font-size:14px;">Update Image</button>
              ${bg.imageUrl ? `
              <form method="POST" action="/admin/remove-login-background" style="margin:0;">
                <button type="submit" style="background:#e74c3c;color:white;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;font-weight:600;white-space:nowrap;text-transform:none;letter-spacing:normal;font-size:14px;min-height:auto;">Remove Image</button>
              </form>
              ` : ''}
            </div>
            <div style="margin-top:4px;color:#999;font-size:12px;">(JPEG, PNG, GIF, or WebP - Max 5MB)</div>
            <input type="file" id="loginBgFileInput" accept="image/jpeg,image/png,image/gif,image/webp" style="display:none;">
            <div id="loginBgPreviewModal" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:1000;align-items:center;justify-content:center;">
              <div style="background:white;border-radius:12px;padding:24px;max-width:400px;width:90%;text-align:center;">
                <h4 style="margin:0 0 16px;color:#2c3e50;">Preview Login Background</h4>
                <img id="loginBgPreviewImg" style="max-width:350px;max-height:250px;border-radius:8px;border:2px solid #e1e1e1;">
                <div style="margin-top:16px;display:flex;gap:10px;justify-content:center;">
                  <button type="button" id="loginBgSaveBtn" style="padding:10px 28px;background:#27ae60;color:white;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;">Save</button>
                  <button type="button" id="loginBgCancelBtn" style="padding:10px 28px;background:#95a5a6;color:white;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;">Cancel</button>
                </div>
              </div>
            </div>
          </div>

          <!-- App background image upload/remove (outside main form to avoid nesting) -->
          <div id="appBgImageUploadForm" style="display:${abg.useImage ? 'block' : 'none'};max-width:600px;margin-top:15px;">
            <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
              <button type="button" id="appBgUploadBtn" style="background:#3498db;color:white;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;font-weight:600;white-space:nowrap;font-size:14px;">Update Image</button>
              ${abg.imageUrl ? `
              <form method="POST" action="/admin/remove-app-background" style="margin:0;">
                <button type="submit" style="background:#e74c3c;color:white;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;font-weight:600;white-space:nowrap;text-transform:none;letter-spacing:normal;font-size:14px;min-height:auto;">Remove Image</button>
              </form>
              ` : ''}
            </div>
            <div style="margin-top:4px;color:#999;font-size:12px;">(JPEG, PNG, GIF, or WebP - Max 5MB)</div>
            <input type="file" id="appBgFileInput" accept="image/jpeg,image/png,image/gif,image/webp" style="display:none;">
            <div id="appBgPreviewModal" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:1000;align-items:center;justify-content:center;">
              <div style="background:white;border-radius:12px;padding:24px;max-width:400px;width:90%;text-align:center;">
                <h4 style="margin:0 0 16px;color:#2c3e50;">Preview App Background</h4>
                <img id="appBgPreviewImg" style="max-width:350px;max-height:250px;border-radius:8px;border:2px solid #e1e1e1;">
                <div style="margin-top:16px;display:flex;gap:10px;justify-content:center;">
                  <button type="button" id="appBgSaveBtn" style="padding:10px 28px;background:#27ae60;color:white;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;">Save</button>
                  <button type="button" id="appBgCancelBtn" style="padding:10px 28px;background:#95a5a6;color:white;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;">Cancel</button>
                </div>
              </div>
            </div>
          </div>

          <div class="links" style="margin-top:20px;">
            <a href="/admin/dashboard">&larr; Back to Dashboard</a>
          </div>
        </div>
        <script>
          function validatePriceInput(el) {
            var val = el.value.replace(/[^0-9.]/g, '');
            var parts = val.split('.');
            if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');
            if (parts.length === 2 && parts[1].length > 2) val = parts[0] + '.' + parts[1].substring(0, 2);
            el.value = val;
          }
          function formatPriceBlur(el) {
            var num = parseFloat(el.value);
            if (!isNaN(num) && num >= 0) {
              el.value = num.toFixed(2);
            } else if (el.value === '') {
              el.value = '0.00';
            }
          }
          function toggleAnimatedLogin() {
            var input = document.getElementById('animatedLoginInput');
            var track = document.getElementById('toggleTrack');
            var thumb = document.getElementById('toggleThumb');
            var label = document.getElementById('toggleLabel');
            var isOn = input.value === 'true';
            input.value = isOn ? 'false' : 'true';
            track.style.background = isOn ? '#ccc' : '#27ae60';
            thumb.style.left = isOn ? '3px' : '27px';
            label.textContent = isOn ? 'Disabled Animated Login Experience' : 'Enabled Animated Login Experience';
          }
          function toggleChat() {
            var input = document.getElementById('chatEnabledInput');
            var track = document.getElementById('chatToggleTrack');
            var thumb = document.getElementById('chatToggleThumb');
            var label = document.getElementById('chatToggleLabel');
            var isOn = input.value === 'true';
            input.value = isOn ? 'false' : 'true';
            track.style.background = isOn ? '#ccc' : '#27ae60';
            thumb.style.left = isOn ? '3px' : '27px';
            label.textContent = isOn ? 'Disabled Group Chat' : 'Enabled Group Chat';
          }
          function setBgType(type) {
            var isImage = type === 'image';
            document.getElementById('loginBgUseImage').value = isImage ? 'true' : 'false';
            document.getElementById('solidColorSection').style.display = isImage ? 'none' : 'block';
            document.getElementById('bgImageSection').style.display = isImage ? 'block' : 'none';
            document.getElementById('bgImageUploadForm').style.display = isImage ? 'block' : 'none';
            document.getElementById('tintSection').style.display = isImage ? 'block' : 'none';
            var btnColor = document.getElementById('btnSolidColor');
            var btnImage = document.getElementById('btnBgImage');
            btnColor.style.borderColor = isImage ? '#e1e1e1' : '#e94560';
            btnColor.style.background = isImage ? '#f8f9fa' : '#fff0f3';
            btnColor.style.color = isImage ? '#666' : '#e94560';
            btnImage.style.borderColor = isImage ? '#e94560' : '#e1e1e1';
            btnImage.style.background = isImage ? '#fff0f3' : '#f8f9fa';
            btnImage.style.color = isImage ? '#e94560' : '#666';
            updatePreview();
          }
          function toggleTint() {
            var input = document.getElementById('loginBgUseTintInput');
            var track = document.getElementById('tintToggleTrack');
            var thumb = document.getElementById('tintToggleThumb');
            var controls = document.getElementById('tintControls');
            var isOn = input.value === 'true';
            input.value = isOn ? 'false' : 'true';
            track.style.background = isOn ? '#ccc' : '#27ae60';
            thumb.style.left = isOn ? '3px' : '27px';
            controls.style.display = isOn ? 'none' : 'block';
            updatePreview();
          }
          function updatePreview() {
            var panel = document.getElementById('previewPanel');
            var tint = document.getElementById('previewTint');
            var card = document.getElementById('previewCard');
            var isImage = document.getElementById('loginBgUseImage').value === 'true';
            var bgColor = document.getElementById('loginBgColor').value;
            var useTint = document.getElementById('loginBgUseTintInput').value === 'true';
            var tintColor = document.getElementById('loginBgTintColor').value;
            var tintOpacity = parseInt(document.getElementById('loginBgTintOpacity').value) / 100;
            var cardOpacity = parseInt(document.getElementById('loginBgCardOpacity').value) / 100;
            if (isImage && panel.dataset.hasImage === 'true') {
              // keep image background
            } else if (!isImage) {
              panel.style.backgroundImage = 'none';
              panel.style.backgroundColor = bgColor;
            }
            tint.style.background = tintColor;
            tint.style.opacity = (isImage && useTint) ? tintOpacity : 0;
            card.style.background = 'rgba(255,255,255,' + cardOpacity + ')';
          }
          document.getElementById('loginBgColor').addEventListener('input', function() {
            document.getElementById('loginBgColorHex').textContent = this.value;
            updatePreview();
          });
          document.getElementById('loginBgTintColor').addEventListener('input', function() {
            document.getElementById('tintColorHex').textContent = this.value;
            updatePreview();
          });
          // Move upload forms into the background image section (avoids nested forms)
          var uploadForm = document.getElementById('bgImageUploadForm');
          var uploadArea = document.getElementById('bgImageUploadArea');
          if (uploadForm && uploadArea) {
            uploadArea.appendChild(uploadForm);
          }
          // Move app background upload forms
          var appUploadForm = document.getElementById('appBgImageUploadForm');
          var appUploadArea = document.getElementById('appBgImageUploadArea');
          if (appUploadForm && appUploadArea) {
            appUploadArea.appendChild(appUploadForm);
          }
          // App Background functions
          function setAppBgType(type) {
            var isImage = type === 'image';
            document.getElementById('appBgUseImage').value = isImage ? 'true' : 'false';
            document.getElementById('appSolidColorSection').style.display = isImage ? 'none' : 'block';
            document.getElementById('appBgImageSection').style.display = isImage ? 'block' : 'none';
            document.getElementById('appBgImageUploadForm').style.display = isImage ? 'block' : 'none';
            document.getElementById('appTintSection').style.display = isImage ? 'block' : 'none';
            var btnColor = document.getElementById('btnAppSolidColor');
            var btnImage = document.getElementById('btnAppBgImage');
            btnColor.style.borderColor = isImage ? '#e1e1e1' : '#e94560';
            btnColor.style.background = isImage ? '#f8f9fa' : '#fff0f3';
            btnColor.style.color = isImage ? '#666' : '#e94560';
            btnImage.style.borderColor = isImage ? '#e94560' : '#e1e1e1';
            btnImage.style.background = isImage ? '#fff0f3' : '#f8f9fa';
            btnImage.style.color = isImage ? '#e94560' : '#666';
            updateAppPreview();
          }
          function toggleAppTint() {
            var input = document.getElementById('appBgUseTintInput');
            var track = document.getElementById('appTintToggleTrack');
            var thumb = document.getElementById('appTintToggleThumb');
            var controls = document.getElementById('appTintControls');
            var isOn = input.value === 'true';
            input.value = isOn ? 'false' : 'true';
            track.style.background = isOn ? '#ccc' : '#27ae60';
            thumb.style.left = isOn ? '3px' : '27px';
            controls.style.display = isOn ? 'none' : 'block';
            updateAppPreview();
          }
          function updateAppPreview() {
            var panel = document.getElementById('appPreviewPanel');
            var tint = document.getElementById('appPreviewTint');
            var card = document.getElementById('appPreviewCard');
            var isImage = document.getElementById('appBgUseImage').value === 'true';
            var bgColor = document.getElementById('appBgColor').value;
            var useTint = document.getElementById('appBgUseTintInput').value === 'true';
            var tintColor = document.getElementById('appBgTintColor').value;
            var tintOpacity = parseInt(document.getElementById('appBgTintOpacity').value) / 100;
            var containerOpacity = parseInt(document.getElementById('appBgContainerOpacity').value) / 100;
            if (isImage && panel.dataset.hasImage === 'true') {
              // keep image background
            } else if (!isImage) {
              panel.style.backgroundImage = 'none';
              panel.style.backgroundColor = bgColor;
            }
            tint.style.background = tintColor;
            tint.style.opacity = (isImage && useTint) ? tintOpacity : 0;
            card.style.background = 'rgba(255,255,255,' + containerOpacity + ')';
          }
          document.getElementById('appBgColor').addEventListener('input', function() {
            document.getElementById('appBgColorHex').textContent = this.value;
            updateAppPreview();
          });
          document.getElementById('appBgTintColor').addEventListener('input', function() {
            document.getElementById('appTintColorHex').textContent = this.value;
            updateAppPreview();
          });

          // Login background AJAX upload with modal
          (function() {
            var btn = document.getElementById('loginBgUploadBtn');
            var input = document.getElementById('loginBgFileInput');
            var modal = document.getElementById('loginBgPreviewModal');
            var preview = document.getElementById('loginBgPreviewImg');
            var saveBtn = document.getElementById('loginBgSaveBtn');
            var cancelBtn = document.getElementById('loginBgCancelBtn');
            if (!btn || !input) return;
            btn.addEventListener('click', function() { input.click(); });
            input.addEventListener('change', function() {
              if (!input.files || !input.files[0]) return;
              var file = input.files[0];
              var allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
              if (allowedTypes.indexOf(file.type) === -1) {
                alert('Invalid file type. Please select a JPEG, PNG, GIF, or WebP image.');
                input.value = '';
                return;
              }
              if (file.size > 5 * 1024 * 1024) {
                alert('File is too large. Maximum size is 5MB.');
                input.value = '';
                return;
              }
              var reader = new FileReader();
              reader.onload = function(e) {
                preview.src = e.target.result;
                modal.style.display = 'flex';
              };
              reader.readAsDataURL(file);
            });
            cancelBtn.addEventListener('click', function() {
              modal.style.display = 'none';
              input.value = '';
            });
            modal.addEventListener('click', function(e) {
              if (e.target === modal) { modal.style.display = 'none'; input.value = ''; }
            });
            saveBtn.addEventListener('click', function() {
              if (!input.files || !input.files[0]) return;
              var formData = new FormData();
              formData.append('backgroundImage', input.files[0]);
              saveBtn.disabled = true;
              saveBtn.textContent = 'Saving...';
              fetch('/admin/upload-login-background', { method: 'POST', body: formData })
                .then(function(res) { return res.json(); })
                .then(function(data) {
                  if (data.success) {
                    // Update current background preview thumbnail
                    var section = document.getElementById('bgImageSection');
                    var thumb = section.querySelector('img');
                    if (thumb) { thumb.src = data.imageUrl; }
                    // Update live preview panel
                    var panel = document.getElementById('previewPanel');
                    panel.style.backgroundImage = "url('" + data.imageUrl + "')";
                    panel.style.backgroundSize = 'cover';
                    panel.style.backgroundPosition = 'center';
                    panel.dataset.hasImage = 'true';
                    updatePreview();
                    modal.style.display = 'none';
                    input.value = '';
                  } else {
                    alert(data.error || 'Upload failed. Please try again.');
                  }
                })
                .catch(function() { alert('Upload failed. Please try again.'); })
                .finally(function() { saveBtn.disabled = false; saveBtn.textContent = 'Save'; });
            });
          })();

          // App background AJAX upload with modal
          (function() {
            var btn = document.getElementById('appBgUploadBtn');
            var input = document.getElementById('appBgFileInput');
            var modal = document.getElementById('appBgPreviewModal');
            var preview = document.getElementById('appBgPreviewImg');
            var saveBtn = document.getElementById('appBgSaveBtn');
            var cancelBtn = document.getElementById('appBgCancelBtn');
            if (!btn || !input) return;
            btn.addEventListener('click', function() { input.click(); });
            input.addEventListener('change', function() {
              if (!input.files || !input.files[0]) return;
              var file = input.files[0];
              var allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
              if (allowedTypes.indexOf(file.type) === -1) {
                alert('Invalid file type. Please select a JPEG, PNG, GIF, or WebP image.');
                input.value = '';
                return;
              }
              if (file.size > 5 * 1024 * 1024) {
                alert('File is too large. Maximum size is 5MB.');
                input.value = '';
                return;
              }
              var reader = new FileReader();
              reader.onload = function(e) {
                preview.src = e.target.result;
                modal.style.display = 'flex';
              };
              reader.readAsDataURL(file);
            });
            cancelBtn.addEventListener('click', function() {
              modal.style.display = 'none';
              input.value = '';
            });
            modal.addEventListener('click', function(e) {
              if (e.target === modal) { modal.style.display = 'none'; input.value = ''; }
            });
            saveBtn.addEventListener('click', function() {
              if (!input.files || !input.files[0]) return;
              var formData = new FormData();
              formData.append('appBackgroundImage', input.files[0]);
              saveBtn.disabled = true;
              saveBtn.textContent = 'Saving...';
              fetch('/admin/upload-app-background', { method: 'POST', body: formData })
                .then(function(res) { return res.json(); })
                .then(function(data) {
                  if (data.success) {
                    // Update current background preview thumbnail
                    var section = document.getElementById('appBgImageSection');
                    var thumb = section.querySelector('img');
                    if (thumb) { thumb.src = data.imageUrl; }
                    // Update live preview panel
                    var panel = document.getElementById('appPreviewPanel');
                    panel.style.backgroundImage = "url('" + data.imageUrl + "')";
                    panel.style.backgroundSize = 'cover';
                    panel.style.backgroundPosition = 'center';
                    panel.dataset.hasImage = 'true';
                    updateAppPreview();
                    modal.style.display = 'none';
                    input.value = '';
                  } else {
                    alert(data.error || 'Upload failed. Please try again.');
                  }
                })
                .catch(function() { alert('Upload failed. Please try again.'); })
                .finally(function() { saveBtn.disabled = false; saveBtn.textContent = 'Save'; });
            });
          })();
        </script>
      </body>
      </html>
    `);
  });

  // Save app config
  router.post('/app-config', requireAdmin, (req, res) => {
    const { appTitle, appSubtitle, defaultRegistrationPrice, defaultMinScore, defaultMaxScore, animatedLogin, chatEnabled, chatMessageLimit,
            loginBgUseImage, loginBgColor, loginBgUseTint, loginBgTintColor, loginBgTintOpacity, loginBgCardOpacity,
            appBgUseImage, appBgColor, appBgUseTint, appBgTintColor, appBgTintOpacity, appBgContainerOpacity } = req.body;

    if (!/^\d+(\.\d{1,2})?$/.test((defaultRegistrationPrice || '').trim())) {
      return res.send(errorPage('Invalid price. Enter a number like 25 or 25.00.', '/admin/app-config', 'Try Again'));
    }

    if (!/^\d+$/.test((defaultMinScore || '').trim()) || !/^\d+$/.test((defaultMaxScore || '').trim())) {
      return res.send(errorPage('Default Min Score and Max Score must be whole numbers.', '/admin/app-config', 'Try Again'));
    }

    appConfig.appTitle = appTitle || 'Car Show Manager';
    appConfig.appSubtitle = appSubtitle || '';
    appConfig.defaultRegistrationPrice = Math.round((parseFloat(defaultRegistrationPrice) || 25.00) * 100) / 100;
    appConfig.defaultMinScore = parseInt(defaultMinScore) || 0;
    appConfig.defaultMaxScore = parseInt(defaultMaxScore) || 10;
    appConfig.animatedLogin = animatedLogin === 'true';
    appConfig.chatEnabled = chatEnabled === 'true';
    appConfig.chatMessageLimit = Math.max(50, Math.min(10000, parseInt(chatMessageLimit) || 200));

    // Update loginBackground settings (preserve imageUrl — only changed by upload/remove routes)
    if (!appConfig.loginBackground) appConfig.loginBackground = {};
    appConfig.loginBackground.useImage = loginBgUseImage === 'true';
    appConfig.loginBackground.backgroundColor = /^#[0-9A-Fa-f]{6}$/.test(loginBgColor) ? loginBgColor : '#1a1a2e';
    appConfig.loginBackground.useTint = loginBgUseTint === 'true';
    appConfig.loginBackground.tintColor = /^#[0-9A-Fa-f]{6}$/.test(loginBgTintColor) ? loginBgTintColor : '#1a1a2e';
    appConfig.loginBackground.tintOpacity = Math.max(0, Math.min(1, (parseInt(loginBgTintOpacity) || 50) / 100));
    appConfig.loginBackground.cardOpacity = Math.max(0, Math.min(1, (parseInt(loginBgCardOpacity) || 98) / 100));

    // Update appBackground settings (preserve imageUrl — only changed by upload/remove routes)
    if (!appConfig.appBackground) appConfig.appBackground = {};
    appConfig.appBackground.useImage = appBgUseImage === 'true';
    appConfig.appBackground.backgroundColor = /^#[0-9A-Fa-f]{6}$/.test(appBgColor) ? appBgColor : '#1a1a2e';
    appConfig.appBackground.useTint = appBgUseTint === 'true';
    appConfig.appBackground.tintColor = /^#[0-9A-Fa-f]{6}$/.test(appBgTintColor) ? appBgTintColor : '#1a1a2e';
    appConfig.appBackground.tintOpacity = Math.max(0, Math.min(1, (parseInt(appBgTintOpacity) || 50) / 100));
    appConfig.appBackground.containerOpacity = Math.max(0, Math.min(1, (parseInt(appBgContainerOpacity) || 98) / 100));

    saveConfig();

    res.redirect('/admin/app-config?saved=1');
  });

  return router;
};
