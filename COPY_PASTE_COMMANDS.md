# 📋 Quick Copy-Paste Commands untuk GCP VM

## 1. Setup Environment
```bash
curl -fsSL https://raw.githubusercontent.com/nodesource/distributions/main/deb/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g pm2
mkdir -p ~/chatbot && cd ~/chatbot
```

## 2. Create package.json
```bash
cat > package.json << 'EOF'
{
  "name": "chatbot-server",
  "version": "1.0.0",
  "description": "Banking chatbot with LM Studio integration",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "production": "pm2 start ecosystem.config.json"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "crypto": "^1.0.1"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  },
  "keywords": ["chatbot", "banking", "ai", "lm-studio"],
  "author": "Your Name",
  "license": "MIT"
}
EOF
```

## 3. Install Dependencies
```bash
npm install
```

## 4. Check External IP
```bash
curl -H "Metadata-Flavor: Google" http://metadata/computeMetadata/v1/instance/network-interfaces/0/external-ip
```

## 5. Quick Server Test
```bash
# Start simple test server
cat > test-server.js << 'EOF'
const express = require('express');
const app = express();
const PORT = 8080;

app.get('/', (req, res) => {
  res.json({ 
    message: 'Chatbot server is running!',
    timestamp: new Date(),
    env: process.env.NODE_ENV || 'development'
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Test server running on http://0.0.0.0:${PORT}`);
});
EOF

node test-server.js
```

## 6. Create Main Files (Copy-paste each)

### server.js
```bash
nano server.js
# Then copy-paste the entire server.js content from VS Code
```

### start-server.sh
```bash
nano start-server.sh
# Copy-paste start-server.sh content
chmod +x start-server.sh
```

### ecosystem.config.json
```bash
nano ecosystem.config.json
# Copy-paste ecosystem.config.json content
```

## 7. Quick Start Commands
```bash
# Development mode
node server.js

# Production mode with PM2
pm2 start server.js --name chatbot-server
pm2 save
pm2 startup

# Check status
pm2 status
pm2 logs chatbot-server
```

## 8. Firewall Setup (GCP Web Console)
1. Go to VPC Network > Firewall
2. CREATE FIREWALL RULE
3. Name: `allow-chatbot-port`
4. Direction: Ingress, Action: Allow
5. Targets: All instances in the network
6. Source IP ranges: `0.0.0.0/0`
7. Protocols: TCP, Ports: `8080`
8. CREATE

## 9. Access URLs
Replace `YOUR_EXTERNAL_IP` with result from step 4:
- Web Interface: `http://YOUR_EXTERNAL_IP:8080/chatbot`
- API Health: `http://YOUR_EXTERNAL_IP:8080/healthz`
- Chat API: `http://YOUR_EXTERNAL_IP:8080/chat`
