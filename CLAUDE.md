# CLAUDE.md - Car Show Management System

This file provides guidance for Claude Code when working with this repository.

## Project Overview

Car Show Management System - a full-stack Node.js/Express web application for managing car show events including vehicle registration, judge scoring, specialty voting, vendor management, and real-time group chat.

## Tech Stack

- **Backend**: Node.js, Express 5.x
- **Database**: SQLite (default) or MySQL (configurable in config.json)
- **Authentication**: bcrypt for password hashing, cookie-session for sessions
- **Real-time**: Socket.io for notifications and chat
- **Image Processing**: Sharp for resizing uploads
- **File Upload**: Multer (5MB limit, JPEG/PNG/GIF/WebP only)
- **Frontend**: Server-side rendered HTML (no templating engine), vanilla JS

## Quick Reference

### Run the Application

```bash
npm install
sqlite3 carshow.db < setup_sqllite_db.sql  # First time only
node app.js
# Access at https://localhost:3001
```

### Key Configuration

All settings in `config.json`:
- `port`: Server port (default 3001)
- `sessionKeys`: Array of two secret keys for signing session cookies (change for production!)
- `database.engine`: "sqlite" or "mysql"
- `database.sqlite.filename`: SQLite database file name
- `judgeVotingStatus` / `specialtyVotingStatus`: "Open", "Close", or "Lock"
- `chatEnabled`: Enable/disable group chat feature
- `chatMessageLimit`: Max messages stored in DB (default 200, oldest deleted when exceeded)

### SSL Certificates

The app requires HTTPS. Certificate paths are hardcoded in `app.js`:
```javascript
key: fs.readFileSync('/path/to/key.pem'),
cert: fs.readFileSync('/path/to/cert.pem')
```

## Directory Structure

```
├── app.js                 # Main entry point, Express setup, Socket.io
├── config.json            # Runtime configuration
├── carshow.db             # SQLite database
├── setup_sqllite_db.sql   # SQLite schema (run for fresh DB)
├── setup_mysql_db.sql     # MySQL schema
│
├── config/
│   └── appConfig.js       # Config loading/saving, multer setup
│
├── db/
│   └── database.js        # DB abstraction (SQLite/MySQL), async wrappers
│
├── middleware/
│   └── auth.js            # Authentication, role-based access control
│
├── helpers/
│   ├── imageUpload.js     # Image processing with Sharp
│   └── vendorViews.js     # Vendor view helpers
│
├── routes/                # Express route modules
│   ├── public.js          # Login, register, setup (mounted at /)
│   ├── profile.js         # Shared profile routes (mounted at /)
│   ├── admin.js           # Admin routes (mounted at /admin)
│   ├── adminConfig.js     # Admin config routes (mounted at /admin)
│   ├── adminVoting.js     # Admin voting routes (mounted at /admin)
│   ├── judge.js           # Judge routes (mounted at /judge)
│   ├── registrar.js       # Registrar routes (mounted at /registrar)
│   ├── user.js            # User routes (mounted at /user)
│   ├── vendor.js          # Vendor routes (mounted at /vendor)
│   └── chat.js            # Chat page and API (mounted at /chat)
│
├── views/
│   ├── layout.js          # Page templates, background styles
│   └── components.js      # Reusable UI components (nav, avatars)
│
├── public/                # Static assets
│   ├── css/
│   │   ├── styles.css     # Base styles
│   │   └── admin.css      # Dashboard styles
│   └── js/
│       ├── notifications.js  # Socket.io notifications
│       ├── chat.js           # Chat client
│       ├── configSubnav.js   # Admin config navigation
│       ├── imageModal.js     # Image lightbox
│       └── imageUpload.js    # Upload UI helper
│
├── images/                # Uploaded images
│   ├── app_config/        # App backgrounds
│   └── user_uploads/
│       ├── profile/       # User profile photos
│       ├── cars/          # Vehicle photos
│       └── vendors/       # Vendor images
│
└── Docs/                  # Documentation
    ├── SETUP.md
    ├── DEPLOYMENT.md
    ├── ROLES.md
    ├── FILE_STRUCTURE.md
    └── TROUBLESHOOTING.md
```

## User Roles

