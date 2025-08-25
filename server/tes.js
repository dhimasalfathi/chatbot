const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

// Socket connection handler
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Authentication
  socket.on('auth:register', ({ userId }) => {
    socket.userId = userId;
    console.log(`User ${userId} registered with socket ${socket.id}`);
    socket.emit('auth:ok');
  });

  // Room management
  socket.on('join', ({ room, userId }) => {
    socket.join(room);
    socket.userId = userId;
    console.log(`${userId} joined room: ${room}`);
    io.to(room).emit('presence:list', {
      room,
      peers: Array.from(io.sockets.adapter.rooms.get(room) || []).map(id => ({
        sid: id,
        userId: io.sockets.sockets.get(id)?.userId
      }))
    });
  });

  socket.on('leave', ({ room, userId }) => {
    socket.leave(room);
    console.log(`${userId} left room: ${room}`);
  });

  // Presence
  socket.on('presence:get', ({ room }) => {
    const roomSockets = io.sockets.adapter.rooms.get(room);
    const peers = roomSockets ? Array.from(roomSockets).map(id => ({
      sid: id,
      userId: io.sockets.sockets.get(id)?.userId
    })) : [];
    
    socket.emit('presence:list', { room, peers });
  });

  // Chat messages
  socket.on('chat:send', (message) => {
    console.log('Chat message:', message);
    io.to(message.room).emit('chat:new', message);
  });

  // DM (Direct Message)
  socket.on('dm:open', ({ toUserId }) => {
    const room = `dm:${socket.userId}:${toUserId}`;
    socket.join(room);
    socket.emit('dm:pending', { room });
    
    // Find target user and notify
    for (const [id, s] of io.sockets.sockets) {
      if (s.userId === toUserId) {
        s.join(room);
        s.emit('dm:request', { room, fromUserId: socket.userId });
        break;
      }
    }
  });

  socket.on('dm:join', ({ room }) => {
    socket.join(room);
    io.to(room).emit('dm:ready', { room });
  });

  // AUDIO CALL EVENTS
  socket.on('audio:invite', (data) => {
    console.log('Audio call invite:', data);
    socket.to(data.room).emit('call:ringing', { 
      type: 'audio',
      from: socket.userId,
      room: data.room 
    });
  });

  socket.on('audio:accept', (data) => {
    console.log('Audio call accepted:', data);
    socket.to(data.room).emit('audio:accepted', { 
      from: socket.userId,
      room: data.room 
    });
  });

  socket.on('audio:decline', (data) => {
    console.log('Audio call declined:', data);
    socket.to(data.room).emit('call:declined', { 
      type: 'audio',
      from: socket.userId,
      room: data.room 
    });
  });

  socket.on('audio:hangup', (data) => {
    console.log('Audio call hangup:', data);
    socket.to(data.room).emit('call:ended', { 
      type: 'audio',
      from: socket.userId,
      room: data.room 
    });
  });

  socket.on('audio:data', (data) => {
    socket.to(data.room).emit('audio:data', {
      ...data,
      from: socket.userId
    });
  });

  // VIDEO CALL EVENTS
  socket.on('call:invite', (data) => {
    console.log('Video call invite:', data);
    socket.to(data.room).emit('call:ringing', { 
      type: 'video',
      from: socket.userId,
      room: data.room 
    });
  });

  socket.on('call:accept', (data) => {
    console.log('Video call accepted:', data);
    socket.to(data.room).emit('call:accepted', { 
      from: socket.userId,
      room: data.room 
    });
  });

  socket.on('call:decline', (data) => {
    console.log('Video call declined:', data);
    socket.to(data.room).emit('call:declined', { 
      type: 'video',
      from: socket.userId,
      room: data.room 
    });
  });

  socket.on('call:hangup', (data) => {
    console.log('Video call hangup:', data);
    socket.to(data.room).emit('call:ended', { 
      type: 'video',
      from: socket.userId,
      room: data.room 
    });
  });

  socket.on('call:stream', (data) => {
    socket.to(data.room).emit('call:stream', {
      ...data,
      from: socket.userId
    });
  });

  // TICKET CONTEXT EVENTS
  socket.on('ticket:context', (data) => {
    console.log('Ticket context shared:', data);
    socket.to(data.room).emit('ticket:context', {
      ...data,
      from: socket.userId
    });
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🚀 BNI B-Care Server running on port ${PORT}`);
  console.log(`📱 Audio/Video calls supported`);
  console.log(`🔗 Socket.io path: /socket.io`);
});