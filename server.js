const express = require('express');
const cors = require('cors');
const path = require('path');
const { PORT, NODE_ENV } = require('./src/config/config');
const { getLocalIP } = require('./src/utils/network-config');
const { loadSLAData } = require('./src/services/sla-service');
const { setupRoutes } = require('./src/routes/routes');

// -----------------------------
// Initialize Express App
// -----------------------------
const app = express();
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
// Start Server
// -----------------------------
app.listen(PORT, '0.0.0.0', () => {
  const LOCAL_IP = getLocalIP();
  
  console.log(`🚀 Chat-to-Form server running on http://0.0.0.0:${PORT}`);
  console.log(`📋 Legacy API Tester: http://localhost:${PORT}/`);
  console.log(`💬 New Chatbot Interface: http://localhost:${PORT}/chatbot`);
  console.log(`\n🌐 Network Access:`);
  console.log(`   Server binding to all interfaces (0.0.0.0:${PORT})`);
  console.log(`   Local IP detected: ${LOCAL_IP}`);
  console.log(`   Environment: ${NODE_ENV}`);
  
  if (NODE_ENV === 'production') {
    console.log(`🔴 Production mode - server will run in background`);
    console.log(`📊 Use PM2 commands for management`);
  } else {
    console.log(`🟡 Development mode - server will stop when SSH disconnects`);
    console.log(`💡 Use './start-server.sh production' for persistent running`);
  }
  
  const { LM_BASE_URL, LM_MODEL, LM_TEMPERATURE } = require('./src/config/config');
  console.log(`\n🔧 Configuration:`);
  console.log(`🤖 LM Studio: ${LM_BASE_URL}`);
  console.log(`🌡️ Temperature: ${LM_TEMPERATURE}`);
  console.log(`   Current LM URL: ${LM_BASE_URL}`);
  console.log(`   To change LM URL: export LM_BASE_URL="https://your-ngrok-url.ngrok.io/v1"`);
  
  console.log(`\n🔥 Firewall Setup (Run as Administrator):`);
  console.log(`   netsh advfirewall firewall add rule name="LM Studio" dir=in action=allow protocol=TCP localport=1234`);
  console.log(`   netsh advfirewall firewall add rule name="Chatbot" dir=in action=allow protocol=TCP localport=${PORT}`);
});
