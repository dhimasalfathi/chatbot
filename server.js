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
  cors: { 
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["*"],
    credentials: false
  },
  allowEIO3: true,
  pingInterval: 25000,
  pingTimeout: 60000,
  transports: ['polling', 'websocket'], // Prioritize polling for tunnels
  upgradeTimeout: 30000,
  httpCompression: false,
  perMessageDeflate: false
});

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["*"]
}));
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

app.get('/socket-test', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'socket-test.html'));
});

app.get('/video-call-test', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'video-call-test.html'));
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

// Add engine error logging for debugging
io.engine.on("connection_error", (err) => {
  console.log(
    "[engine] connection_error",
    err?.code,
    err?.message,
    err?.context ? JSON.stringify(err.context) : ""
  );
});

io.on("connection", (socket) => {
  console.log("🔌 Socket connected:", socket.id, "transport:", socket.conn.transport.name);
  
  // Add transport upgrade logging
  socket.conn.on("upgrade", () => {
    console.log("🔄 Transport upgraded to:", socket.conn.transport.name);
  });
  
  // ---- IDENTITAS with enhanced debugging
  socket.on("auth:register", ({ userId }) => {
    if (!userId) return;
    socket.data.userId = userId;
    addUserSocket(userId, socket.id);
    socket.emit("auth:ok", { userId });
    console.log(`[auth] ${socket.id} -> ${userId} (total users: ${userSockets.size})`);
  });

  // ---- BUKA DM BERDASAR ID with enhanced debugging
  socket.on("dm:open", ({ toUserId }) => {
    const from = socket.data.userId;
    if (!from || !toUserId) return;
    const room = dmRoomOf(from, toUserId);
    console.log(`[dm:open] ${from} -> ${toUserId} = ${room}`);

    socket.join(room);
    emitPresence(room);
    socket.emit("dm:pending", { room, toUserId });

    const targets = userSockets.get(toUserId);
    console.log(`[dm:open] target user ${toUserId} has ${targets?.size || 0} active sockets`);
    if (targets && targets.size > 0) {
      for (const sid of targets) {
        console.log(`[dm:open] sending request to socket ${sid}`);
        io.to(sid).emit("dm:request", { room, fromUserId: from });
      }
    } else {
      console.log(`[dm:open] target user ${toUserId} is not online`);
    }
  });

  socket.on("dm:join", ({ room }) => {
    if (!room) return;
    console.log(`[dm:join] ${socket.data.userId} joining room ${room}`);
    socket.join(room);
    emitPresence(room);
    const set = io.sockets.adapter.rooms.get(room);
    console.log(`[dm:join] room ${room} now has ${set?.size || 0} members`);
    if (set && set.size >= 2) {
      console.log(`[dm:join] room ${room} is ready for communication`);
      io.to(room).emit("dm:ready", { room });
    }
  });

  // ---- Presence (umum)
  socket.on("presence:get", ({ room }) => {
    if (!room) return;
    socket.emit("presence:list", { room, peers: peersIn(room) });
  });

  // ---- Chat (TIDAK echo ke pengirim) with debugging
  socket.on("chat:send", (msg) => {
    if (!msg?.room) return;
    console.log(`[chat] message from ${socket.data.userId} to room ${msg.room}: ${msg.message?.substring(0, 50)}...`);
    socket.to(msg.room).emit("chat:new", msg);
  });

  // ---- Typing indicator with debugging
  socket.on("typing", ({ room }) => {
    if (!room) return;
    console.log(`[typing] from ${socket.data.userId} in room ${room}`);
    socket.to(room).emit("typing");
  });

  // ---- AUDIO CALL EVENTS (WebRTC Compatible)
  socket.on("audio:invite", ({ room }) => {
    if (!room) return;
    console.log(`[audio] invite from ${socket.data.userId} to room ${room}`);
    const roomPeers = peersIn(room);
    console.log(`[audio] room ${room} has ${roomPeers.length} peers:`, roomPeers.map(p => p.userId));
    socket.to(room).emit("call:ringing", {
      type: "audio",
      from: socket.data.userId,
      fromUserId: socket.data.userId,
      room
    });
  });

  socket.on("audio:accept", ({ room }) => {
    if (!room) return;
    console.log(`[audio] accept from ${socket.data.userId} in room ${room}`);
    socket.to(room).emit("audio:accepted", {
      from: socket.data.userId,
      fromUserId: socket.data.userId,
      room
    });
  });

  socket.on("audio:decline", ({ room }) => {
    if (!room) return;
    console.log(`[audio] decline from ${socket.data.userId} in room ${room}`);
    socket.to(room).emit("call:declined", {
      type: "audio",
      from: socket.data.userId,
      fromUserId: socket.data.userId,
      room
    });
  });

  socket.on("audio:hangup", ({ room }) => {
    if (!room) return;
    console.log(`[audio] hangup from ${socket.data.userId} in room ${room}`);
    socket.to(room).emit("call:ended", {
      type: "audio",
      from: socket.data.userId,
      fromUserId: socket.data.userId,
      room
    });
  });

  // ---- VIDEO CALL EVENTS (Enhanced with debugging)
  socket.on("call:invite", ({ room }) => {
    if (!room) return;
    console.log(`[call] invite from ${socket.data.userId} to room ${room}`);
    const roomPeers = peersIn(room);
    console.log(`[call] room ${room} has ${roomPeers.length} peers:`, roomPeers.map(p => p.userId));
    socket.to(room).emit("call:ringing", { 
      type: "video",
      fromUserId: socket.data.userId,
      room 
    });
  });
  
  socket.on("call:accept", ({ room }) => {
    if (!room) return;
    console.log(`[call] accept from ${socket.data.userId} in room ${room}`);
    socket.to(room).emit("call:accepted", { 
      fromUserId: socket.data.userId,
      room 
    });
  });
  
  socket.on("call:decline", ({ room }) => {
    if (!room) return;
    console.log(`[call] decline from ${socket.data.userId} in room ${room}`);
    socket.to(room).emit("call:declined", { 
      fromUserId: socket.data.userId,
      room 
    });
  });

  socket.on("call:hangup", ({ room }) => {
    if (!room) return;
    console.log(`[call] hangup from ${socket.data.userId} in room ${room}`);
    socket.to(room).emit("call:ended", { 
      fromUserId: socket.data.userId,
      room 
    });
  });

  socket.on("call:frame", ({ room, data }) => {
    if (!room || !data) return;
    // Don't log frame data as it's too verbose
    socket.to(room).emit("call:frame", { data });
  });

  // ---- WebRTC Signaling Events
  socket.on("webrtc:offer", ({ room, offer, audioOnly }) => {
    if (!room || !offer) {
      console.log(`[webrtc] offer rejected - missing data from ${socket.data.userId}`);
      return;
    }
    console.log(`[webrtc] offer from ${socket.data.userId} in ${room} (audio-only: ${!!audioOnly})`);
    socket.to(room).emit("webrtc:offer", {
      offer,
      room,
      audioOnly,
      fromUserId: socket.data.userId,
    });
  });

  socket.on("webrtc:answer", ({ room, answer }) => {
    if (!room || !answer) {
      console.log(`[webrtc] answer rejected - missing data from ${socket.data.userId}`);
      return;
    }
    console.log(`[webrtc] answer from ${socket.data.userId} in ${room}`);
    socket.to(room).emit("webrtc:answer", {
      answer,
      fromUserId: socket.data.userId,
      room
    });
  });

  socket.on("webrtc:ice-candidate", ({ room, candidate }) => {
    if (!room || !candidate) {
      console.log(`[webrtc] ice-candidate rejected - missing data from ${socket.data.userId}`);
      return;
    }
    console.log(`[webrtc] ice-candidate from ${socket.data.userId} in ${room}`);
    socket.to(room).emit("webrtc:ice-candidate", {
      candidate,
      fromUserId: socket.data.userId,
      room
    });
  });

  socket.on("webrtc:end-call", ({ room }) => {
    if (!room) {
      console.log(`[webrtc] end-call rejected - no room from ${socket.data.userId}`);
      return;
    }
    console.log(`[webrtc] end-call from ${socket.data.userId} in ${room}`);
    socket.to(room).emit("webrtc:end-call", {
      fromUserId: socket.data.userId,
      room
    });
  });

  // ---- WebRTC Media Controls
  socket.on("webrtc:audio-toggle", ({ room, enabled }) => {
    if (!room) return;
    console.log(`[webrtc] audio ${enabled ? "enabled" : "disabled"} from ${socket.data.userId}`);
    socket.to(room).emit("webrtc:audio-toggle", {
      fromUserId: socket.data.userId,
      enabled,
      room
    });
  });

  socket.on("webrtc:video-toggle", ({ room, enabled }) => {
    if (!room) return;
    console.log(`[webrtc] video ${enabled ? "enabled" : "disabled"} from ${socket.data.userId}`);
    socket.to(room).emit("webrtc:video-toggle", {
      fromUserId: socket.data.userId,
      enabled,
      room
    });
  });

  socket.on("webrtc:speaker-toggle", ({ room, enabled }) => {
    if (!room) return;
    console.log(`[webrtc] speaker ${enabled ? "enabled" : "disabled"} from ${socket.data.userId}`);
    socket.to(room).emit("webrtc:speaker-toggle", {
      fromUserId: socket.data.userId,
      enabled,
      room
    });
  });

  socket.on("webrtc:test", ({ room }) => {
    if (!room) return;
    const total = peersIn(room).length;
    console.log(`[webrtc] test from ${socket.data.userId} in ${room} - ${total} total peers`);
    socket.emit("webrtc:test:response", {
      success: true,
      peersInRoom: total,
      room,
      webrtcSupported: true,
    });
  });

  // ---- Enhanced Audio Streaming with WebRTC compatibility
  socket.on("audio:chunk", ({ room, data }) => {
    if (!room || !data) {
      console.log(`[audio] chunk rejected from ${socket.data.userId} (missing room/data)`);
      return;
    }
    const peers = peersIn(room).length;
    console.log(`[audio] chunk from ${socket.data.userId} in ${room} - peers: ${peers}, size: ${data?.length || 0}`);
    const payload = {
      data,
      timestamp: Date.now(),
      fromUserId: socket.data.userId,
      room,
    };
    socket.to(room).emit("audio:chunk", payload);
    socket.to(room).emit("audio:data", payload); // alias for compatibility
  });

  socket.on("audio:data", ({ room, data }) => {
    if (!room || !data) return;
    const payload = {
      data,
      timestamp: Date.now(),
      fromUserId: socket.data.userId,
      room,
    };
    socket.to(room).emit("audio:data", payload);
    socket.to(room).emit("audio:chunk", payload); // alias
  });
  
  socket.on("audio:start", ({ room }) => {
    if (!room) return;
    const peers = peersIn(room).length;
    console.log(`[audio] start from ${socket.data.userId} in ${room} - notifying ${peers - 1} peers`);
    socket.to(room).emit("audio:started", { 
      fromUserId: socket.data.userId,
      room 
    });
  });
  
  socket.on("audio:stop", ({ room }) => {
    if (!room) return;
    const peers = peersIn(room).length;
    console.log(`[audio] stop from ${socket.data.userId} in ${room} - notifying ${peers - 1} peers`);
    socket.to(room).emit("audio:stopped", { 
      fromUserId: socket.data.userId,
      room 
    });
  });

  socket.on("audio:mute", ({ room, muted }) => {
    if (!room) return;
    console.log(`[audio] ${muted ? "muted" : "unmuted"} from ${socket.data.userId} in ${room}`);
    socket.to(room).emit("audio:mute", {
      fromUserId: socket.data.userId,
      muted,
      room,
    });
  });

  socket.on("audio:speaker", ({ room, speaker }) => {
    if (!room) return;
    console.log(`[audio] speaker ${speaker ? "on" : "off"} from ${socket.data.userId} in ${room}`);
    socket.to(room).emit("audio:speaker", {
      fromUserId: socket.data.userId,
      speaker,
      room,
    });
  });

  socket.on("audio:test", ({ room }) => {
    if (!room) return;
    const total = peersIn(room).length;
    console.log(`[audio] test from ${socket.data.userId} in ${room} - ${total} total peers`);
    socket.emit("audio:test:response", {
      success: true,
      peersInRoom: total,
      room,
    });
  });

  // ---- Ticket Context Handler
  socket.on("ticket:context", ({ room, ticketId, fromUserId }) => {
    if (!room || !ticketId) {
      console.log(`[ticket] context rejected - missing data from ${socket.data.userId}`);
      return;
    }
    console.log(`[ticket] context from ${fromUserId || socket.data.userId} in ${room} - ticket: ${ticketId}`);
    socket.to(room).emit("ticket:context", {
      ticketId,
      fromUserId: fromUserId || socket.data.userId,
      room,
    });
  });

  // ---- Join/leave generic (kalau dipakai)
  socket.on("join", ({ room, userId }) => {
    if (!room) return;
    socket.join(room);
    if (userId) socket.data.userId = userId;
    emitPresence(room);
    console.log(`[join] ${socket.data.userId} joined ${room}`);
  });

  socket.on("leave", ({ room }) => {
    if (!room) return;
    socket.leave(room);
    emitPresence(room);
    console.log(`[leave] ${socket.data.userId} left ${room}`);
  });

  socket.on("disconnect", (reason) => {
    const uid = socket.data.userId;
    if (uid) {
      removeUserSocket(uid, socket.id);
      console.log(`🔌 Socket disconnected: ${socket.id} (user: ${uid}) reason: ${reason} (remaining users: ${userSockets.size})`);
    } else {
      console.log(`🔌 Socket disconnected: ${socket.id} reason: ${reason}`);
    }
  });
});

