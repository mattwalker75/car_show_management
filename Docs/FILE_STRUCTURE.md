# Car Show Manager - File Structure

This document describes the directory structure and key files in the application.

---

## Root Directory

```
car_show_management/
├── app.js                 # Main application entry point
├── package.json           # Node.js dependencies and scripts
├── package-lock.json      # Dependency lock file
├── config.json            # Application configuration
├── carshow.db             # SQLite database (created via setup_sqllite_db.sql)
├── setup_sqllite_db.sql   # SQLite schema (required for fresh DB setup)
├── setup_mysql_db.sql     # MySQL schema and setup
│
├── config/                # Configuration modules
├── db/                    # Database initialization
├── middleware/            # Express middleware
├── routes/                # Route handlers
├── views/                 # View components and templates
├── public/                # Static files served to browser
├── images/                # Uploaded images
└── Docs/                  # Documentation
```

---

## Configuration (`config/`)

```
config/
└── appConfig.js           # Config loading, saving, and multer setup
```

**appConfig.js**:
- Loads configuration from `config.json`
- Provides `saveConfig()` function for admin updates
- Configures multer for file uploads (5MB limit, image types only)
- Exports: `{ appConfig, loadConfig, saveConfig, upload }`

---

## Database (`db/`)

```
db/
└── database.js            # Database initialization and async wrappers
```

**database.js**:
- Detects database engine from config (SQLite or MySQL)
- Creates async wrappers: `db.getAsync()`, `db.allAsync()`, `db.runAsync()`
- Runs SQLite migrations on startup (table creation, schema updates)
- Exports: `db` object with async methods

---

## Middleware (`middleware/`)

```
middleware/
└── auth.js                # Authentication middleware
```

**auth.js**:
- `requireAuth`: Ensures user is logged in
- `requireRole(roles)`: Ensures user has one of the specified roles
- Redirects to `/login` if not authenticated

---

## Routes (`routes/`)

```
routes/
├── public.js              # Public routes (login, register, setup)
├── profile.js             # Shared profile routes (all roles)
├── admin.js               # Admin core routes (users, vehicles, classes)
├── adminConfig.js         # Admin configuration routes
├── adminVoting.js         # Admin voting management routes
├── judge.js               # Judge scoring routes
├── registrar.js           # Registrar check-in routes
├── user.js                # User vehicle and results routes
├── vendor.js              # Vendor business and product routes
└── chat.js                # Group chat routes
```

### Route Details

| File | Mount Point | Purpose |
|------|-------------|---------|
| `public.js` | `/` | Login, logout, register, initial setup |
| `profile.js` | `/` | Profile viewing/editing (all roles) |
| `admin.js` | `/admin` | User, vehicle, class management |
| `adminConfig.js` | `/admin` | System configuration |
| `adminVoting.js` | `/admin` | Judge questions, specialty votes, results |
| `judge.js` | `/judge` | Vehicle scoring interface |
| `registrar.js` | `/registrar` | Vehicle registration, check-in |
| `user.js` | `/user` | Vehicle registration, results viewing |
| `vendor.js` | `/vendor` | Business profile, product management |
| `chat.js` | `/chat` | Group chat page and message API |

---

## Views (`views/`)

```
views/
├── components.js          # Reusable UI components
└── layout.js              # Page layout helpers
```

**components.js**:
- `dashboardHeader()`: Page header with app title and user info
- `getNav()`: Role-based navigation menu
- `getAvatarContent()`: User avatar (image or initials)
- Various UI helper functions

**layout.js**:
- `getAppBackgroundStyles()`: CSS for app background
- `getLoginBackgroundStyles()`: CSS for login page background

---

## Public Assets (`public/`)

```
public/
├── css/
│   ├── styles.css         # Main application styles
│   └── admin.css          # Admin-specific styles
│
├── js/
│   ├── chat.js            # Chat client (Socket.io)
│   ├── configSubnav.js    # Admin config tab navigation
│   └── notifications.js   # Real-time notification handling
│
└── images/
    └── (static images)    # Application icons, logos
```

### CSS Files

| File | Purpose |
|------|---------|
| `styles.css` | Global styles, login page, forms, buttons |
| `admin.css` | Admin dashboard, data tables, modals |

