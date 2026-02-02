// app.js - Car Show Management App entry point
// Sets up Express, session, static files, and mounts all route modules.

const express = require('express');
const https = require('https');
const fs = require('fs');
const cookieSession = require('cookie-session');
const morgan = require('morgan');
const { Server: SocketIOServer } = require('socket.io');

// Initialize database (creates tables on startup)
const db = require('./db/database');

// Load app config and multer upload middleware
const { appConfig, saveConfig, upload } = require('./config/appConfig');

const app = express();
const port = 3001;

// ── Middleware ─────────────────────────────────────────────────────────
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(express.json({ limit: '10kb' }));
app.use(express.static('public'));
app.use('/images', express.static('images'));

app.use(cookieSession({
  name: 'session',
  keys: ['car-show-secret-key-2024', 'backup-secret-key'],
  maxAge: 24 * 60 * 60 * 1000 // 24 hours
}));

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

// ── HTTPS Server ──────────────────────────────────────────────────────
const options = {
  key: fs.readFileSync('/Users/matt/Desktop/My_Data/AI/Vibe_Coding/REPOS/key.pem'),
  cert: fs.readFileSync('/Users/matt/Desktop/My_Data/AI/Vibe_Coding/REPOS/cert.pem')
};

const server = https.createServer(options, app);

// ── Socket.io for real-time notifications ──────────────────────────────
const io = new SocketIOServer(server);
app.set('io', io);

// Helper: broadcast presence list with active/away status
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
        status: 'away'
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

  io.to('chat').emit('chat-users-update', Array.from(users.values()));
}

io.on('connection', (socket) => {
  // Notification room joining
  socket.on('join-role', (role) => {
    if (['admin', 'judge', 'registrar', 'vendor', 'user'].includes(role)) {
      socket.join('role:' + role);
      socket.join('role:all');
    }
  });

  // App-level presence: track that user is somewhere in the app
  socket.on('join-app', (data) => {
    if (!data || !data.user_id || !data.name) return;
    socket.appUser = {
      user_id: data.user_id,
      name: data.name,
      role: data.role || 'user',
      image_url: data.image_url || null
    };
    socket.join('app');
    broadcastPresence();
  });

  // Chat: join the chat room
  socket.on('join-chat', (data) => {
    if (!data || !data.user_id || !data.name) return;
    socket.chatUser = {
      user_id: data.user_id,
      name: data.name,
      role: data.role || 'user',
      image_url: data.image_url || null
    };
    socket.join('chat');
    broadcastPresence();
  });

  // Chat: send a message
  socket.on('chat-send', (data) => {
    if (!socket.chatUser || !data || !data.message) return;
    const message = String(data.message).trim().slice(0, 500);
    if (!message) return;

    db.runAsync(
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
    }).catch((err) => {
      console.error('Chat message insert error:', err.message);
    });
  });

  // Handle disconnect — delay to handle page refreshes
  socket.on('disconnect', () => {
    if (socket.appUser || socket.chatUser) {
      setTimeout(() => { broadcastPresence(); }, 500);
    }
  });
});

server.listen(port, () => {
  console.log(`Car Show Voting App listening at https://localhost:${port}`);
  console.log('Note: You may see a security warning in your browser - this is expected for self-signed certificates');
});

console.log('To access the application:');
console.log('1. Open your browser and go to: https://localhost:3001');
console.log('2. You will see a security warning - accept it to continue');
