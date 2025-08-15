# Deploy to Existing GCP Compute Engine

## 🚀 Quick Deployment to Existing VM

### 1. SSH ke VM Instance
```bash
# SSH ke VM yang sudah ada
gcloud compute ssh YOUR_VM_NAME --zone=YOUR_ZONE

# Atau jika sudah ada SSH key
ssh username@YOUR_VM_EXTERNAL_IP
```

### 2. Setup Environment (One Time Only)
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 globally
sudo npm install -g pm2

# Install Git (jika belum ada)
sudo apt install git -y

# Verify installations
node --version
npm --version
pm2 --version
```

### 3. Clone Repository (One Time Only)
```bash
# Clone repository
git clone https://github.com/dhimasalfathi/chatbot.git
cd chatbot

# Install dependencies
npm install
```

### 4. Configure Environment Variables
```bash
# Create .env file
cat > .env << 'EOF'
NODE_ENV=production
PORT=8080
LM_BASE_URL=https://6a7d04fe49a2.ngrok-free.app/v1
LM_MODEL=qwen2.5-7b-instruct-1m
LM_TEMPERATURE=0.8
EOF

# Verify environment file
cat .env
```

### 5. Configure Firewall (One Time Only)
```bash
# Allow port 8080 in VM firewall
sudo ufw allow 8080

# Check firewall status
sudo ufw status
```

### 6. Deploy/Update Application
```bash
# Pull latest changes
git pull origin main

# Install new dependencies (if any)
npm install

# Stop existing PM2 process (if running)
pm2 stop chatbot-server 2>/dev/null || true

# Start application with PM2
pm2 start ecosystem.config.json --env production

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
# Follow the instructions shown by PM2

# Check status
pm2 status
pm2 logs chatbot-server --lines 20
```

### 7. Test Deployment
```bash
# Test from within VM
curl http://localhost:8080/healthz

# Test chat endpoint
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"message": "Halo, test dari VM"}' \
  http://localhost:8080/chat

# Get VM external IP
curl -H "Metadata-Flavor: Google" http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip
```

## 🔧 GCP Firewall Setup (One Time Only)

### Allow HTTP Traffic to VM
```bash
# From your local machine (with gcloud CLI)
# Get VM name and zone first
gcloud compute instances list

# Create firewall rule for chatbot
gcloud compute firewall-rules create allow-chatbot-8080 \
    --allow tcp:8080 \
    --source-ranges 0.0.0.0/0 \
    --description "Allow chatbot on port 8080"

# Or update existing VM to allow HTTP
gcloud compute instances add-tags YOUR_VM_NAME \
    --tags=http-server,chatbot-server \
    --zone=YOUR_ZONE
```

## 📋 Quick Update Script

Create this script in your VM for easy updates:

```bash
# Create update script
cat > update-chatbot.sh << 'EOF'
#!/bin/bash
echo "🔄 Updating chatbot..."

# Navigate to project directory
cd ~/chatbot

# Pull latest changes
echo "📥 Pulling latest code..."
git pull origin main

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Restart PM2 service
echo "🔄 Restarting service..."
pm2 restart chatbot-server

# Show status
echo "📊 Service status:"
pm2 status chatbot-server
pm2 logs chatbot-server --lines 10

echo "✅ Update complete!"
EOF

# Make executable
chmod +x update-chatbot.sh

# Use with: ./update-chatbot.sh
```

## 🎯 External Access URLs

After deployment, your chatbot will be available at:
```
# Replace YOUR_VM_EXTERNAL_IP with actual IP
http://YOUR_VM_EXTERNAL_IP:8080/chatbot
http://YOUR_VM_EXTERNAL_IP:8080/chat
http://YOUR_VM_EXTERNAL_IP:8080/sla
```

## 🔍 Monitoring & Troubleshooting

```bash
# Check PM2 status
pm2 status

# View logs
pm2 logs chatbot-server --follow

# Restart if needed
pm2 restart chatbot-server

# Check port usage
sudo netstat -tlnp | grep :8080

# Check if ngrok is reachable from VM
curl -H "ngrok-skip-browser-warning: true" https://6a7d04fe49a2.ngrok-free.app/v1/models
```

## 🚨 Important Notes:

1. **ngrok must be running** on your local machine
2. **Firewall port 8080** must be open
3. **VM must have internet access** to reach ngrok
4. **Keep PM2 process running** for persistent service

This approach is simpler than Cloud Run and uses your existing VM infrastructure!
