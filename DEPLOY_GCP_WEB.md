# 🚀 Deploy Chatbot ke GCP VM via Web Console

## VM Details
- **VM Name:** deploy-test  
- **Zone:** us-central1-c

## 📋 Step-by-Step Deployment (Tanpa gcloud CLI)

### 1. 🌐 Akses VM via SSH Web Console

1. Buka [Google Cloud Console](https://console.cloud.google.com)
2. Go to **Compute Engine > VM instances**
3. Cari VM **deploy-test**
4. Klik tombol **SSH** di sebelah VM name
5. Tunggu SSH terminal terbuka di browser

### 2. 📁 Upload Files ke VM

**Opsi A: Git Clone (Recommended)**
```bash
# Install git jika belum ada
sudo apt update
sudo apt install -y git nodejs npm

# Clone repository (ganti dengan repo Anda)
git clone https://github.com/dhimasalfathi/chatbot.git
cd chatbot
```

**Opsi B: Manual Upload via Web SSH**
```bash
# Buat folder project
mkdir ~/chatbot
cd ~/chatbot

# Upload file satu per satu melalui SSH web console
# (Drag & drop atau copy-paste file contents)
```

**Opsi C: Download dari GitHub**
```bash
# Download sebagai ZIP
wget https://github.com/dhimasalfathi/chatbot/archive/main.zip
unzip main.zip
mv chatbot-main chatbot
cd chatbot
```

### 3. 🔧 Setup Environment

```bash
# Install Node.js jika belum ada
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version

# Install project dependencies
npm install

# Install PM2 globally untuk production
sudo npm install -g pm2
```

### 4. 🔥 Setup Firewall via Web Console

1. Go to **VPC Network > Firewall**
2. Click **CREATE FIREWALL RULE**
3. Fill in:
   - **Name:** `allow-chatbot-port`
   - **Direction:** Ingress
   - **Action:** Allow
   - **Targets:** All instances in the network
   - **Source IP ranges:** `0.0.0.0/0`
   - **Protocols and ports:** 
     - ☑️ TCP
     - **Ports:** `8080`
4. Click **CREATE**

### 5. 🚀 Start Server

```bash
# Give execute permission
chmod +x start-server.sh

# Start in production mode
./start-server.sh production
```

**Alternative manual start:**
```bash
# Set environment
export PORT=8080
export NODE_ENV=production

# Start with PM2
pm2 start server.js --name chatbot-server

# Or start with nohup (if PM2 fails)
nohup node server.js > server.log 2>&1 &
```

### 6. 🌐 Get External IP Address

**Via SSH Terminal:**
```bash
curl -H "Metadata-Flavor: Google" http://metadata/computeMetadata/v1/instance/network-interfaces/0/external-ip
```

**Via Web Console:**
1. Go to **Compute Engine > VM instances**
2. Find **deploy-test** VM
3. Copy the **External IP** from the list

### 7. ✅ Test Access

Open in browser:
- **Web Interface:** `http://YOUR_EXTERNAL_IP:8080/chatbot`
- **API Test:** `http://YOUR_EXTERNAL_IP:8080/healthz`

Replace `YOUR_EXTERNAL_IP` with actual external IP dari step 6.

## 📊 Management Commands

```bash
# Check server status
pm2 status

# View logs
pm2 logs chatbot-server

# Restart server
pm2 restart chatbot-server

# Stop server
pm2 stop chatbot-server

# Check if server running (alternative)
ps aux | grep node
netstat -tlnp | grep :8080
```

## 🐛 Troubleshooting

**Server tidak bisa diakses dari luar:**
```bash
# Check if server is running
pm2 status
curl http://localhost:8080/healthz

# Check firewall (in VM)
sudo ufw status

# Check if port is open
sudo netstat -tlnp | grep :8080
```

**Upload files manually via SSH Web Console:**
1. Buka file di VS Code/text editor
2. Copy semua content
3. Di SSH terminal: `nano filename.js`
4. Paste content
5. Save: `Ctrl+X`, `Y`, `Enter`

**Quick file upload script:**
```bash
# Create all necessary files
cat > server.js << 'EOF'
[PASTE_SERVER_JS_CONTENT_HERE]
EOF

cat > package.json << 'EOF'
[PASTE_PACKAGE_JSON_CONTENT_HERE]  
EOF

# Continue for other files...
```

## 📝 Quick Verification

```bash
# Test locally first
curl http://localhost:8080/healthz

# If working, test externally
curl http://YOUR_EXTERNAL_IP:8080/healthz
```

Expected response:
```json
{"status":"ok","model":"qwen2.5-7b-instruct-1m"}
```

## 🎯 Next Steps

1. Upload semua files ke VM deploy-test
2. Setup firewall rule via web console  
3. Start server dengan production mode
4. Test akses via external IP
5. Share URL untuk testing dari device lain

**Final URL untuk testing:**
`http://YOUR_EXTERNAL_IP:8080/chatbot`
