// views/components.js - Reusable UI components for server-rendered HTML
// Provides avatar, navigation bars, dashboard headers, and vehicle card helpers
// to eliminate duplication across route files.

/**
 * Get initials from a user name string (up to 2 characters).
 * Safe against null/undefined names.
 * @param {string} name - User's display name
 * @returns {string} Uppercase initials (e.g. "JD") or "?" if name is empty
 */
function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
}

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
  const initials = getInitials(user.name);
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
 * @param {string} activeTab - Currently active tab: 'dashboard', 'config', 'users', 'vehicles', 'voting', 'vendors', 'reports'
 * @returns {string} Admin nav HTML
 */
function adminNav(activeTab, chatEnabled) {
  return `
    <div class="admin-nav">
      <a href="/admin/dashboard"${activeTab === 'dashboard' ? ' class="active"' : ''}>Dashboard</a>
      <a href="#" onclick="var sn=document.getElementById('configSubnav');sn.style.display=sn.style.display==='flex'?'none':'flex';return false;"${activeTab === 'config' ? ' class="active"' : ''}>Config</a>
      <a href="/admin"${activeTab === 'users' ? ' class="active"' : ''}>Users</a>
      <a href="/admin/vehicles"${activeTab === 'vehicles' ? ' class="active"' : ''}>Vehicles</a>
      <a href="#" onclick="var sn=document.getElementById('votingSubnav');sn.style.display=sn.style.display==='flex'?'none':'flex';return false;"${activeTab === 'voting' ? ' class="active"' : ''}>Voting</a>
      <a href="/admin/vendors"${activeTab === 'vendors' ? ' class="active"' : ''}>Vendors</a>
      ${chatEnabled ? `<a href="/chat"${activeTab === 'chat' ? ' class="active"' : ''}>Chat</a>` : ''}
      <a href="/user/vote">Vote Here!</a>
      <a href="/admin/reports"${activeTab === 'reports' ? ' class="active"' : ''}>Reports</a>
    </div>`;
}

/**
 * Judge navigation bar.
 * @param {string} activeTab - Currently active tab: 'dashboard', 'judge-vehicles', 'vehicles', 'users', 'results'
 * @returns {string} Judge nav HTML
 */
function judgeNav(activeTab, chatEnabled) {
  return `
    <div class="admin-nav">
      <a href="/judge"${activeTab === 'dashboard' ? ' class="active"' : ''}>Dashboard</a>
      <a href="/judge/judge-vehicles"${activeTab === 'judge-vehicles' ? ' class="active"' : ''}>Judge Vehicles</a>
      <a href="/judge/vehicles"${activeTab === 'vehicles' ? ' class="active"' : ''}>Vehicles</a>
      <a href="/judge/users"${activeTab === 'users' ? ' class="active"' : ''}>Users</a>
      <a href="/judge/results"${activeTab === 'results' ? ' class="active"' : ''}>Results</a>
      <a href="/judge/vendors"${activeTab === 'vendors' ? ' class="active"' : ''}>Vendors</a>
      ${chatEnabled ? `<a href="/chat"${activeTab === 'chat' ? ' class="active"' : ''}>Chat</a>` : ''}
      <a href="/user/vote">Vote Here!</a>
    </div>`;
}

/**
 * Registrar navigation bar.
 * @param {string} activeTab - Currently active tab: 'dashboard', 'registration', 'vehicles', 'users', 'vendors'
 * @returns {string} Registrar nav HTML
 */
function registrarNav(activeTab, chatEnabled) {
  return `
    <div class="admin-nav">
      <a href="/registrar"${activeTab === 'dashboard' ? ' class="active"' : ''}>Dashboard</a>
      <a href="/registrar/registration"${activeTab === 'registration' ? ' class="active"' : ''}>Registration</a>
      <a href="/registrar/vehicles"${activeTab === 'vehicles' ? ' class="active"' : ''}>Vehicles</a>
      <a href="/registrar/users"${activeTab === 'users' ? ' class="active"' : ''}>Users</a>
      <a href="/registrar/vendors"${activeTab === 'vendors' ? ' class="active"' : ''}>Vendors</a>
      ${chatEnabled ? `<a href="/chat"${activeTab === 'chat' ? ' class="active"' : ''}>Chat</a>` : ''}
      <a href="/user/vote">Vote Here!</a>
    </div>`;
}

/**
 * User navigation bar.
 * @param {string} activeTab - Currently active tab: 'dashboard', 'vehicles', 'vote'
 * @returns {string} User nav HTML
 */
function userNav(activeTab, chatEnabled) {
  return `
    <div class="admin-nav">
      <a href="/user"${activeTab === 'dashboard' ? ' class="active"' : ''}>Dashboard</a>
      <a href="/user/vehicles"${activeTab === 'vehicles' ? ' class="active"' : ''}>Vehicles</a>
      <a href="/user/vendors"${activeTab === 'vendors' ? ' class="active"' : ''}>Vendors</a>
      ${chatEnabled ? `<a href="/chat"${activeTab === 'chat' ? ' class="active"' : ''}>Chat</a>` : ''}
      <a href="/user/vote"${activeTab === 'vote' ? ' class="active"' : ''}>Vote Here!</a>
    </div>`;
}

/**
 * Vendor navigation bar.
 * @param {string} activeTab - Currently active tab: 'dashboard'
 * @returns {string} Vendor nav HTML
 */
function vendorNav(activeTab, chatEnabled) {
  return `
    <div class="admin-nav">
      <a href="/vendor"${activeTab === 'dashboard' ? ' class="active"' : ''}>Dashboard</a>
      <a href="/vendor/vendors"${activeTab === 'vendors' ? ' class="active"' : ''}>Vendors</a>
      ${chatEnabled ? `<a href="/chat"${activeTab === 'chat' ? ' class="active"' : ''}>Chat</a>` : ''}
    </div>`;
}

/**
 * Get the navigation bar for a given role.
 * @param {string} role - 'admin', 'judge', 'registrar', 'user'
 * @param {string} activeTab - Currently active tab identifier
 * @returns {string} Nav HTML for the specified role
 */
function getNav(role, activeTab, chatEnabled) {
  switch (role) {
    case 'admin': return adminNav(activeTab, chatEnabled);
    case 'judge': return judgeNav(activeTab, chatEnabled);
    case 'registrar': return registrarNav(activeTab, chatEnabled);
    case 'vendor': return vendorNav(activeTab, chatEnabled);
    case 'user': return userNav(activeTab, chatEnabled);
    default: return '';
  }
}

module.exports = {
  getInitials,
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
