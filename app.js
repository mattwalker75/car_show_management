// app.js - Car Show Management App entry point
// Sets up Express, session, static files, and mounts all route modules.

const express = require('express');
const http = require('http');
const https = require('https');
const fs = require('fs');
const cookieSession = require('cookie-session');
const morgan = require('morgan');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { Server: SocketIOServer } = require('socket.io');
const Filter = require('bad-words-plus');
const profanityFilter = new Filter({ firstLetter: true });

// Initialize database (creates tables on startup)
const db = require('./db/database');

// Load app config and multer upload middleware
const { appConfig, saveConfig, upload } = require('./config/appConfig');

const app = express();
const port = appConfig.port || 3001;

// Server configuration for SSL, trust proxy, and certificate paths
// Configured via config.json server section. See config.md for details.
const serverConfig = appConfig.server || {};

// Trust proxy setting for deployments behind a reverse proxy/load balancer.
app.set('trust proxy', serverConfig.trustProxy || false);

// ── Security Middleware ────────────────────────────────────────────────
const securityConfig = appConfig.security || {};
const headersConfig = securityConfig.headers || {};
const sessionConfig = securityConfig.session || {};
const rateLimitConfig = securityConfig.rateLimiting || {};

// Security headers via Helmet (see config.md for details)
if (headersConfig.enabled !== false) {
  app.use(helmet({
    contentSecurityPolicy: headersConfig.contentSecurityPolicy || false,
    crossOriginEmbedderPolicy: headersConfig.crossOriginEmbedderPolicy || false
  }));
}

// Rate limiting for auth endpoints (per IP address)
const authRateConfig = rateLimitConfig.auth || {};
const authLimiter = rateLimit({
  windowMs: (authRateConfig.windowSeconds || 900) * 1000,
  max: authRateConfig.maxAttempts || 5,
  message: 'Too many login attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/login', authLimiter);
app.use('/register', authLimiter);

// Rate limiting for general API endpoints (per IP address)
const apiRateConfig = rateLimitConfig.api || {};
const apiLimiter = rateLimit({
  windowMs: (apiRateConfig.windowSeconds || 60) * 1000,
  max: apiRateConfig.maxRequests || 100,
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/admin', apiLimiter);
app.use('/judge', apiLimiter);
app.use('/registrar', apiLimiter);
app.use('/user', apiLimiter);
app.use('/vendor', apiLimiter);
app.use('/chat', apiLimiter);

// ── Middleware ─────────────────────────────────────────────────────────
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(express.json({ limit: '10kb' }));
app.use(express.static('public'));
app.use('/images', express.static('images'));

// Session keys from config.json - CHANGE THESE IN PRODUCTION!
// Use long, random strings (32+ characters) for security.
const sessionKeys = appConfig.sessionKeys || ['fallback-key-change-me', 'fallback-backup-key'];
const defaultKeys = ['change-this-to-a-random-secret-key', 'change-this-backup-key-too'];
if (sessionKeys[0] === defaultKeys[0] || sessionKeys[1] === defaultKeys[1]) {
  console.warn('\n⚠️  WARNING: Using default session keys. Change sessionKeys in config.json for production!\n');
}
app.use(cookieSession({
  name: 'session',
  keys: sessionKeys,
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
  secure: sessionConfig.secure !== false, // Only send over HTTPS (default: true)
  httpOnly: sessionConfig.httpOnly !== false, // Prevent JS access (default: true)
  sameSite: sessionConfig.sameSite || 'strict' // CSRF protection (default: strict)
}));

// CSRF protection: verify Origin header on state-changing requests
// Works with SameSite=strict cookies to prevent cross-site request forgery
app.use((req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  const origin = req.get('Origin');
  const host = req.get('Host');
  // Allow requests without Origin (same-origin form submissions)
  // or where Origin matches Host
  if (!origin || origin.includes(host)) {
    return next();
  }
  console.warn(`CSRF blocked: Origin ${origin} != Host ${host}`);
  return res.status(403).send('Forbidden');
});

// Custom morgan token for logged-in username
morgan.token('username', (req) => {
  return (req.session && req.session.user) ? req.session.user.username : 'anon';
});
app.use(morgan(':remote-addr - :username - :method :url HTTP/:http-version :status :res[content-length] - :response-time ms'));

// ── Route Modules ─────────────────────────────────────────────────────

// Public routes (login, register, setup, logout, dashboard redirect)
app.use('/', require('./routes/public')(db, appConfig, upload, port));

// Shared profile routes (all roles: admin, judge, registrar, vendor, user)
app.use('/', require('./routes/profile')(db, appConfig, upload));

// Role-specific routes
app.use('/admin', require('./routes/admin')(db, appConfig, upload));
app.use('/admin', require('./routes/adminConfig')(db, appConfig, upload, saveConfig));
app.use('/admin', require('./routes/adminVoting')(db, appConfig, upload, saveConfig));
app.use('/judge', require('./routes/judge')(db, appConfig, upload));
app.use('/registrar', require('./routes/registrar')(db, appConfig, upload));
app.use('/user', require('./routes/user')(db, appConfig, upload));
app.use('/vendor', require('./routes/vendor')(db, appConfig, upload));

// Chat routes (group chat for users with chat_enabled)
app.use('/chat', require('./routes/chat')(db, appConfig, upload));

// ── Health Check Endpoint ─────────────────────────────────────────────
// Used by load balancers and monitoring systems
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// ── 404 Handler ───────────────────────────────────────────────────────
// Must be after all routes - catches requests that don't match any route
app.use((req, res) => {
  res.status(404).send('Not Found');
});

// ── Global Error Handler ──────────────────────────────────────────────
// Must be last middleware - catches unhandled errors from routes
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).send('Internal Server Error');
});

