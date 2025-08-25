// server/index.js
// BNI Customer Care Realtime Server (Unified)
// - Menggabungkan dua server kamu menjadi satu
// - Fitur: Auth, Presence, DM, Chat, Audio streaming, Mock Call (audio/video), WebRTC signaling, Ticket context
// - Kompatibel: socket.userId & socket.data.userId, audio:data ↔ audio:chunk, call:stream ↔ call:frame
// - Endpoint: "/", "/status", "/health"

const http = require("http");
const express = require("express");
const cors = require("cors");
const { Server } = require("socket.io");

// ---- Konfigurasi
const APP_NAME = "bni-customer-care-realtime";
const PORT = process.env.PORT || 4000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
const AUTO_JOIN_DM_PEER = true; // kompat untuk perilaku server ke-2: auto-join target ke room DM

const app = express();
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

// Endpoint health/diagnostic
app.get("/", (_req, res) => res.send("OK"));
app.get("/status", (_req, res) =>
  res.json({ app: APP_NAME, status: "ok", time: new Date().toISOString() })
);
app.get("/health", (_req, res) =>
  res.json({ status: "ok", timestamp: new Date().toISOString() })
);

// ---- Socket.IO
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: CORS_ORIGIN, methods: ["GET", "POST"] },
  pingInterval: 25000,
  pingTimeout: 20000,
  allowEIO3: true, // kompat klien lama
});

io.engine.on("connection_error", (err) => {
  console.log(
    "[engine] connection_error",
    err?.code,
    err?.message,
    err?.context ? JSON.stringify(err.context) : ""
  );
});

// ---- State & Helpers
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

// DM room deterministik agar konsisten di kedua sisi
const dmRoomOf = (a, b) => dm:${[a, b].sort().join(":")};

function peersIn(room) {
  const r = io.sockets.adapter.rooms.get(room);
  if (!r) return [];
  return Array.from(r).map((sid) => {
    const s = io.sockets.sockets.get(sid);
    return { sid, userId: s?.data?.userId || s?.userId || "unknown" };
  });
}

function emitPresence(room) {
  io.to(room).emit("presence:list", { room, peers: peersIn(room) });
}

function setSocketUserId(socket, userId) {
  // Kompat untuk dua implementasi lama
  socket.userId = userId;
  socket.data.userId = userId;
}

