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
 * @param {string} options.role - User role: 'admin', 'judge', 'registrar', 'user'
 * @param {Object} options.user - User session object
 * @param {string} options.activeTab - Active nav tab identifier
 * @param {string} options.content - Main content HTML
 * @param {string} [options.extraHead] - Additional <head> content
 * @param {string} [options.extraScripts] - Scripts to add before </body>
 * @returns {string} Complete dashboard page HTML
 */
function dashboardPage({ title, heading, role, user, activeTab, content, extraHead, extraScripts }) {
  const header = dashboardHeader(role, user, heading);
  const nav = getNav(role, activeTab);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      <link rel="stylesheet" href="/css/styles.css">
      <link rel="stylesheet" href="/css/admin.css">
      <script src="/js/configSubnav.js"></script>
      ${extraHead || ''}
    </head>
    <body>
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

module.exports = {
  pageShell,
  dashboardPage,
  formPage,
  errorPage,
  successPage
};