// ── HTTP/HTTPS Server ─────────────────────────────────────────────────
// When server.ssl is true (default), runs HTTPS with certificate files.
// When server.ssl is false, runs plain HTTP (for use behind ALB/proxy).
const sslEnabled = serverConfig.ssl !== false; // Default to true for backward compatibility

let server;
if (sslEnabled) {
  const keyPath = serverConfig.keyPath || './key.pem';
  const certPath = serverConfig.certPath || './cert.pem';

  if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
    console.error('SSL certificate files not found. Please configure server.keyPath and server.certPath in config.json');
    console.error('Or set server.ssl to false for HTTP mode (when behind a load balancer).');
    process.exit(1);
  }

  const options = {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath)
  };

  server = https.createServer(options, app);
} else {
  server = http.createServer(app);
}

// Set request timeout to prevent long-running requests from exhausting resources
server.setTimeout(30000); // 30 seconds

// ── Socket.io for real-time notifications ──────────────────────────────
const io = new SocketIOServer(server);
app.set('io', io);

// Rate limiting: track last message timestamp per user_id (500ms between messages)
const chatRateLimit = new Map();
const CHAT_RATE_LIMIT_MS = 500;

// Clean up stale rate limit entries every 5 minutes to prevent memory leaks
// Entries older than 1 minute are removed (well past the 500ms window)
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of chatRateLimit.entries()) {
    if (now - timestamp > 60000) {
      chatRateLimit.delete(key);
    }
  }
}, 300000);

// Track message count for periodic cleanup instead of per-message
let chatMessageCount = 0;
const CHAT_CLEANUP_INTERVAL = 100;

// Helper: broadcast presence list with active/away/blocked status
// 'active' = user has the chat page open, 'away' = user is in the app but on another page
function broadcastPresence() {
  const appRoom = io.sockets.adapter.rooms.get('app');
  const chatRoom = io.sockets.adapter.rooms.get('chat');
  if (!appRoom) {
    io.to('chat').emit('chat-users-update', []);
    return;
  }

  // Collect all app-connected users (deduplicated by user_id)
  const users = new Map();
  for (const sid of appRoom) {
    const s = io.sockets.sockets.get(sid);
    if (s && s.appUser && !users.has(s.appUser.user_id)) {
      users.set(s.appUser.user_id, {
        user_id: s.appUser.user_id,
        name: s.appUser.name,
        role: s.appUser.role,
        image_url: s.appUser.image_url,
        status: 'away',
        chat_blocked: false
      });
    }
  }

  // Upgrade to 'active' for users also in the chat room
  if (chatRoom) {
    for (const sid of chatRoom) {
      const s = io.sockets.sockets.get(sid);
      if (s && s.chatUser && users.has(s.chatUser.user_id)) {
        users.get(s.chatUser.user_id).status = 'active';
      }
    }
  }

  // Fetch blocked status from DB for all online users
  const userIds = Array.from(users.keys());
  if (userIds.length === 0) {
    io.to('chat').emit('chat-users-update', []);
    return;
  }
  const placeholders = userIds.map(() => '?').join(',');
  db.allAsync(
    `SELECT user_id, chat_blocked FROM users WHERE user_id IN (${placeholders})`,
    userIds
  ).then((rows) => {
    for (const row of rows) {
      if (users.has(row.user_id)) {
        users.get(row.user_id).chat_blocked = row.chat_blocked === 1;
      }
    }
    io.to('chat').emit('chat-users-update', Array.from(users.values()));
  }).catch((err) => {
    console.error('broadcastPresence DB error:', err.message);
    io.to('chat').emit('chat-users-update', Array.from(users.values()));
  });
}

