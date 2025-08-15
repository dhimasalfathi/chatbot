# 🚀 Manual Deployment Commands for GCP VM

## Copy-paste these commands one by one into Cloud Console SSH terminal

### VM Info:
- **VM Name**: deploy-test  
- **Zone**: us-central1-c
- **External IP**: 34.121.13.94

### 1. Access VM via Cloud Console
1. Go to: https://console.cloud.google.com/compute/instances
2. Click "SSH" button next to `deploy-test` VM
3. Wait for terminal to load

### 2. Copy-paste these commands:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2
sudo npm install -g pm2

# Install Git
sudo apt install git -y

# Verify installations
echo "Node version: $(node --version)"
echo "NPM version: $(npm --version)"
echo "PM2 version: $(pm2 --version)"
```

### 3. Clone and setup project:

```bash
# Navigate to home
cd ~

# Clone repository
git clone https://github.com/dhimasalfathi/chatbot.git

# Enter project directory
cd chatbot

# Install dependencies
npm install

# Create environment file
cat > .env << 'EOF'
NODE_ENV=production
PORT=8080
LM_BASE_URL=https://6a7d04fe49a2.ngrok-free.app/v1
LM_MODEL=qwen2.5-7b-instruct-1m
LM_TEMPERATURE=0.8
EOF

# Verify environment
cat .env
```

### 4. Configure firewall:

```bash
# Allow port 8080
sudo ufw allow 8080

# Check firewall status
sudo ufw status
```

### 5. Start application:

```bash
# Start with PM2
pm2 start ecosystem.config.json --env production

# Save PM2 config
pm2 save

# Setup startup script
pm2 startup

# Check status
pm2 status
pm2 logs chatbot-server --lines 10
```

### 6. Test deployment:

```bash
# Test locally
curl http://localhost:8080/healthz

# Test chat
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello from VM!"}' \
  http://localhost:8080/chat

# Get external IP
curl -H "Metadata-Flavor: Google" http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip
```

## 🌐 Access URLs (after deployment):

- **Chatbot UI**: http://34.121.13.94:8080/chatbot.html
- **Chat API**: http://34.121.13.94:8080/chat  
- **Health Check**: http://34.121.13.94:8080/healthz
- **SLA Search**: http://34.121.13.94:8080/sla

## 🔧 Management Commands:

```bash
# Check status
pm2 status

# View logs
pm2 logs chatbot-server

# Restart app
pm2 restart chatbot-server

# Stop app
pm2 stop chatbot-server

# Update code (if needed)
cd ~/chatbot
git pull origin main
npm install
pm2 restart chatbot-server
```

## ⚠️ Important:
1. **Keep ngrok running** on your local machine
2. **Firewall port 8080** already configured by script
3. **Test both internal and external access**

This method avoids SSH connectivity issues and works reliably!
