# Manual Deploy ke GCP Compute Engine via SSH

## 📋 Prerequisites
- GCP Compute Engine instance yang sudah running
- SSH access ke instance
- GitHub repository sudah di-push
- LM Studio running di laptop local (host: 0.0.0.0, port: 1234)

## 🚀 Step-by-Step Manual Deployment

### 1. SSH ke GCP Instance
```bash
# Via gcloud CLI
gcloud compute ssh your-instance-name --zone=your-zone

# Atau via SSH biasa
ssh username@your-external-ip
```

### 2. Install Dependencies di GCP Instance
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js dan npm
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 globally
sudo npm install -g pm2

# Install git (jika belum ada)
sudo apt install git -y
```

### 3. Clone Repository
```bash
# Clone repository
git clone https://github.com/dhimasalfathi/chatbot.git
cd chatbot

# Install dependencies
npm install
```

### 4. Setup Ngrok di Laptop (untuk akses LM Studio)
```bash
# Di laptop, install ngrok
# Download dari: https://ngrok.com/download

# Unzip dan jalankan
ngrok http 1234

# Copy URL yang muncul dari output ngrok
# Contoh output yang kamu dapat:
# Forwarding: https://6a7d04fe49a2.ngrok-free.app -> http://localhost:1234
```

### 5. Configure Environment di GCP
```bash
# Di GCP instance, set environment variables
export NODE_ENV=production
export LM_BASE_URL="https://6a7d04fe49a2.ngrok-free.app/v1"  # Ganti dengan ngrok URL kamu
export PORT=5000

# Optional: Save ke bashrc untuk persistent
echo 'export NODE_ENV=production' >> ~/.bashrc
echo 'export LM_BASE_URL="https://6a7d04fe49a2.ngrok-free.app/v1"' >> ~/.bashrc
echo 'export PORT=5000' >> ~/.bashrc
```

### 6. Test Connection
```bash
# PENTING: Bypass ngrok warning page dulu!
# Buka browser dan visit: https://6a7d04fe49a2.ngrok-free.app
# Klik "Visit Site" untuk bypass warning page
# Atau gunakan header khusus untuk bypass:

# Test LM Studio connection dengan bypass header
curl -X POST $LM_BASE_URL/chat/completions \
  -H "Content-Type: application/json" \
  -H "ngrok-skip-browser-warning: true" \
  -d '{"model":"your-model","messages":[{"role":"user","content":"Hello"}]}'

# Atau test endpoint models dulu:
curl -H "ngrok-skip-browser-warning: true" $LM_BASE_URL/models

# Kalau berhasil, akan ada response dari LM Studio
```

### 7. Start Application
```bash
# Start dengan PM2
pm2 start server.js --name chatbot

# Atau start biasa untuk testing
node server.js
```

### 8. Configure Firewall (GCP Console)
```bash
# Buka port 5000 di GCP Console:
# VPC Network > Firewall > Create Firewall Rule
# Name: allow-chatbot
# Direction: Ingress
# Targets: All instances in the network
# Source IP ranges: 0.0.0.0/0
# Protocols and ports: TCP 5000
```

## 🔄 Update Deployment

### Pull Latest Changes
```bash
# SSH ke GCP instance
cd chatbot

# Pull latest code
git pull origin main

# Install new dependencies (jika ada)
npm install

# Restart PM2
pm2 restart chatbot
```

## 📋 Useful Commands

### PM2 Management
```bash
# Status aplikasi
pm2 status

# Lihat logs
pm2 logs chatbot

# Restart
pm2 restart chatbot

# Stop
pm2 stop chatbot

# Auto-start PM2 on reboot
pm2 startup
pm2 save
```

### System Monitoring
```bash
# Check aplikasi running
curl http://localhost:5000/healthz

# Check dari luar (ganti dengan external IP GCP)
curl http://YOUR_GCP_EXTERNAL_IP:5000/healthz

# Monitor system resources
htop
```

## 🛠 Troubleshooting

### Jika ada "Visit Site" warning dari ngrok:
1. **Buka browser** dan visit URL ngrok (tanpa /v1): https://6a7d04fe49a2.ngrok-free.app
2. **Klik "Visit Site"** untuk bypass warning page
3. **Atau update server.js** untuk menambah header bypass:
   ```javascript
   // Tambahkan header ini di axios request
   headers: {
     'ngrok-skip-browser-warning': 'true'
   }
   ```

### Jika LM Studio tidak konek:
1. Pastikan ngrok masih running di laptop
2. Check LM Studio settings (host: 0.0.0.0, port: 1234)
3. Update LM_BASE_URL dengan ngrok URL yang baru
4. Pastikan sudah bypass ngrok warning page

### Jika port 5000 tidak accessible:
1. Check GCP firewall rules
2. Check aplikasi running: `pm2 status`
3. Check logs: `pm2 logs chatbot`

### Update ngrok URL:
```bash
# Di GCP instance
export LM_BASE_URL="https://6a7d04fe49a2.ngrok-free.app/v1"
pm2 restart chatbot
```

## 🌐 Access Application
- **Local testing**: http://localhost:5000
- **External access**: http://YOUR_GCP_EXTERNAL_IP:5000
- **Chatbot**: http://YOUR_GCP_EXTERNAL_IP:5000/public/chatbot.html

## 🔒 Security Notes
- Ngrok menyediakan HTTPS secara otomatis
- Untuk production, consider menggunakan domain dan SSL certificate
- Monitor ngrok connection, kadang perlu restart
- Jangan expose LM Studio port (1234) langsung ke internet
