# 🚀 Chatbot Simple Setup - No Complex Config

## ✅ Simplified Configuration

Kode sudah disederhanakan tanpa `lm-config.js`. Sekarang hanya menggunakan environment variable sederhana.

## 🛠️ Cara Deploy ke GCP

### Step 1: SSH ke GCP VM
```bash
ssh your-gcp-vm
cd /path/to/chatbot
```

### Step 2: Set LM Studio URL
```bash
# Set environment variable untuk session ini
export LM_BASE_URL="https://5klclrqb-1234.asse.devtunnels.ms/v1"

# Atau untuk permanent (tambahkan ke ~/.bashrc)
echo 'export LM_BASE_URL="https://5klclrqb-1234.asse.devtunnels.ms/v1"' >> ~/.bashrc
source ~/.bashrc
```

### Step 3: Start Server
```bash
# Langsung jalankan
node server.js

# Atau dengan PM2 untuk production
pm2 start server.js --name chatbot
pm2 save
```

### Step 4: Test
```bash
# Test health
curl http://localhost:5000/healthz

# Test LM connectivity  
curl http://localhost:5000/test-lm
```

## 🎯 Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LM_BASE_URL` | `http://localhost:1234/v1` | URL ke LM Studio/ngrok |
| `LM_API_KEY` | `lm-studio` | API key (biasanya tidak perlu diubah) |
| `LM_MODEL` | `qwen2.5-7b-instruct-1m` | Nama model yang digunakan |
| `PORT` | `5000` (dev) / `8080` (prod) | Port server |
| `NODE_ENV` | `development` | Environment mode |

## 💡 Quick Commands

### Local Development:
```bash
# Set LM URL dan langsung run
LM_BASE_URL="https://your-ngrok.ngrok.io/v1" node server.js
```

### GCP Production:
```bash
# Set env dan run dengan PM2
export LM_BASE_URL="https://your-ngrok.ngrok.io/v1"
export NODE_ENV="production"
pm2 start server.js --name chatbot
```

### Windows PowerShell:
```powershell
# Set environment variable
$env:LM_BASE_URL = "https://your-ngrok.ngrok.io/v1"

# Run server
node server.js
```

## 🔧 Troubleshooting

### 1. Server tidak connect ke LM Studio
```bash
# Test manual connection
curl -H "ngrok-skip-browser-warning: true" "https://your-ngrok.ngrok.io/v1/models"
```

### 2. Frontend masih error
- Pastikan server sudah restart setelah set environment variable
- Check browser console untuk error

### 3. PM2 tidak start
```bash
# Restart PM2
pm2 restart chatbot

# Check logs
pm2 logs chatbot
```

## 🎉 Simple & Clean!

Sekarang tidak ada file config yang kompleks. Cukup:
1. Set `LM_BASE_URL` 
2. Run `node server.js`
3. Done! ✨
