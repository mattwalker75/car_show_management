// views/components.js - Reusable UI components for server-rendered HTML
// Provides avatar, navigation bars, dashboard headers, and vehicle card helpers
// to eliminate duplication across route files.

/**
 * Generate avatar HTML — shows profile image if available, otherwise initials.
 * @param {Object} user - User object with name and optional image_url
 * @returns {string} HTML for the avatar div
 */
function getAvatar(user) {
  const avatarContent = getAvatarContent(user);
  return `<div class="user-avatar">${avatarContent}</div>`;
}

/**
 * Get avatar inner content (image tag or initials text).
 * Used when you need just the content without the wrapper div.
 * @param {Object} user - User object with name and optional image_url
 * @returns {string} Initials string or <img> tag
 */
function getAvatarContent(user) {
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  return user.image_url
    ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
    : initials;
}

/**
 * Generate the dashboard header with avatar, profile button, and sign out.
 * @param {string} role - User role: 'admin', 'judge', 'registrar', 'user'
 * @param {Object} user - User object
 * @param {string} title - Dashboard title text (e.g. "Admin Dashboard")
 * @returns {string} Dashboard header HTML
 */
function dashboardHeader(role, user, title) {
  const avatarContent = getAvatarContent(user);
  return `
    <div class="dashboard-header">
      <h1>🏎️ ${title}</h1>
      <div class="user-info">
        <div class="user-avatar">${avatarContent}</div>
        <a href="/${role}/profile" class="profile-btn">Profile</a>
        <a href="/logout" class="logout-btn">Sign Out</a>
      </div>
    </div>`;
}

/**
 * Admin navigation bar with Config sub-nav toggle.
 * @param {string} activeTab - Currently active tab: 'users', 'vehicles', 'config', 'judge-status', 'vote-status', 'reports'
 * @returns {string} Admin nav HTML
 */
function adminNav(activeTab) {
  return `
    <div class="admin-nav">
      <a href="/admin/dashboard"${activeTab === 'dashboard' ? ' class="active"' : ''}>Dashboard</a>
      <a href="#" onclick="var sn=document.getElementById('configSubnav');sn.style.display=sn.style.display==='flex'?'none':'flex';return false;"${activeTab === 'config' ? ' class="active"' : ''}>Config</a>
      <a href="/admin"${activeTab === 'users' ? ' class="active"' : ''}>Users</a>
      <a href="/admin/vehicles"${activeTab === 'vehicles' ? ' class="active"' : ''}>Vehicles</a>
      <a href="#" onclick="var sn=document.getElementById('votingSubnav');sn.style.display=sn.style.display==='flex'?'none':'flex';return false;"${activeTab === 'voting' ? ' class="active"' : ''}>Voting</a>
      <a href="/admin/reports"${activeTab === 'reports' ? ' class="active"' : ''}>Reports</a>
      <a href="/admin/vendors"${activeTab === 'vendors' ? ' class="active"' : ''}>Vendors</a>
      <a href="/user/vote">Vote Here!</a>
    </div>`;
}

/**
 * Judge navigation bar.
 * @param {string} activeTab - Currently active tab: 'dashboard', 'judge-vehicles', 'vehicles', 'users', 'results'
 * @returns {string} Judge nav HTML
 */
function judgeNav(activeTab) {
  return `
    <div class="admin-nav">
      <a href="/judge"${activeTab === 'dashboard' ? ' class="active"' : ''}>Dashboard</a>
      <a href="/judge/judge-vehicles"${activeTab === 'judge-vehicles' ? ' class="active"' : ''}>Judge Vehicles</a>
      <a href="/judge/vehicles"${activeTab === 'vehicles' ? ' class="active"' : ''}>Vehicles</a>
      <a href="/judge/users"${activeTab === 'users' ? ' class="active"' : ''}>Users</a>
      <a href="/judge/results"${activeTab === 'results' ? ' class="active"' : ''}>Results</a>
      <a href="/judge/vendors"${activeTab === 'vendors' ? ' class="active"' : ''}>Vendors</a>
      <a href="/user/vote">Vote Here!</a>
    </div>`;
}

/**
 * Registrar navigation bar.
 * @param {string} activeTab - Currently active tab: 'dashboard', 'vehicles', 'users'
 * @returns {string} Registrar nav HTML
 */
function registrarNav(activeTab) {
  return `
    <div class="admin-nav">
      <a href="/registrar"${activeTab === 'dashboard' ? ' class="active"' : ''}>Dashboard</a>
      <a href="/registrar/vehicles"${activeTab === 'vehicles' ? ' class="active"' : ''}>Vehicles</a>
      <a href="/registrar/users"${activeTab === 'users' ? ' class="active"' : ''}>Users</a>
      <a href="/registrar/vendors"${activeTab === 'vendors' ? ' class="active"' : ''}>Vendors</a>
      <a href="/user/vote">Vote Here!</a>
    </div>`;
}

/**
 * User navigation bar.
 * @param {string} activeTab - Currently active tab: 'dashboard', 'vehicles', 'vote'
 * @returns {string} User nav HTML
 */
function userNav(activeTab) {
  return `
    <div class="admin-nav">
      <a href="/user"${activeTab === 'dashboard' ? ' class="active"' : ''}>Dashboard</a>
      <a href="/user/vehicles"${activeTab === 'vehicles' ? ' class="active"' : ''}>Vehicles</a>
      <a href="/user/vendors"${activeTab === 'vendors' ? ' class="active"' : ''}>Vendors</a>
      <a href="/user/vote"${activeTab === 'vote' ? ' class="active"' : ''}>Vote Here!</a>
    </div>`;
}

/**
 * Vendor navigation bar.
 * @param {string} activeTab - Currently active tab: 'dashboard'
 * @returns {string} Vendor nav HTML
 */
function vendorNav(activeTab) {
  return `
    <div class="admin-nav">
      <a href="/vendor"${activeTab === 'dashboard' ? ' class="active"' : ''}>Dashboard</a>
      <a href="/vendor/vendors"${activeTab === 'vendors' ? ' class="active"' : ''}>Vendors</a>
    </div>`;
}

/**
 * Get the navigation bar for a given role.
 * @param {string} role - 'admin', 'judge', 'registrar', 'user'
 * @param {string} activeTab - Currently active tab identifier
 * @returns {string} Nav HTML for the specified role
 */
function getNav(role, activeTab) {
  switch (role) {
    case 'admin': return adminNav(activeTab);
    case 'judge': return judgeNav(activeTab);
    case 'registrar': return registrarNav(activeTab);
    case 'vendor': return vendorNav(activeTab);
    case 'user': return userNav(activeTab);
    default: return '';
  }
}

module.exports = {
  getAvatar,
  getAvatarContent,
  dashboardHeader,
  adminNav,
  judgeNav,
  registrarNav,
  vendorNav,
  userNav,
  getNav
};