io.on('connection', (socket) => {
  // Notification room joining - only allow valid roles
  socket.on('join-role', (role) => {
    if (['admin', 'judge', 'registrar', 'vendor', 'user'].includes(role)) {
      socket.join('role:' + role);
      socket.join('role:all');
    }
  });

  // App-level presence: track that user is somewhere in the app
  // Verifies user exists in database and uses DB values (not client-provided)
  socket.on('join-app', async (data) => {
    if (!data || !data.user_id) return;
    try {
      const user = await db.getAsync(
        'SELECT user_id, name, role, image_url FROM users WHERE user_id = ?',
        [data.user_id]
      );
      if (!user) return; // Invalid user_id
      socket.appUser = {
        user_id: user.user_id,
        name: user.name,
        role: user.role,
        image_url: user.image_url || null
      };
      socket.join('app');
      broadcastPresence();
    } catch (err) {
      console.error('join-app verification error:', err.message);
    }
  });

  // Chat: join the chat room
  // Verifies user exists and has chat access, uses DB values
  socket.on('join-chat', async (data) => {
    if (!data || !data.user_id) return;
    try {
      const user = await db.getAsync(
        'SELECT user_id, name, role, image_url, chat_enabled FROM users WHERE user_id = ?',
        [data.user_id]
      );
      if (!user || !user.chat_enabled) return; // Invalid user or chat not enabled
      socket.chatUser = {
        user_id: user.user_id,
        name: user.name,
        role: user.role,
        image_url: user.image_url || null
      };
      socket.join('chat');
      broadcastPresence();
    } catch (err) {
      console.error('join-chat verification error:', err.message);
    }
  });

  // Chat: send a message
  socket.on('chat-send', (data) => {
    if (!socket.chatUser || !data || !data.message) return;

    // Rate limit: 1 message per second per user
    // Messages sent faster than this are silently dropped (not queued/delayed).
    // This is server-side only - no client feedback. If a user spams, extra
    // messages simply won't appear. Consider adding client-side throttling
    // with UI feedback if this causes confusion.
    const userId = socket.chatUser.user_id;
    const now = Date.now();
    const lastSent = chatRateLimit.get(userId) || 0;
    if (now - lastSent < CHAT_RATE_LIMIT_MS) {
      return;
    }
    chatRateLimit.set(userId, now);

    // Check if user is blocked before allowing message
    db.getAsync(
      'SELECT chat_blocked FROM users WHERE user_id = ?',
      [socket.chatUser.user_id]
    ).then((row) => {
      if (!row || row.chat_blocked === 1) {
        socket.emit('chat-blocked'); // Re-notify in case client state is stale
        return;
      }

      const rawMessage = String(data.message).trim().slice(0, 250);
      if (!rawMessage) return;
      const message = profanityFilter.clean(rawMessage);

      return db.runAsync(
        'INSERT INTO chat_messages (user_id, message) VALUES (?, ?)',
        [socket.chatUser.user_id, message]
      ).then((result) => {
        io.to('chat').emit('chat-message', {
          message_id: result.lastID,
          user_id: socket.chatUser.user_id,
          name: socket.chatUser.name,
          role: socket.chatUser.role,
          image_url: socket.chatUser.image_url,
          message: message,
          created_at: new Date().toISOString()
        });

        // Cleanup: delete oldest messages periodically (every N messages)
        // instead of on every message to reduce database overhead
        chatMessageCount++;
        if (chatMessageCount >= CHAT_CLEANUP_INTERVAL) {
          chatMessageCount = 0;
          const limit = appConfig.chatMessageLimit || 200;
          return db.runAsync(
            `DELETE FROM chat_messages WHERE message_id NOT IN (
              SELECT message_id FROM chat_messages ORDER BY message_id DESC LIMIT ?
            )`,
            [limit]
          );
        }
      });
    }).catch((err) => {
      console.error('Chat message error:', err.message);
    });
  });

  // Chat: admin blocks a user from posting (read-only mode)
  socket.on('chat-block', (data) => {
    if (!socket.chatUser || socket.chatUser.role !== 'admin') return;
    if (!data || !data.user_id) return;
    const targetUserId = parseInt(data.user_id, 10);
    if (isNaN(targetUserId)) return;

    db.getAsync('SELECT role FROM users WHERE user_id = ?', [targetUserId])
      .then((row) => {
        if (!row || row.role === 'admin') return;
        return db.runAsync('UPDATE users SET chat_blocked = 1 WHERE user_id = ?', [targetUserId])
          .then(() => {
            // Notify the blocked user's socket(s) directly
            const chatRoom = io.sockets.adapter.rooms.get('chat');
            if (chatRoom) {
              for (const sid of chatRoom) {
                const s = io.sockets.sockets.get(sid);
                if (s && s.chatUser && s.chatUser.user_id === targetUserId) {
                  s.emit('chat-blocked');
                }
              }
            }
            broadcastPresence();
          });
      })
      .catch((err) => { console.error('chat-block error:', err.message); });
  });

  // Chat: admin unblocks a user
  socket.on('chat-unblock', (data) => {
    if (!socket.chatUser || socket.chatUser.role !== 'admin') return;
    if (!data || !data.user_id) return;
    const targetUserId = parseInt(data.user_id, 10);
    if (isNaN(targetUserId)) return;

    db.runAsync('UPDATE users SET chat_blocked = 0 WHERE user_id = ?', [targetUserId])
      .then(() => {
        const chatRoom = io.sockets.adapter.rooms.get('chat');
        if (chatRoom) {
          for (const sid of chatRoom) {
            const s = io.sockets.sockets.get(sid);
            if (s && s.chatUser && s.chatUser.user_id === targetUserId) {
              s.emit('chat-unblocked');
            }
          }
        }
        broadcastPresence();
      })
      .catch((err) => { console.error('chat-unblock error:', err.message); });
  });

  // Handle disconnect — delay to handle page refreshes
  socket.on('disconnect', () => {
    if (socket.appUser || socket.chatUser) {
      setTimeout(() => { broadcastPresence(); }, 500);
    }
    // Clean up rate limit tracking for this user
    if (socket.chatUser) {
      chatRateLimit.delete(socket.chatUser.user_id);
    }
  });
});

