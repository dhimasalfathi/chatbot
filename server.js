const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const { PORT, NODE_ENV } = require('./src/config/config');
const { loadSLAData } = require('./src/services/sla-service');
const { setupRoutes } = require('./src/routes/routes');

// -----------------------------
// Initialize Express App & Socket.IO
// -----------------------------
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
  pingInterval: 25000,
  pingTimeout: 20000,
  allowEIO3: true,
});

app.use(cors());
app.use(express.json({ limit: '2mb' }));

// -----------------------------
// Initialize Services
// -----------------------------
// Load SLA data on startup
loadSLAData();

// -----------------------------
// Setup Routes
// -----------------------------
setupRoutes(app);

// -----------------------------
// Static Files & Frontend Routes
// -----------------------------
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/chatbot', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'chatbot.html'));
});

// -----------------------------
// Socket.IO Real-time Features
// -----------------------------
// userId -> Set<socketId>
const userSockets = new Map();
const addUserSocket = (userId, sid) => {
  if (!userSockets.has(userId)) userSockets.set(userId, new Set());
  userSockets.get(userId).add(sid);
};
const removeUserSocket = (userId, sid) => {
  const set = userSockets.get(userId);
  if (!set) return;
  set.delete(sid);
  if (set.size === 0) userSockets.delete(userId);
};
const dmRoomOf = (a, b) => `dm:${[a, b].sort().join(":")}`;

function peersIn(room) {
  const r = io.sockets.adapter.rooms.get(room);
  if (!r) return [];
  return Array.from(r).map((sid) => {
    const s = io.sockets.sockets.get(sid);
    return { sid, userId: s?.data?.userId || "unknown" };
  });
}
function emitPresence(room) {
  io.to(room).emit("presence:list", { room, peers: peersIn(room) });
}

io.on("connection", (socket) => {
  console.log("🔌 Socket connected:", socket.id, "transport:", socket.conn.transport.name);
  
  // ---- IDENTITAS
  socket.on("auth:register", ({ userId }) => {
    if (!userId) return;
    socket.data.userId = userId;
    addUserSocket(userId, socket.id);
    socket.emit("auth:ok", { userId });
    console.log(`[auth] ${socket.id} -> ${userId}`);
  });

  // ---- BUKA DM BERDASAR ID
  socket.on("dm:open", ({ toUserId }) => {
    const from = socket.data.userId;
    if (!from || !toUserId) return;
    const room = dmRoomOf(from, toUserId);
    console.log(`[dm:open] ${from} -> ${toUserId} = ${room}`);

    socket.join(room);
    emitPresence(room);
    socket.emit("dm:pending", { room, toUserId });

    const targets = userSockets.get(toUserId);
    if (targets && targets.size > 0) {
      for (const sid of targets) {
        io.to(sid).emit("dm:request", { room, fromUserId: from });
      }
    }
  });

  socket.on("dm:join", ({ room }) => {
    if (!room) return;
    socket.join(room);
    emitPresence(room);
    const set = io.sockets.adapter.rooms.get(room);
    if (set && set.size >= 2) {
      io.to(room).emit("dm:ready", { room });
    }
  });

  // ---- Chat (TIDAK echo ke pengirim)
  socket.on("chat:send", (msg) => {
    if (!msg?.room) return;
    socket.to(msg.room).emit("chat:new", msg);
  });

  // ---- Mock call features
  socket.on("call:invite", ({ room }) => {
    if (!room) return;
    socket.to(room).emit("call:ringing", { fromUserId: socket.data.userId });
  });
  
  socket.on("call:accept", ({ room }) => {
    if (!room) return;
    socket.to(room).emit("call:accepted", {});
  });
  
  socket.on("call:decline", ({ room }) => {
    if (!room) return;
    socket.to(room).emit("call:declined", {});
  });

  socket.on("disconnect", (reason) => {
    const uid = socket.data.userId;
    if (uid) removeUserSocket(uid, socket.id);
    console.log("🔌 Socket disconnected:", socket.id, "reason:", reason);
  });
});

// Add Socket.IO status endpoint
app.get('/socket-status', (req, res) => {
  res.json({
    app: "bni-customer-care-integrated",
    socketio: "enabled", 
    connected_sockets: io.engine.clientsCount,
    time: new Date().toISOString()
  });
});

// -----------------------------
// Start Server
// -----------------------------
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Integrated Chatbot + Socket.IO Server running on http://0.0.0.0:${PORT}`);
  console.log(`📋 API Tester: http://localhost:${PORT}/`);
  console.log(`💬 Chatbot Interface: http://localhost:${PORT}/chatbot`);
  console.log(`🔌 Socket.IO Test: http://localhost:${PORT}/socket-test.html`);
  console.log(`📊 Socket Status: http://localhost:${PORT}/socket-status`);
  console.log(`\n📊 Service Info:`);
  console.log(`   Environment: ${NODE_ENV}`);
  console.log(`   Features: REST API + Socket.IO + Real-time Chat`);
  console.log(`   Access: All interfaces (nginx reverse proxy)`);
  
  if (NODE_ENV === 'production') {
    console.log(`🔴 Production mode - service running`);
  } else {
    console.log(`🟡 Development mode`);
  }
  
  const { LM_BASE_URL, LM_MODEL, LM_TEMPERATURE } = require('./src/config/config');
  console.log(`\n🔧 Configuration:`);
  console.log(`🤖 AI Service: ${LM_BASE_URL}`);
  console.log(`🌡️ Temperature: ${LM_TEMPERATURE}`);
  console.log(`🔌 Socket.IO: Enabled with real-time features`);
  console.log(`   Current AI URL: ${LM_BASE_URL}`);
});