### JavaScript Files

| File | Purpose |
|------|---------|
| `chat.js` | Socket.io chat client, message rendering, sidebar |
| `configSubnav.js` | Tab switching on admin config pages |
| `notifications.js` | Real-time toast notifications via Socket.io |

---

## Uploaded Images (`images/`)

```
images/
├── profile_photos/        # User profile pictures
│   └── {hash}.{ext}       # MD5 hash filename
│
├── vehicles/              # Vehicle photos
│   └── {hash}.{ext}       # MD5 hash filename
│
├── vendor_products/       # Vendor product images
│   └── {hash}.{ext}       # MD5 hash filename
│
└── app_config/            # Admin-uploaded backgrounds
    └── {hash}.{ext}       # MD5 hash filename
```

**Image Naming**:
- All uploaded images are renamed to MD5 hash of content
- Prevents filename conflicts and caching issues
- Original filename is not preserved

---

## Documentation (`Docs/`)

```
Docs/
├── SETUP.md               # Initial setup guide
├── DEPLOYMENT.md          # Deployment instructions
├── ROLES.md               # User roles and workflows
├── TROUBLESHOOTING.md     # Common issues and solutions
└── FILE_STRUCTURE.md      # This file
```

---

## Configuration Files

### config.json

```json
{
  "port": 3001,
  "database": {
    "engine": "sqlite",
    "sqlite": { "filename": "carshow.db" },
    "mysql": { ... }
  },
  "appTitle": "Car Show Manager",
  "appSubtitle": "Sign in to your account",
  "judgeVotingStatus": "Close",
  "specialtyVotingStatus": "Close",
  "defaultRegistrationPrice": 25,
  "defaultMinScore": 0,
  "defaultMaxScore": 10,
  "chatEnabled": true,
  "chatMessageLimit": 200,
  "animatedLogin": true,
  "loginBackground": { ... },
  "appBackground": { ... }
}
```

### package.json Dependencies

**Runtime Dependencies**:
- `express`: Web framework
- `cookie-session`: Session management
- `socket.io`: Real-time communication
- `sqlite3`: SQLite database driver
- `mysql2`: MySQL database driver
- `multer`: File upload handling
- `morgan`: HTTP request logging
- `bad-words-plus`: Profanity filter for chat

---

## Database Schema

### Core Tables

| Table | Purpose |
|-------|---------|
| `users` | User accounts and profiles |
| `vehicles` | Vehicle types/categories |
| `classes` | Vehicle classes for judging |
| `cars` | Registered vehicles |
| `judge_questions` | Scoring criteria |
| `judge_scores` | Judge score submissions |

### Voting Tables

| Table | Purpose |
|-------|---------|
| `specialty_votes` | Custom vote definitions |
| `specialty_vote_voters` | Who can vote in each vote |
| `specialty_vote_results` | Vote submissions |
| `published_results` | Published scoring results |

### Vendor Tables

| Table | Purpose |
|-------|---------|
| `vendor_business` | Vendor business profiles |
| `vendor_products` | Products/services for sale |

### Chat Tables

| Table | Purpose |
|-------|---------|
| `chat_messages` | Chat message history |

### User Fields (Notable)

| Field | Type | Purpose |
|-------|------|---------|
| `chat_enabled` | Boolean | User can access chat |
| `chat_blocked` | Boolean | User blocked from posting |

---

## Socket.io Events

### Client → Server

| Event | Payload | Purpose |
|-------|---------|---------|
| `join-role` | role string | Join role-based notification room |
| `join-app` | user object | Register as online in app |
| `join-chat` | user object | Join chat room |
| `chat-send` | { message } | Send chat message |
| `chat-block` | { user_id } | Admin: block user |
| `chat-unblock` | { user_id } | Admin: unblock user |

### Server → Client

| Event | Payload | Purpose |
|-------|---------|---------|
| `chat-message` | message object | New chat message |
| `chat-users-update` | users array | Online users list update |
| `chat-blocked` | - | You've been blocked |
| `chat-unblocked` | - | You've been unblocked |
| `notification` | { title, message } | Toast notification |