// ---- Socket Handlers
io.on("connection", (socket) => {
  console.log(
    "connected:",
    socket.id,
    "transport:",
    socket.conn?.transport?.name
  );
  socket.conn?.on?.("upgrade", () => {
    console.log("transport upgraded to:", socket.conn.transport.name);
  });

  // ---- AUTH
  socket.on("auth:register", ({ userId }) => {
    if (!userId) return;
    setSocketUserId(socket, userId);
    addUserSocket(userId, socket.id);
    socket.emit("auth:ok", { userId });
    console.log([auth] ${socket.id} -> ${userId});
  });

  // ---- ROOM JOIN/LEAVE (generic)
  socket.on("join", ({ room, userId }) => {
    if (!room) return;
    if (userId) setSocketUserId(socket, userId);
    socket.join(room);
    emitPresence(room);
    console.log([join] ${socket.data.userId || socket.userId} joined ${room});
  });

  socket.on("leave", ({ room }) => {
    if (!room) return;
    socket.leave(room);
    emitPresence(room);
    console.log([leave] ${socket.data.userId || socket.userId} left ${room});
  });

  // ---- Presence
  socket.on("presence:get", ({ room }) => {
    if (!room) return;
    socket.emit("presence:list", { room, peers: peersIn(room) });
  });

  // ---- DM FLOW
  // Versi gabungan:
  // - Buat room deterministik (server 1)
  // - Kirim dm:request ke target
  // - (opsional) Auto-join target ke room (server 2) agar langsung ready
  socket.on("dm:open", ({ toUserId }) => {
    const from = socket.data.userId || socket.userId;
    if (!from || !toUserId) return;
    const room = dmRoomOf(from, toUserId);
    console.log([dm:open] ${from} -> ${toUserId} = ${room});

    socket.join(room); // inisiator join
    emitPresence(room);
    socket.emit("dm:pending", { room, toUserId });

    const targets = userSockets.get(toUserId);
    if (targets && targets.size > 0) {
      for (const sid of targets) {
        const peer = io.sockets.sockets.get(sid);
        if (AUTO_JOIN_DM_PEER) peer?.join(room); // kompat server 2
        io.to(sid).emit("dm:request", { room, fromUserId: from });
      }
      emitPresence(room);
      const set = io.sockets.adapter.rooms.get(room);
      if (set && set.size >= 2) io.to(room).emit("dm:ready", { room });
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

  socket.on("dm:request", ({ room }) => {
    if (!room) return;
    console.log(
      `[dm] request from ${
        socket.data.userId || socket.userId
      } for room ${room}`
    );
    socket.join(room);
    emitPresence(room);
    socket.to(room).emit("dm:ready", { room });
  });

  // ---- CHAT
  // Kompat:
  // - Server 1: tidak echo ke pengirim (hindari duplikat UI)
  // - Server 2: broadcast ke semua di room
  // Solusi: jika payload.message?.echo === true -> io.to(room),
  // selain itu socket.to(room) (default: tidak echo)
  socket.on("chat:send", (message) => {
    if (!message?.room) return;
    const meta = {
      ...message,
      fromUserId: message.fromUserId || socket.data.userId || socket.userId,
      timestamp: message.timestamp || Date.now(),
    };
    if (message?.echo === true) {
      io.to(message.room).emit("chat:new", meta);
    } else {
      socket.to(message.room).emit("chat:new", meta);
    }
  });

  socket.on("typing", ({ room }) => {
    if (!room) return;
    socket.to(room).emit("typing");
  });

  // ---- MOCK CALL (kompat audio & video event names)
  // AUDIO-style (server 2)
  socket.on("audio:invite", ({ room }) => {
    if (!room) return;
    console.log("[audio] invite", { room });
    socket
      .to(room)
      .emit("call:ringing", {
        type: "audio",
        from: socket.data.userId || socket.userId,
        room,
      });
  });
  socket.on("audio:accept", ({ room }) => {
    if (!room) return;
    console.log("[audio] accept", { room });
    socket
      .to(room)
      .emit("audio:accepted", {
        from: socket.data.userId || socket.userId,
        room,
      });
  });
  socket.on("audio:decline", ({ room }) => {
    if (!room) return;
    console.log("[audio] decline", { room });
    socket
      .to(room)
      .emit("call:declined", {
        type: "audio",
        from: socket.data.userId || socket.userId,
        room,
      });
  });
  socket.on("audio:hangup", ({ room }) => {
    if (!room) return;
    console.log("[audio] hangup", { room });
    socket
      .to(room)
      .emit("call:ended", {
        type: "audio",
        from: socket.data.userId || socket.userId,
        room,
      });
  });

  // VIDEO-style (server 2) + mock call (server 1)
  socket.on("call:invite", ({ room }) => {
    if (!room) return;
    console.log("[call] invite", { room });
    socket
      .to(room)
      .emit("call:ringing", {
        type: "video",
        fromUserId: socket.data.userId || socket.userId,
        room,
      });
  });
  socket.on("call:accept", ({ room }) => {
    if (!room) return;
    console.log("[call] accept", { room });
    socket.to(room).emit("call:accepted", {});
  });
  socket.on("call:decline", ({ room }) => {
    if (!room) return;
    console.log("[call] decline", { room });
    socket.to(room).emit("call:declined", {});
  });
  socket.on("call:hangup", ({ room }) => {
    if (!room) return;
    console.log("[call] hangup", { room });
    socket.to(room).emit("call:ended", {});
  });

  // Stream alias (kompat):
  // - server 1: call:frame
  // - server 2: call:stream
  socket.on("call:frame", ({ room, data }) => {
    if (!room || !data) return;
    socket.to(room).emit("call:frame", { data });
    socket
      .to(room)
      .emit("call:stream", {
        data,
        from: socket.data.userId || socket.userId,
        room,
      }); // alias
  });
  socket.on("call:stream", ({ room, ...rest }) => {
    if (!room) return;
    socket
      .to(room)
      .emit("call:stream", {
        ...rest,
        room,
        from: socket.data.userId || socket.userId,
      });
    if (rest?.data) socket.to(room).emit("call:frame", { data: rest.data }); // alias
  });

  // ---- AUDIO streaming & control (kompat)
  // server 1: audio:chunk/start/stop/mute/speaker/test
  // server 2: audio:data
  socket.on("audio:chunk", ({ room, data }) => {
    if (!room || !data) {
      console.log(
        `[audio] chunk rejected from ${
          socket.data.userId || socket.userId
        } (missing room/data)`
      );
      return;
    }
    const peers = peersIn(room).length;
    console.log(
      `[audio] chunk from ${
        socket.data.userId || socket.userId
      } in ${room} - peers: ${peers}`
    );
    const payload = {
      data,
      timestamp: Date.now(),
      fromUserId: socket.data.userId || socket.userId,
      room,
    };
    socket.to(room).emit("audio:chunk", payload);
    socket.to(room).emit("audio:data", payload); // alias utk klien lama
  });

  socket.on("audio:data", ({ room, data }) => {
    if (!room || !data) return;
    const payload = {
      data,
      timestamp: Date.now(),
      fromUserId: socket.data.userId || socket.userId,
      room,
    };
    socket.to(room).emit("audio:data", payload);
    socket.to(room).emit("audio:chunk", payload); // alias
  });

  socket.on("audio:start", ({ room }) => {
    if (!room) return;
    const peers = peersIn(room).length;
    console.log(
      `[audio] start from ${
        socket.data.userId || socket.userId
      } in ${room} - notifying ${peers - 1} peers`
    );
    socket
      .to(room)
      .emit("audio:started", {
        fromUserId: socket.data.userId || socket.userId,
        room,
      });
  });

  socket.on("audio:stop", ({ room }) => {
    if (!room) return;
    const peers = peersIn(room).length;
    console.log(
      `[audio] stop from ${
        socket.data.userId || socket.userId
      } in ${room} - notifying ${peers - 1} peers`
    );
    socket
      .to(room)
      .emit("audio:stopped", {
        fromUserId: socket.data.userId || socket.userId,
        room,
      });
  });

  socket.on("audio:mute", ({ room, muted }) => {
    if (!room) return;
    console.log(
      `[audio] ${muted ? "muted" : "unmuted"} from ${
        socket.data.userId || socket.userId
      } in ${room}`
    );
    socket
      .to(room)
      .emit("audio:mute", {
        fromUserId: socket.data.userId || socket.userId,
        muted,
        room,
      });
  });

  socket.on("audio:speaker", ({ room, speaker }) => {
    if (!room) return;
    console.log(
      `[audio] speaker ${speaker ? "on" : "off"} from ${
        socket.data.userId || socket.userId
      } in ${room}`
    );
    socket
      .to(room)
      .emit("audio:speaker", {
        fromUserId: socket.data.userId || socket.userId,
        speaker,
        room,
      });
  });

  socket.on("audio:test", ({ room }) => {
    if (!room) return;
    const total = peersIn(room).length;
    console.log(
      `[audio] test from ${
        socket.data.userId || socket.userId
      } in ${room} - ${total} total peers`
    );
    socket.emit("audio:test:response", {
      success: true,
      peersInRoom: total,
      room,
    });
  });

  // ---- MOBILE APP AUDIO CALL EVENTS
  socket.on("audio:invite", (data) => {
    if (!data.room) return;
    console.log([audio] invite from ${socket.data.userId || socket.userId} in ${data.room});
    socket.to(data.room).emit("call:ringing", {
      type: "audio",
      from: socket.data.userId || socket.userId,
      room: data.room
    });
  });

  socket.on("audio:accept", (data) => {
    if (!data.room) return;
    console.log([audio] accept from ${socket.data.userId || socket.userId} in ${data.room});
    socket.to(data.room).emit("audio:accepted", {
      from: socket.data.userId || socket.userId,
      room: data.room
    });
  });

  socket.on("audio:decline", (data) => {
    if (!data.room) return;
    console.log([audio] decline from ${socket.data.userId || socket.userId} in ${data.room});
    socket.to(data.room).emit("call:declined", {
      type: "audio",
      from: socket.data.userId || socket.userId,
      room: data.room
    });
  });

  socket.on("audio:hangup", (data) => {
    if (!data.room) return;
    console.log([audio] hangup from ${socket.data.userId || socket.userId} in ${data.room});
    socket.to(data.room).emit("call:ended", {
      type: "audio",
      from: socket.data.userId || socket.userId,
      room: data.room
    });
  });

  // ---- WebRTC signaling
  socket.on("webrtc:offer", ({ room, offer, audioOnly }) => {
    if (!room || !offer) {
      console.log(
        `[webrtc] offer rejected - missing data from ${
          socket.data.userId || socket.userId
        }`
      );
      return;
    }
    console.log(
      `[webrtc] offer from ${
        socket.data.userId || socket.userId
      } in ${room} (audio-only: ${!!audioOnly})`
    );
    socket
      .to(room)
      .emit("webrtc:offer", {
        offer,
        room,
        audioOnly,
        fromUserId: socket.data.userId || socket.userId,
      });
  });

  socket.on("webrtc:answer", ({ room, answer }) => {
    if (!room || !answer) {
      console.log(
        `[webrtc] answer rejected - missing data from ${
          socket.data.userId || socket.userId
        }`
      );
      return;
    }
    console.log(
      [webrtc] answer from ${socket.data.userId || socket.userId} in ${room}
    );
    socket
      .to(room)
      .emit("webrtc:answer", {
        answer,
        fromUserId: socket.data.userId || socket.userId,
      });
  });

  socket.on("webrtc:ice-candidate", ({ room, candidate }) => {
    if (!room || !candidate) {
      console.log(
        `[webrtc] ice-candidate rejected - missing data from ${
          socket.data.userId || socket.userId
        }`
      );
      return;
    }
    console.log(
      `[webrtc] ice-candidate from ${
        socket.data.userId || socket.userId
      } in ${room}`
    );
    socket
      .to(room)
      .emit("webrtc:ice-candidate", {
        candidate,
        fromUserId: socket.data.userId || socket.userId,
      });
  });

  socket.on("webrtc:end-call", ({ room }) => {
    if (!room) {
      console.log(
        `[webrtc] end-call rejected - no room from ${
          socket.data.userId || socket.userId
        }`
      );
      return;
    }
    console.log(
      [webrtc] end-call from ${socket.data.userId || socket.userId} in ${room}
    );
    socket
      .to(room)
      .emit("webrtc:end-call", {
        fromUserId: socket.data.userId || socket.userId,
      });
  });

  // Media toggles (kompat)
  socket.on("webrtc:audio-toggle", ({ room, enabled }) => {
    if (!room) return;
    console.log(
      `[webrtc] audio ${enabled ? "enabled" : "disabled"} from ${
        socket.data.userId || socket.userId
      }`
    );
    socket
      .to(room)
      .emit("webrtc:audio-toggle", {
        fromUserId: socket.data.userId || socket.userId,
        enabled,
      });
  });
  socket.on("webrtc:video-toggle", ({ room, enabled }) => {
    if (!room) return;
    console.log(
      `[webrtc] video ${enabled ? "enabled" : "disabled"} from ${
        socket.data.userId || socket.userId
      }`
    );
    socket
      .to(room)
      .emit("webrtc:video-toggle", {
        fromUserId: socket.data.userId || socket.userId,
        enabled,
      });
  });
  socket.on("webrtc:speaker-toggle", ({ room, enabled }) => {
    if (!room) return;
    console.log(
      `[webrtc] speaker ${enabled ? "enabled" : "disabled"} from ${
        socket.data.userId || socket.userId
      }`
    );
    socket
      .to(room)
      .emit("webrtc:speaker-toggle", {
        fromUserId: socket.data.userId || socket.userId,
        enabled,
      });
  });

  socket.on("webrtc:test", ({ room }) => {
    if (!room) return;
    const total = peersIn(room).length;
    console.log(
      `[webrtc] test from ${
        socket.data.userId || socket.userId
      } in ${room} - ${total} total peers`
    );
    socket.emit("webrtc:test:response", {
      success: true,
      peersInRoom: total,
      room,
      webrtcSupported: true,
    });
  });

  // ---- Ticket context
  socket.on("ticket:context", ({ room, ticketId, fromUserId }) => {
    if (!room || !ticketId) {
      console.log(
        `[ticket] context rejected - missing data from ${
          socket.data.userId || socket.userId
        }`
      );
      return;
    }
    console.log(
      `[ticket] context from ${
        fromUserId || socket.data.userId || socket.userId
      } in ${room} - ticket: ${ticketId}`
    );
    socket
      .to(room)
      .emit("ticket:context", {
        ticketId,
        fromUserId: fromUserId || socket.data.userId || socket.userId,
        room,
      });
  });

  // ---- Disconnect
  socket.on("disconnect", (reason) => {
    const uid = socket.data.userId || socket.userId;
    if (uid) removeUserSocket(uid, socket.id);
    console.log("disconnected:", socket.id, "reason:", reason);
  });
});

server.listen(PORT, () => {
  console.log(🚀 ${APP_NAME} listening on http://0.0.0.0:${PORT});
  console.log(📱 Live Chat: ✅ READY);
  console.log(📞 Audio Calls: ✅ READY);
  console.log(📹 Video Calls: ✅ READY);
  console.log(🔗 Socket.io path: /socket.io);
});