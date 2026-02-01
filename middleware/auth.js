// middleware/auth.js - Authentication and authorization middleware
// Provides route-level access control based on user session and role,
// plus password hashing/verification helpers.

const bcrypt = require('bcrypt');

// Require any authenticated user
function requireAuth(req, res, next) {
  if (req.session && req.session.user) {
    next();
  } else {
    res.redirect('/login');
  }
}

// Require admin role
function requireAdmin(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'admin') {
    next();
  } else {
    res.redirect('/login');
  }
}

// Require judge role
function requireJudge(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'judge') {
    next();
  } else {
    res.redirect('/login');
  }
}

// Require registrar role
function requireRegistrar(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'registrar') {
    next();
  } else {
    res.redirect('/login');
  }
}

// Require vendor role
function requireVendor(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'vendor') {
    next();
  } else {
    res.redirect('/login');
  }
}

// Hash a plaintext password using bcrypt (salt rounds = 10)
function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

// Compare a plaintext password against a bcrypt hash
function verifyPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

// Check if the users table is empty (first-run setup detection)
function checkInitialSetup(db, callback) {
  db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
    if (err) {
      console.error('Error checking users:', err);
      callback(false, null);
    } else {
      callback(row.count === 0, row.count);
    }
  });
}

module.exports = {
  requireAuth,
  requireAdmin,
  requireJudge,
  requireRegistrar,
  requireVendor,
  hashPassword,
  verifyPassword,
  checkInitialSetup
};
