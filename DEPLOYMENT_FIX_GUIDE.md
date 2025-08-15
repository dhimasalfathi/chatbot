# 🚀 GCP Chatbot Deployment - Quick Fix Guide

## 📋 Masalah yang Sudah Diperbaiki

### 1. ❌ Frontend Error: `POST http://localhost:5000/chat net::ERR_CONNECTION_REFUSED`

**Penyebab**: Frontend (chatbot.html) masih hardcode ke `localhost:5000`

**✅ Solusi**: 
- Mengubah `chatbot.html` untuk auto-detect URL berdasarkan environment
- Production: menggunakan `window.location.origin`
- Development: menggunakan `localhost:5000`

### 2. ❌ LM Studio URL Hardcode

**Penyebab**: `server.js` line 35 masih hardcode URL ngrok lama

**✅ Solusi**:
- Menggunakan fungsi `getLMStudioURL()` dari `lm-config.js`
- Mendukung multiple format di `ngrok-url.txt`

## 🛠️ Cara Deploy ke GCP

### Step 1: Update ngrok-url.txt
```bash
# Edit file ngrok-url.txt, isi dengan URL devtunnel/ngrok:
echo "https://5klclrqb-1234.asse.devtunnels.ms" > ngrok-url.txt
```

### Step 2: Deploy ke GCP
```bash
# Upload semua file yang sudah diupdate
git add .
git commit -m "Fix frontend URL detection and LM Studio config"
git push

# Atau manual upload via GCP Console
```

### Step 3: Restart Server di GCP
```bash
# SSH ke GCP VM, kemudian:
cd /path/to/chatbot
pm2 restart chatbot

# Atau jika belum ada PM2:
node server.js
```

### Step 4: Test Koneksi
```bash
# Di local (untuk test):
powershell -ExecutionPolicy Bypass -File test-connection.ps1

# Di GCP VM:
curl http://localhost:5000/healthz
curl http://localhost:5000/test-lm
```

## 🔧 Konfigurasi Environment

### Local Development
- Frontend: auto-detect → `http://localhost:5000`
- Backend: auto-detect → `http://[LOCAL_IP]:1234/v1`

### GCP Production  
- Frontend: auto-detect → `https://[GCP_IP]:8080` atau domain GCP
- Backend: baca dari `ngrok-url.txt` → `https://5klclrqb-1234.asse.devtunnels.ms/v1`

## 🎯 Test Points

1. **Frontend URL Detection**: 
   - Buka browser developer tools
   - Lihat console log: `"🌐 Production mode detected, using URL: ..."`

2. **Backend LM Studio Connection**:
   - Check server logs: `"🔧 Using URL from ngrok-url.txt: ..."`
   - Test endpoint: `GET /test-lm`

3. **End-to-End Chat**:
   - Buka `/chatbot`
   - Kirim pesan test
   - Pastikan tidak ada error `net::ERR_CONNECTION_REFUSED`

## 🚨 Troubleshooting

### Frontend masih error CONNECTION_REFUSED
```javascript
// Check di browser console:
console.log("Current URL:", window.location.origin);
console.log("Is Local:", window.location.hostname === 'localhost');
```

### Backend tidak connect ke LM Studio
```bash
# Test manual:
curl -H "ngrok-skip-browser-warning: true" "https://5klclrqb-1234.asse.devtunnels.ms/v1/models"
```

### Server tidak start
```bash
# Check port conflicts:
netstat -tulpn | grep :5000
netstat -tulpn | grep :8080

# Check logs:
pm2 logs chatbot
```
