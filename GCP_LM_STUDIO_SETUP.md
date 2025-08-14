# GCP Deployment Guide - Chatbot dengan LM Studio

## 📋 Overview

Sistem chatbot ini dirancang untuk berjalan di GCP Compute Engine sambil tetap menggunakan LM Studio yang berjalan di laptop lokal. Ada beberapa cara untuk menghubungkan GCP dengan laptop:

## 🏗️ Architecture

```
[GCP Compute Engine] → [Internet/Tunnel] → [Laptop dengan LM Studio]
        ↑                                           ↑
   Chatbot Server                             AI Model Server
```

## 🚀 Deployment Options

### Option 1: Ngrok Tunnel (Recommended) ⭐

**Keuntungan:**
- Setup paling mudah
- HTTPS otomatis
- Tidak perlu konfigurasi router
- Gratis untuk basic usage

**Setup Steps:**

1. **Di Laptop (Local):**
   ```bash
   # Install ngrok
   npm install -g ngrok
   # atau download dari https://ngrok.com/
   
   # Setup LM Studio
   # - Host: 0.0.0.0 
   # - Port: 1234
   # - Enable "Allow external requests"
   
   # Run ngrok tunnel
   ngrok http 1234
   ```

2. **Copy ngrok URL:**
   ```
   ngrok by @inconshreveable
   
   Session Status    online
   Forwarding        https://abc123.ngrok.io -> http://localhost:1234
   ```

3. **Di GCP Server:**
   ```bash
   # Set environment variable
   export LM_BASE_URL="https://abc123.ngrok.io/v1"
   
   # atau buat file
   echo "https://abc123.ngrok.io" > ngrok-url.txt
   
   # Restart server
   pm2 restart chatbot
   ```

### Option 2: Public IP + Port Forwarding

**Keuntungan:**
- Tidak perlu third-party service
- Full control

**Kekurangan:**
- Perlu konfigurasi router
- Setup firewall
- Security concerns

**Setup Steps:**

1. **Router Configuration:**
   - Port forward 1234 ke laptop IP
   - Cari public IP: `curl ifconfig.me`

2. **Firewall:**
   ```bash
   # Windows Firewall
   netsh advfirewall firewall add rule name="LM Studio" dir=in action=allow protocol=TCP localport=1234
   ```

3. **GCP Environment:**
   ```bash
   export LM_BASE_URL="http://YOUR_PUBLIC_IP:1234/v1"
   ```

### Option 3: VPN/Tailscale (Most Secure)

**Setup Tailscale:**

1. **Install di laptop dan GCP:**
   ```bash
   # Install Tailscale
   curl -fsSL https://tailscale.com/install.sh | sh
   
   # Login
   tailscale up
   ```

2. **Use Tailscale IP:**
   ```bash
   # Cek Tailscale IP laptop
   tailscale ip -4
   
   # Set di GCP
   export LM_BASE_URL="http://TAILSCALE_IP:1234/v1"
   ```

## 🔧 Environment Variables

Sistem akan automatically detect environment:

### Local Development:
```bash
NODE_ENV=development  # (default)
# Auto-detect local IP: 192.168.x.x:1234
```

### GCP Production:
```bash
NODE_ENV=production
LM_BASE_URL="https://xxxxx.ngrok.io/v1"  # Required!
```

## 📝 Configuration Files

### 1. Environment Variables (.env)
```env
NODE_ENV=production
LM_BASE_URL=https://your-ngrok-url.ngrok.io/v1
LM_API_KEY=lm-studio
LM_MODEL=qwen2.5-7b-instruct-1m
LM_TEMPERATURE=0.8
PORT=8080
```

### 2. Ngrok URL File (ngrok-url.txt)
```
https://abc123.ngrok.io
```

### 3. PM2 Ecosystem (ecosystem.config.json)
```json
{
  "apps": [{
    "name": "chatbot",
    "script": "server.js",
    "env": {
      "NODE_ENV": "production",
      "PORT": "8080"
    },
    "env_production": {
      "NODE_ENV": "production",
      "LM_BASE_URL": "https://your-ngrok-url.ngrok.io/v1"
    }
  }]
}
```

## 🧪 Testing

### 1. Test Environment Detection:
```bash
node test-environment.js
```

### 2. Test LM Studio Connection:
```bash
curl -X POST $LM_BASE_URL/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"your-model","messages":[{"role":"user","content":"Hello"}]}'
```

### 3. Test Chatbot:
```bash
curl http://localhost:8080/healthz
```

## 🔒 Security Considerations

1. **Ngrok**: Secure tunnel dengan HTTPS
2. **Public IP**: Require firewall rules dan HTTPS proxy
3. **VPN**: Most secure, private network

## 🚨 Troubleshooting

### LM Studio Connection Failed:
```bash
# Check LM Studio settings:
# - Host: 0.0.0.0 (not localhost!)
# - Port: 1234
# - External requests: ENABLED

# Check tunnel:
curl $LM_BASE_URL/v1/models
```

### Environment Detection Issues:
```bash
# Check environment:
echo $NODE_ENV
echo $LM_BASE_URL

# Manual override:
export LM_BASE_URL="your-correct-url"
```

### Ngrok Connection Issues:
```bash
# Restart ngrok:
pkill ngrok
ngrok http 1234

# Update URL:
export LM_BASE_URL="new-ngrok-url/v1"
pm2 restart chatbot
```

## 📊 Monitoring

### PM2 Commands:
```bash
pm2 start ecosystem.config.json --env production
pm2 logs chatbot
pm2 restart chatbot
pm2 stop chatbot
```

### Health Check:
```bash
curl http://localhost:8080/healthz
```

## 🎯 Quick Setup (Ngrok)

```bash
# 1. Di laptop
ngrok http 1234

# 2. Copy URL, set di GCP
export LM_BASE_URL="https://xxxxx.ngrok.io/v1"

# 3. Restart
pm2 restart chatbot

# 4. Test
curl http://your-gcp-ip:8080/chatbot
```
