# 🚀 Steps Setelah Git Pull di SSH GCP

## VM: deploy-test | Zone: us-central1-c

### 1. 📥 Git Pull (Yang akan Anda lakukan)
```bash
# Di SSH GCP terminal
cd ~/chatbot  # atau lokasi repo Anda
git pull origin main
```

### 2. 🔧 Setup Environment & Dependencies
```bash
# Install Node.js jika belum ada
curl -fsSL https://raw.githubusercontent.com/nodesource/distributions/main/deb/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 untuk production management
sudo npm install -g pm2

# Install project dependencies
npm install
```

### 3. 🔍 Verify Files
```bash
# Cek apakah semua file sudah ada
ls -la

# File yang harus ada:
# - server.js ✅
# - package.json ✅
# - start-server.sh ✅
# - ecosystem.config.json ✅
# - public/index.html ✅
# - public/chatbot.html ✅
# - README files ✅
```

### 4. 🔥 Setup Firewall (Di GCP Web Console)
1. Buka [GCP Console](https://console.cloud.google.com)
2. **VPC Network > Firewall > CREATE FIREWALL RULE**
3. Settings:
   - **Name:** `allow-chatbot-port`
   - **Direction:** Ingress
   - **Action:** Allow
   - **Targets:** All instances in the network
   - **Source IP ranges:** `0.0.0.0/0`
   - **Protocols and ports:** TCP - `8080`
4. **CREATE**

### 5. 🎯 Start Server
```bash
# Give execute permission to start script
chmod +x start-server.sh

# Start in production mode (recommended)
./start-server.sh production

# Alternative manual start with PM2
# pm2 start server.js --name chatbot-server
```

### 6. 🌐 Get External IP
```bash
# Method 1: Via metadata API
curl -H "Metadata-Flavor: Google" http://metadata/computeMetadata/v1/instance/network-interfaces/0/external-ip

# Method 2: Check di GCP Console
# Compute Engine > VM instances > deploy-test > External IP
```

### 7. ✅ Test Server
```bash
# Test local first
curl http://localhost:8080/healthz

# Expected response:
# {"status":"ok","model":"qwen2.5-7b-instruct-1m"}

# Test external (ganti YOUR_IP dengan IP dari step 6)
curl http://YOUR_EXTERNAL_IP:8080/healthz
```

### 8. 🎉 Access Chatbot
Buka di browser:
- **Web Interface:** `http://YOUR_EXTERNAL_IP:8080/chatbot`
- **API Health:** `http://YOUR_EXTERNAL_IP:8080/healthz`
- **Legacy Interface:** `http://YOUR_EXTERNAL_IP:8080/`

### 9. 📊 Management Commands
```bash
# Cek status server
pm2 status

# View logs
pm2 logs chatbot-server

# Restart server
pm2 restart chatbot-server

# Stop server
pm2 stop chatbot-server

# Monitor real-time
pm2 monit
```

### 10. 🐛 Troubleshooting Commands
```bash
# Jika server tidak bisa diakses dari luar:
# 1. Cek server running
ps aux | grep node
netstat -tlnp | grep :8080

# 2. Cek firewall VM internal
sudo ufw status

# 3. Test port connectivity
telnet YOUR_EXTERNAL_IP 8080

# 4. Manual server start (jika PM2 bermasalah)
nohup node server.js > server.log 2>&1 &

# 5. View server logs
tail -f server.log
```

---

## 🎯 Quick Command Summary

```bash
# After git pull:
npm install
chmod +x start-server.sh
./start-server.sh production

# Get IP:
curl -H "Metadata-Flavor: Google" http://metadata/computeMetadata/v1/instance/network-interfaces/0/external-ip

# Test:
curl http://localhost:8080/healthz
```

## 📱 Share URL
Setelah selesai, Anda bisa share:
`http://YOUR_EXTERNAL_IP:8080/chatbot`

---

**⚠️ Jangan lupa:**
1. ✅ Setup firewall rule di GCP Console (step 4)
2. ✅ Replace `YOUR_EXTERNAL_IP` dengan IP sebenarnya
3. ✅ Test dari browser/device lain untuk memastikan accessible
