// views/layout.js - Page layout shells and common page templates
// Provides full HTML document wrappers for dashboard pages, forms,
// error/success pages, and other standard layouts.

const { dashboardHeader, getNav } = require('./components');

/**
 * Full HTML page shell — wraps content in a complete HTML document.
 * @param {Object} options
 * @param {string} options.title - Page <title>
 * @param {string} [options.extraHead] - Extra tags for <head> (CSS links, meta, etc.)
 * @param {string} options.body - Full <body> inner HTML
 * @returns {string} Complete HTML document string
 */
function pageShell({ title, extraHead, body }) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      <link rel="stylesheet" href="/css/styles.css">
      ${extraHead || ''}
    </head>
    <body>
      ${body}
    </body>
    </html>`;
}

/**
 * Dashboard page layout — full HTML document with header, nav, and content area.
 * Used for all role-based dashboard pages.
 * @param {Object} options
 * @param {string} options.title - Page <title>
 * @param {string} options.heading - Dashboard heading text (e.g. "Admin Dashboard")
 * @param {string} options.role - User role: 'admin', 'judge', 'registrar', 'user', 'vendor'
 * @param {Object} options.user - User session object
 * @param {string} options.activeTab - Active nav tab identifier
 * @param {string} options.content - Main content HTML
 * @param {Object} [options.appConfig] - App config for background styles
 * @param {Object} [options.req] - Express request for body tag data attributes
 * @param {boolean} [options.chatEnabled] - Whether to show chat link in nav
 * @param {string} [options.extraHead] - Additional <head> content
 * @param {string} [options.extraScripts] - Scripts to add before </body>
 * @returns {string} Complete dashboard page HTML
 */
function dashboardPage({ title, heading, role, user, activeTab, content, appConfig, req, chatEnabled, extraHead, extraScripts }) {
  const header = dashboardHeader(role, user, heading);
  const nav = getNav(role, activeTab, chatEnabled);
  const bgStyles = appConfig ? getAppBackgroundStyles(appConfig) : '';

  // Build body tag with user data attributes if request provided
  let bodyTag = '<body>';
  if (req && req.session && req.session.user) {
    const u = req.session.user;
    bodyTag = `<body data-user-role="${u.role || ''}" data-user-id="${u.user_id || ''}" data-user-name="${u.name || ''}" data-user-image="${u.image_url || ''}">`;
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      <link rel="stylesheet" href="/css/styles.css">
      <link rel="stylesheet" href="/css/admin.css">
      <script src="/js/configSubnav.js"></script>
      <script src="/socket.io/socket.io.js"></script>
      <script src="/js/notifications.js"></script>
      ${bgStyles}
      ${extraHead || ''}
    </head>
    ${bodyTag}
      <div class="container dashboard-container">
        ${header}
        ${nav}
        ${content}
      </div>
      ${extraScripts || ''}
    </body>
    </html>`;
}

/**
 * Simple form page layout — centered container for login, register, setup pages.
 * @param {Object} options
 * @param {string} options.title - Page <title>
 * @param {string} options.body - Form content HTML
 * @param {string} [options.extraHead] - Additional <head> content
 * @returns {string} Complete form page HTML
 */
function formPage({ title, body, extraHead }) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      <link rel="stylesheet" href="/css/styles.css">
      ${extraHead || ''}
    </head>
    <body>
      <div class="container">
        <div class="logo">
          <div class="logo-icon">🏎️</div>
          <h1>Car Show Manager</h1>
        </div>
        ${body}
      </div>
    </body>
    </html>`;
}

/**
 * Error page — standalone error display with message and back link.
 * @param {string} message - Error message to display
 * @param {string} [backLink='/'] - URL for the back/retry link
 * @param {string} [backText='Go Back'] - Text for the back link
 * @returns {string} Complete error page HTML
 */
function errorPage(message, backLink = '/', backText = 'Go Back') {
  return formPage({
    title: 'Error',
    body: `
      <div class="error-message">${message}</div>
      <div class="links">
        <a href="${backLink}">${backText}</a>
      </div>`
  });
}

/**
 * Success page — standalone success display with message and navigation link.
 * @param {string} message - Success message to display
 * @param {string} [link='/'] - URL for the navigation link
 * @param {string} [linkText='Continue'] - Text for the link
 * @returns {string} Complete success page HTML
 */
function successPage(message, link = '/', linkText = 'Continue') {
  return formPage({
    title: 'Success',
    body: `
      <div class="success-message">${message}</div>
      <div class="links">
        <a href="${link}">${linkText}</a>
      </div>`
  });
}

/**
 * Generate dynamic app background styles from appConfig.appBackground.
 * Used on all authenticated/dashboard pages to override the default body gradient.
 * @param {Object} appConfig - The application config object
 * @returns {string} A <style> tag with dynamic background CSS
 */
function getAppBackgroundStyles(appConfig) {
  const bg = (appConfig && appConfig.appBackground) || {};
  const useImage = bg.useImage && bg.imageUrl;
  const bgColor = bg.backgroundColor || '#1a1a2e';
  const containerOpacity = bg.containerOpacity ?? 0.98;
  const useTint = bg.useTint;
  const tintColor = bg.tintColor || '#1a1a2e';
  const tintOpacity = bg.tintOpacity ?? 0.5;

  let bodyBg;
  if (useImage) {
    bodyBg = `background: url('${bg.imageUrl}') center/cover no-repeat fixed; background-color: #1a1a2e;`;
  } else {
    bodyBg = `background: ${bgColor};`;
  }

  let tintStyles = '';
  if (useImage && useTint) {
    tintStyles = `
      body::before {
        content: '';
        position: fixed;
        top: 0; left: 0;
        width: 100%; height: 100%;
        background: ${tintColor};
        opacity: ${tintOpacity};
        z-index: 0;
        pointer-events: none;
      }
      body > .container { position: relative; z-index: 1; }
    `;
  }

  return `
    <style>
      body { ${bodyBg} }
      .dashboard-container { background: rgba(255, 255, 255, ${containerOpacity}); }
      ${tintStyles}
    </style>
  `;
}

module.exports = {
  pageShell,
  dashboardPage,
  formPage,
  errorPage,
  successPage,
  getAppBackgroundStyles
};
