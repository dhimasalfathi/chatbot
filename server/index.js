// server/index.js
// Simple Socket.IO DM server (chat + mock call) with presence & debug logs

const http = require("http");
const express = require("express");
const cors = require("cors");
const path = require("path");
const { Server } = require("socket.io");

const APP_NAME = "bni-customer-care-realtime";
const PORT = process.env.PORT || 3000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";

const app = express();
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.static(path.join(__dirname, '../public'))); // Serve static files

app.get("/", (_req, res) => res.send("OK"));
app.get("/status", (_req, res) =>
  res.json({ app: APP_NAME, status: "ok", time: new Date().toISOString() })
);

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: CORS_ORIGIN },
  pingInterval: 25000,
  pingTimeout: 20000,
  allowEIO3: true,
});

io.engine.on("connection_error", (err) => {
  console.log(
    "[engine] connection_error",
    err?.code,
    err?.message,
    err?.context ? JSON.stringify(err.context) : ""
  );
});

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
  console.log(
    "connected:",
    socket.id,
    "transport:",
    socket.conn.transport.name
  );
  socket.conn.on("upgrade", () => {
    console.log("transport upgraded to:", socket.conn.transport.name);
  });

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

    socket.join(room); // inisiator join
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

  // ---- Presence (umum)
  socket.on("presence:get", ({ room }) => {
    if (!room) return;
    socket.emit("presence:list", { room, peers: peersIn(room) });
  });

  // ---- Chat (TIDAK echo ke pengirim -> hindari duplikat)
  socket.on("chat:send", (msg) => {
    if (!msg?.room) return;
    socket.to(msg.room).emit("chat:new", msg); // <-- perbaikan utama
  });

  socket.on("typing", ({ room }) => {
    if (!room) return;
    socket.to(room).emit("typing");
  });

  // ---- Mock call (opsional)
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
  socket.on("call:hangup", ({ room }) => {
    if (!room) return;
    socket.to(room).emit("call:ended", {});
  });
  socket.on("call:frame", ({ room, data }) => {
    if (!room || !data) return;
    socket.to(room).emit("call:frame", { data });
  });

  // ---- Video streaming handlers for continuous video call
  socket.on("video:stream", ({ room, data }) => {
    if (!room || !data) {
      console.log(`[video] stream rejected - missing room or data from ${socket.data.userId}`);
      return;
    }
    const roomPeers = peersIn(room);
    console.log(`[video] stream from ${socket.data.userId} in ${room} - peers: ${roomPeers.length}`);
    
    // Broadcast video stream to all other peers in the room
    socket.to(room).emit("video:stream", { 
      data, 
      timestamp: Date.now(), 
      fromUserId: socket.data.userId,
      room: room
    });
  });

  socket.on("video:start", ({ room }) => {
    if (!room) {
      console.log(`[video] start rejected - no room specified from ${socket.data.userId}`);
      return;
    }
    const roomPeers = peersIn(room);
    console.log(`[video] start from ${socket.data.userId} in ${room} - notifying ${roomPeers.length - 1} peers`);
    socket.to(room).emit("video:started", { fromUserId: socket.data.userId, room: room });
  });

  socket.on("video:stop", ({ room }) => {
    if (!room) {
      console.log(`[video] stop rejected - no room specified from ${socket.data.userId}`);
      return;
    }
    const roomPeers = peersIn(room);
    console.log(`[video] stop from ${socket.data.userId} in ${room} - notifying ${roomPeers.length - 1} peers`);
    socket.to(room).emit("video:stopped", { fromUserId: socket.data.userId, room: room });
  });

  // ---- Video quality control
  socket.on("video:mute", ({ room, muted }) => {
    if (!room) {
      console.log(`[video] mute rejected - no room specified from ${socket.data.userId}`);
      return;
    }
    console.log(`[video] ${muted ? 'camera off' : 'camera on'} from ${socket.data.userId} in ${room}`);
    socket.to(room).emit("video:mute", { fromUserId: socket.data.userId, muted, room: room });
  });

  socket.on("video:quality", ({ room, quality }) => {
    if (!room) {
      console.log(`[video] quality rejected - no room specified from ${socket.data.userId}`);
      return;
    }
    console.log(`[video] quality ${quality} from ${socket.data.userId} in ${room}`);
    socket.to(room).emit("video:quality", { fromUserId: socket.data.userId, quality, room: room });
  });

  // ---- Video connection test
  socket.on("video:test", ({ room }) => {
    if (!room) return;
    const roomPeers = peersIn(room);
    console.log(`[video] test from ${socket.data.userId} in ${room} - ${roomPeers.length} total peers`);
    socket.emit("video:test:response", { 
      success: true, 
      peersInRoom: roomPeers.length,
      room: room 
    });
  });

  // ---- Audio streaming handlers with enhanced logging
  socket.on("audio:chunk", ({ room, data }) => {
    if (!room) {
      console.log(`[audio] chunk rejected - no room specified from ${socket.data.userId}`);
      return;
    }
    const roomPeers = peersIn(room);
    console.log(`[audio] chunk from ${socket.data.userId} in ${room} - peers: ${roomPeers.length}`);
    
    // Broadcast to all other peers in the room
    socket.to(room).emit("audio:chunk", { 
      data, 
      timestamp: Date.now(), 
      fromUserId: socket.data.userId,
      room: room
    });
  });

  socket.on("audio:start", ({ room }) => {
    if (!room) {
      console.log(`[audio] start rejected - no room specified from ${socket.data.userId}`);
      return;
    }
    const roomPeers = peersIn(room);
    console.log(`[audio] start from ${socket.data.userId} in ${room} - notifying ${roomPeers.length - 1} peers`);
    socket.to(room).emit("audio:started", { fromUserId: socket.data.userId, room: room });
  });

  socket.on("audio:stop", ({ room }) => {
    if (!room) {
      console.log(`[audio] stop rejected - no room specified from ${socket.data.userId}`);
      return;
    }
    const roomPeers = peersIn(room);
    console.log(`[audio] stop from ${socket.data.userId} in ${room} - notifying ${roomPeers.length - 1} peers`);
    socket.to(room).emit("audio:stopped", { fromUserId: socket.data.userId, room: room });
  });

  // ---- Audio quality control with enhanced logging
  socket.on("audio:mute", ({ room, muted }) => {
    if (!room) {
      console.log(`[audio] mute rejected - no room specified from ${socket.data.userId}`);
      return;
    }
    console.log(`[audio] ${muted ? 'muted' : 'unmuted'} from ${socket.data.userId} in ${room}`);
    socket.to(room).emit("audio:mute", { fromUserId: socket.data.userId, muted, room: room });
  });

  socket.on("audio:speaker", ({ room, speaker }) => {
    if (!room) {
      console.log(`[audio] speaker rejected - no room specified from ${socket.data.userId}`);
      return;
    }
    console.log(`[audio] speaker ${speaker ? 'on' : 'off'} from ${socket.data.userId} in ${room}`);
    socket.to(room).emit("audio:speaker", { fromUserId: socket.data.userId, speaker, room: room });
  });

  // ---- Audio connection test
  socket.on("audio:test", ({ room }) => {
    if (!room) return;
    const roomPeers = peersIn(room);
    console.log(`[audio] test from ${socket.data.userId} in ${room} - ${roomPeers.length} total peers`);
    socket.emit("audio:test:response", { 
      success: true, 
      peersInRoom: roomPeers.length,
      room: room 
    });
  });

  // ---- Join/leave generic (kalau dipakai)
  socket.on("join", ({ room, userId }) => {
    if (!room) return;
    socket.join(room);
    if (userId) socket.data.userId = userId;
    emitPresence(room);
  });
  socket.on("leave", ({ room }) => {
    if (!room) return;
    socket.leave(room);
    emitPresence(room);
  });

  socket.on("disconnect", (reason) => {
    const uid = socket.data.userId;
    if (uid) removeUserSocket(uid, socket.id);
    console.log("disconnected:", socket.id, "reason:", reason);
  });
});

server.listen(PORT, () => {
  console.log(`${APP_NAME} listening on http://0.0.0.0:${PORT}`);
});