// app.js - Car Show Management App entry point
// Sets up Express, session, static files, and mounts all route modules.

const express = require('express');
const https = require('https');
const fs = require('fs');
const cookieSession = require('cookie-session');

// Initialize database (creates tables on startup)
const db = require('./db/database');

// Load app config and multer upload middleware
const { appConfig, saveConfig, upload } = require('./config/appConfig');

const app = express();
const port = 3001;

// ── Middleware ─────────────────────────────────────────────────────────
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));
app.use('/images', express.static('images'));

app.use(cookieSession({
  name: 'session',
  keys: ['car-show-secret-key-2024', 'backup-secret-key'],
  maxAge: 24 * 60 * 60 * 1000 // 24 hours
}));

// ── Route Modules ─────────────────────────────────────────────────────

// Public routes (login, register, setup, logout, dashboard redirect)
app.use('/', require('./routes/public')(db, appConfig, upload, port));

// Shared profile routes (all roles: admin, judge, registrar, user)
app.use('/', require('./routes/profile')(db, appConfig, upload));

// Role-specific routes
app.use('/admin', require('./routes/admin')(db, appConfig, upload));
app.use('/admin', require('./routes/adminConfig')(db, appConfig, upload, saveConfig));
app.use('/admin', require('./routes/adminVoting')(db, appConfig, upload, saveConfig));
app.use('/judge', require('./routes/judge')(db, appConfig, upload));
app.use('/registrar', require('./routes/registrar')(db, appConfig, upload));
app.use('/user', require('./routes/user')(db, appConfig, upload));

// ── HTTPS Server ──────────────────────────────────────────────────────
const options = {
  key: fs.readFileSync('/Users/matt/Desktop/My_Data/AI/Vibe_Coding/REPOS/key.pem'),
  cert: fs.readFileSync('/Users/matt/Desktop/My_Data/AI/Vibe_Coding/REPOS/cert.pem')
};

https.createServer(options, app).listen(port, () => {
  console.log(`Car Show Voting App listening at https://localhost:${port}`);
  console.log('Note: You may see a security warning in your browser - this is expected for self-signed certificates');
});

console.log('To access the application:');
console.log('1. Open your browser and go to: https://localhost:3001');
console.log('2. You will see a security warning - accept it to continue');
