const express = require('express');
const cors = require('cors');
const path = require('path');
const { PORT, NODE_ENV } = require('./src/config/config');
const { loadSLAData } = require('./src/services/sla-service');
const { setupRoutes } = require('./src/routes/routes');

// -----------------------------
// Initialize Express App
// -----------------------------
const app = express();

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

// -----------------------------
// Start Server
// -----------------------------
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Chatbot Server running on http://0.0.0.0:${PORT}`);
  console.log(`📋 API Tester: http://localhost:${PORT}/`);
  console.log(`💬 Chatbot Interface: http://localhost:${PORT}/chatbot`);
  console.log(`\n📊 Service Info:`);
  console.log(`   Environment: ${NODE_ENV}`);
  console.log(`   Features: REST API + AI Chatbot`);
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
  console.log(`   Current AI URL: ${LM_BASE_URL}`);
});
