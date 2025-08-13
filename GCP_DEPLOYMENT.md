# Chatbot Server - GCP Deployment Guide

## 🚀 Menjalankan Server di GCP

### Prerequisites
1. **VM GCP** dengan Ubuntu/Debian
2. **Node.js** versi 18+ 
3. **Firewall rule** untuk port 8080

### Quick Start

1. **Upload file ke GCP VM:**
```bash
# Via gcloud CLI
gcloud compute scp --recurse ./chatbot/ your-vm-name:~/ --zone=your-zone

# Atau via SCP
scp -r ./chatbot/ username@your-external-ip:~/
```

2. **Install dependencies:**
```bash
cd ~/chatbot
npm install
```

3. **Jalankan server:**

**Development mode:**
```bash
chmod +x start-server.sh
./start-server.sh development
```

**Production mode (recommended):**
```bash
./start-server.sh production
```

### 🔧 Konfigurasi Firewall GCP

```bash
# Buat firewall rule untuk port 8080
gcloud compute firewall-rules create allow-chatbot-port \
    --allow tcp:8080 \
    --source-ranges 0.0.0.0/0 \
    --description "Allow chatbot server on port 8080"
```

### 📊 Management Commands

**Cek status server:**
```bash
pm2 status
pm2 logs chatbot-server
```

**Restart server:**
```bash
pm2 restart chatbot-server
```

**Stop server:**
```bash
pm2 stop chatbot-server
```

**Manual cleanup:**
```bash
pkill -f "node server.js"
```

### 🌐 Access URLs

Setelah server berjalan, akses melalui:

- **Web Interface:** `http://YOUR_EXTERNAL_IP:8080/chatbot`
- **API Endpoint:** `http://YOUR_EXTERNAL_IP:8080/chat`
- **Health Check:** `http://YOUR_EXTERNAL_IP:8080/healthz`

### 🐛 Troubleshooting

**Server berhenti ketika SSH terputus:**
- Gunakan `./start-server.sh production` yang menggunakan PM2
- Atau gunakan `nohup node server.js > server.log 2>&1 &`

**Port 8080 tidak bisa diakses:**
- Pastikan firewall GCP sudah dikonfigurasi
- Cek apakah server binding ke `0.0.0.0:8080`

**LM Studio error:**
- Server akan menggunakan fallback response jika LM Studio tidak tersedia
- Tidak perlu install LM Studio di GCP untuk testing basic functionality

### 📝 Environment Variables

```bash
export PORT=8080                           # GCP default port
export LM_BASE_URL="http://localhost:1234/v1"  # LM Studio (optional)
export NODE_ENV="production"               # Production mode
```

### 🔍 Monitoring

**View logs:**
```bash
# PM2 logs
pm2 logs chatbot-server --lines 100

# Manual logs  
tail -f server.log
```

**Resource usage:**
```bash
pm2 monit
```
