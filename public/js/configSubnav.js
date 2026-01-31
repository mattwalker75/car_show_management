// configSubnav.js - Admin config sub-navigation toggle
// Dynamically creates the config sub-navigation bar under the Config tab
// and highlights the active config page.

document.addEventListener('DOMContentLoaded', function() {
  var navs = document.querySelectorAll('.admin-nav');
  if (navs.length > 0) {
    var nav = navs[0];
    var configToggle = nav.querySelector('a[onclick*="configSubnav"]');
    if (configToggle) {
      var subnav = document.createElement('div');
      subnav.id = 'configSubnav';
      subnav.className = 'admin-nav config-subnav';
      var path = window.location.pathname;
      var isConfigPage = path.startsWith('/admin/app-config') || path.startsWith('/admin/vehicle-config') || path.startsWith('/admin/categories') || path.startsWith('/admin/specialty-vote') || path.startsWith('/admin/edit-category') || path.startsWith('/admin/category-questions') || path.startsWith('/admin/edit-question') || path.startsWith('/admin/add-vehicle-type') || path.startsWith('/admin/edit-vehicle-type') || path.startsWith('/admin/add-class') || path.startsWith('/admin/edit-class') || path.startsWith('/admin/edit-specialty-vote') || path.startsWith('/admin/add-specialty-vote');
      subnav.style.display = isConfigPage ? 'flex' : 'none';
      subnav.innerHTML = '<a href="/admin/app-config"' + (path.startsWith('/admin/app-config') ? ' class="active"' : '') + '>App Config</a>' +
        '<a href="/admin/vehicle-config"' + (path.startsWith('/admin/vehicle-config') || path.startsWith('/admin/add-vehicle-type') || path.startsWith('/admin/edit-vehicle-type') || path.startsWith('/admin/add-class') || path.startsWith('/admin/edit-class') ? ' class="active"' : '') + '>Vehicle Config</a>' +
        '<a href="/admin/categories"' + (path.startsWith('/admin/categories') || path.startsWith('/admin/edit-category') || path.startsWith('/admin/category-questions') || path.startsWith('/admin/edit-question') ? ' class="active"' : '') + '>Judge Config</a>' +
        '<a href="/admin/specialty-votes"' + (path.startsWith('/admin/specialty-vote') || path.startsWith('/admin/edit-specialty-vote') || path.startsWith('/admin/add-specialty-vote') ? ' class="active"' : '') + '>Special Vote Config</a>';
      nav.parentNode.insertBefore(subnav, nav.nextSibling);
    }
  }
});