// Wait for database migrations to complete before starting server
db.ready.then(() => {
  const protocol = sslEnabled ? 'https' : 'http';
  server.listen(port, () => {
    console.log(`Car Show Voting App listening at ${protocol}://localhost:${port}`);
    if (sslEnabled) {
      console.log('Note: You may see a security warning in your browser - this is expected for self-signed certificates');
    } else {
      console.log('Running in HTTP mode (SSL disabled) - ensure you are behind a secure proxy');
    }
  });
}).catch((err) => {
  console.error('Failed to initialize database:', err.message);
  process.exit(1);
});

// ── Graceful Shutdown ─────────────────────────────────────────────────
// Handle shutdown signals to close connections cleanly
const gracefulShutdown = async (signal) => {
  console.log(`\n${signal} received, shutting down gracefully...`);

  // Force exit after 10 seconds if graceful shutdown takes too long
  const forceExitTimeout = setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);

  try {
    // Close Socket.io connections
    await new Promise((resolve) => {
      io.close(() => {
        console.log('Socket.io connections closed');
        resolve();
      });
    });

    // Close HTTP server
    await new Promise((resolve) => {
      server.close(() => {
        console.log('HTTP server closed');
        resolve();
      });
    });

    // Close database connection
    if (db.close) {
      await db.close();
    }

    clearTimeout(forceExitTimeout);
    process.exit(0);
  } catch (err) {
    console.error('Error during shutdown:', err.message);
    clearTimeout(forceExitTimeout);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