// Add Socket.IO status endpoint with detailed info
app.get('/socket-status', (req, res) => {
  const rooms = [];
  io.sockets.adapter.rooms.forEach((sockets, room) => {
    if (!room.includes('dm:')) return; // Only show DM rooms
    const peers = Array.from(sockets).map(sid => {
      const socket = io.sockets.sockets.get(sid);
      return {
        socketId: sid,
        userId: socket?.data?.userId || 'unknown'
      };
    });
    rooms.push({ room, peers });
  });

  res.json({
    app: "bni-customer-care-integrated",
    socketio: "enabled", 
    connected_sockets: io.engine.clientsCount,
    total_users: userSockets.size,
    active_rooms: rooms.length,
    rooms: rooms,
    features: {
      chat: "✅ READY",
      audio_calls: "✅ READY", 
      video_calls: "✅ READY",
      webrtc: "✅ READY"
    },
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
  console.log(`🔌 Socket.IO Test: http://localhost:${PORT}/socket-test`);
  console.log(`🎥 Video Call Test: http://localhost:${PORT}/video-call-test`);
  console.log(`📊 Socket Status: http://localhost:${PORT}/socket-status`);
  console.log(`\n📊 Service Info:`);
  console.log(`   Environment: ${NODE_ENV}`);
  console.log(`   Features: REST API + Socket.IO + Real-time Chat + WebRTC`);
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
  console.log(`📱 Live Chat: ✅ READY`);
  console.log(`📞 Audio Calls: ✅ READY`);
  console.log(`📹 Video Calls: ✅ READY`);
  console.log(`🌐 WebRTC: ✅ READY`);
  console.log(`   Current AI URL: ${LM_BASE_URL}`);
});