| Role | Description |
|------|-------------|
| **admin** | Full system access - user management, configuration, voting control |
| **judge** | Score vehicles, view results, reset user passwords |
| **registrar** | Vehicle check-in, assign voter IDs, activate registrations |
| **user** | Register vehicles, participate in specialty votes, view results |
| **vendor** | Manage business profile, products, booth information |

## Database

### Switching Engines

Edit `config.json`:
```json
{
  "database": {
    "engine": "sqlite",  // or "mysql"
    "sqlite": { "filename": "carshow.db" },
    "mysql": { "host": "...", "user": "...", "password": "...", "database": "carshow" }
  }
}
```

### Key Tables

- `users` - All user accounts with role, chat_enabled, chat_blocked flags
- `vehicles` - Vehicle types (Car, Truck, etc.)
- `classes` - Competition classes per vehicle type
- `cars` - Registered vehicles with owner, class, voter_id
- `judge_catagories` - Scoring categories
- `judge_questions` - Individual scoring criteria with min/max scores
- `judge_scores` - Submitted scores (judge_id, car_id, question_id, score)
- `specialty_votes` - Custom vote definitions (People's Choice, etc.)
- `specialty_vote_results` - Cast votes
- `published_results` - Locked/published results
- `vendor_business` - Vendor profiles
- `vendor_products` - Products/services for sale
- `chat_messages` - Group chat history

### Async Database Methods

```javascript
// All routes receive db object
db.getAsync(sql, params)   // Returns single row or undefined
db.allAsync(sql, params)   // Returns array of rows
db.runAsync(sql, params)   // Returns { lastID, changes }
```

## Route Module Pattern

All route files export a factory function:

```javascript
module.exports = function(db, appConfig, upload) {
  const router = express.Router();
  // ... define routes
  return router;
};
```

## Socket.io Events

### Rooms
- `role:admin`, `role:judge`, etc. - Role-based notification rooms
- `app` - All logged-in users (presence tracking)
- `chat` - Users on the chat page

### Events
- `chat-message` - New chat message broadcast
- `chat-users-update` - Online users list update
- `chat-blocked` / `chat-unblocked` - User block status change
- `notification` - Toast notification to roles

### Rate Limiting
Chat has 500ms server-side rate limit per user. Client also enforces this with button cooldown.

### Chat Limits
- **Message length**: 250 characters max
- **Message history**: Configurable via `chatMessageLimit` in config.json (default 200)

## Image Upload Dimensions

- Profile photos: 200x200
- Vehicle photos: 800x600
- Vendor images: 800x600

## Code Patterns

### View Generation
No templating engine - HTML generated via string interpolation:
```javascript
res.send(`
  <!DOCTYPE html>
  <html>
  <head>...</head>
  ${bodyTag(req)}
    ${header}
    ${nav}
    <!-- content -->
  </body>
  </html>
`);
```

### Authentication Middleware
```javascript
const { requireAuth, requireAdmin, requireJudge } = require('../middleware/auth');
router.get('/admin-only', requireAdmin, (req, res) => { ... });
```

### Session Access
```javascript
const user = req.session.user;  // { user_id, username, role, name, ... }
```

## Common Tasks

### Add a New Route
1. Create or edit file in `routes/`
2. Export factory function receiving `(db, appConfig, upload)`
3. Mount in `app.js`: `app.use('/path', require('./routes/file')(db, appConfig, upload))`

### Add Database Column (SQLite)
1. Add to `setup_sqllite_db.sql` for new installs
2. Add migration in `db/database.js` `runSQLiteMigrations()`:
   ```javascript
   sqliteDb.run(`ALTER TABLE tablename ADD COLUMN colname TYPE DEFAULT value`, () => {});
   ```

### Modify Navigation
Edit `views/components.js` `getNav()` function - role-based nav items defined there.

## Important Notes

- **No tests configured** - package.json test script is placeholder
- **Self-signed HTTPS** - Browser shows security warning (expected)
- **Session keys** - Configurable via `sessionKeys` in config.json, change defaults for production
- **First user becomes admin** - Registration creates admin if no users exist
- **Migrations run on startup** - `runSQLiteMigrations()` adds missing columns
- **Chat profanity filter** - Uses bad-words-plus library
- **Trust proxy enabled** - For correct IP logging behind load balancer
