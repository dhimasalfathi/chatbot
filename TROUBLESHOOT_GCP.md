# 🚀 Troubleshooting Command untuk GCP SSH

## Error yang terjadi:
```bash
kavling76a@deploy-test:~/chatbot$ .[start-server.sh](http://_vscodecontentref_/0) production
-bash: syntax error near unexpected token `http://_vscodecontentref_/0'
```

## ✅ Perbaikan - Copy command ini:

### 1. Cek file yang ada
```bash
ls -la
```

### 2. Cek apakah start-server.sh ada dan executable
```bash
ls -la start-server.sh
```

### 3. Jika file ada, berikan permission
```bash
chmod +x start-server.sh
```

### 4. Jalankan dengan command yang benar
```bash
./start-server.sh production
```

### 5. Alternative: Jika start-server.sh bermasalah, jalankan manual
```bash
# Set environment untuk production
export NODE_ENV=production
export PORT=8080

# Install PM2 jika belum ada
sudo npm install -g pm2

# Start server dengan PM2
pm2 start server.js --name chatbot-server

# Save PM2 config
pm2 save
pm2 startup
```

### 6. Cek status server
```bash
pm2 status
```

### 7. Get external IP
```bash
curl -H "Metadata-Flavor: Google" http://metadata/computeMetadata/v1/instance/network-interfaces/0/external-ip
```

### 8. Test server
```bash
curl http://localhost:8080/healthz
```

## 🎯 Quick Fix - Copy paste ini satu per satu:

```bash
chmod +x start-server.sh
```

```bash
./start-server.sh production
```

Jika masih error, gunakan manual start:

```bash
export NODE_ENV=production
```

```bash
pm2 start server.js --name chatbot-server
```

```bash
pm2 status
```
