# Deployment Guide

## 📋 Overview
Panduan lengkap untuk deploy Bank Customer Service Chatbot ke berbagai environment.

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Load Balancer │    │   Web Server    │    │   LM Studio     │
│   (Nginx/GCP)   │◄──►│   (Node.js)     │◄──►│   (AI Model)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Static Files  │    │   Session Store │    │   Monitoring    │
│   (HTML/CSS/JS) │    │   (Memory/Redis)│    │   (Logs/Metrics)│
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

---

## 🚀 Local Development

### Prerequisites
```bash
# Node.js 16+
node --version

# npm atau yarn
npm --version

# Git
git --version
```

### Setup
```bash
# 1. Clone repository
git clone <repository-url>
cd chatbot

# 2. Install dependencies
npm install

# 3. Setup environment
cp .env.example .env
# Edit .env file sesuai kebutuhan

# 4. Start development server
npm run dev

# 5. Start LM Studio (terpisah)
# Download dan jalankan LM Studio
# Load model yang diinginkan
# Pastikan API server aktif di localhost:1234
```

### Environment Variables (.env)
```bash
# Server Configuration
NODE_ENV=development
PORT=3000

# LM Studio Configuration
LM_STUDIO_URL=http://localhost:1234
LM_STUDIO_MODEL=llama-3.1-8b-instruct

# Session Configuration
SESSION_TIMEOUT=3600000
MAX_SESSIONS=1000

# Logging
LOG_LEVEL=debug
LOG_FILE=./logs/app.log

# CORS Settings
CORS_ORIGIN=http://localhost:3000
```

---

## 🌐 Production Deployment

### Option 1: Virtual Private Server (VPS)

#### System Requirements
- **CPU**: 4+ cores (8+ recommended untuk LM Studio)
- **RAM**: 16GB minimum (32GB+ untuk model besar)
- **Storage**: 50GB+ SSD
- **OS**: Ubuntu 20.04+ / CentOS 8+
- **Network**: 100Mbps+ bandwidth

#### Server Setup
```bash
# 1. Update system
sudo apt update && sudo apt upgrade -y

# 2. Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 3. Install PM2 (Process Manager)
sudo npm install -g pm2

# 4. Install Nginx (Reverse Proxy)
sudo apt install nginx -y

# 5. Install Git
sudo apt install git -y

# 6. Create application user
sudo useradd -m -s /bin/bash chatbot
sudo su - chatbot
```

#### Application Deployment
```bash
# 1. Clone repository
git clone <repository-url> /home/chatbot/app
cd /home/chatbot/app

# 2. Install dependencies
npm ci --only=production

# 3. Create production environment
cat > .env << EOF
NODE_ENV=production
PORT=3001
LM_STUDIO_URL=http://localhost:1234
LOG_LEVEL=info
EOF

# 4. Build application (jika ada build step)
npm run build

# 5. Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

#### PM2 Configuration (ecosystem.config.js)
```javascript
module.exports = {
  apps: [
    {
      name: 'chatbot-api',
      script: './server.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'development'
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      max_memory_restart: '1G',
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true
    }
  ]
};
```

#### Nginx Configuration
```nginx
# /etc/nginx/sites-available/chatbot
server {
    listen 80;
    server_name your-domain.com;

    # Static files
    location / {
        root /home/chatbot/app/public;
        try_files $uri $uri/ @app;
    }

    # API routes
    location @app {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket support
    location /socket.io/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/chatbot /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### SSL Certificate (Let's Encrypt)
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Generate certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

### Option 2: Docker Deployment

#### Dockerfile
```dockerfile
# Multi-stage build
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine AS runtime

# Create app user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S chatbot -u 1001

# Set working directory
WORKDIR /app

# Copy built application
COPY --from=builder --chown=chatbot:nodejs /app/node_modules ./node_modules
COPY --chown=chatbot:nodejs . .

# Switch to non-root user
USER chatbot

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/healthz || exit 1

# Start application
CMD ["npm", "start"]
```

#### Docker Compose
```yaml
# docker-compose.yml
version: '3.8'

services:
  chatbot:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - LM_STUDIO_URL=http://lm-studio:1234
    volumes:
      - ./logs:/app/logs
    depends_on:
      - lm-studio
    restart: unless-stopped
    networks:
      - chatbot-network

  lm-studio:
    image: lm-studio/server:latest  # Jika tersedia
    ports:
      - "1234:1234"
    volumes:
      - ./models:/app/models
    environment:
      - MODEL_NAME=llama-3.1-8b-instruct
    restart: unless-stopped
    networks:
      - chatbot-network

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - chatbot
    restart: unless-stopped
    networks:
      - chatbot-network

networks:
  chatbot-network:
    driver: bridge
```

#### Deploy dengan Docker
```bash
# Build dan start
docker-compose up -d

# View logs
docker-compose logs -f chatbot

# Scale application
docker-compose up -d --scale chatbot=3

# Update application
docker-compose pull
docker-compose up -d
```

### Option 3: Google Cloud Platform (GCP)

#### Cloud Run Deployment
```bash
# 1. Setup gcloud CLI
gcloud auth login
gcloud config set project YOUR_PROJECT_ID

# 2. Build container
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/chatbot

# 3. Deploy to Cloud Run
gcloud run deploy chatbot \
  --image gcr.io/YOUR_PROJECT_ID/chatbot \
  --platform managed \
  --region asia-southeast1 \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1 \
  --max-instances 10 \
  --port 3000 \
  --set-env-vars NODE_ENV=production,LM_STUDIO_URL=YOUR_LM_STUDIO_URL
```

#### App Engine Deployment
```yaml
# app.yaml
runtime: nodejs18

env_variables:
  NODE_ENV: production
  LM_STUDIO_URL: YOUR_LM_STUDIO_URL

automatic_scaling:
  min_instances: 1
  max_instances: 10
  target_cpu_utilization: 0.6

resources:
  cpu: 1
  memory_gb: 1
  disk_size_gb: 10
```

```bash
# Deploy
gcloud app deploy
```

---

## 🔧 LM Studio Setup

### Local Installation
```bash
# 1. Download LM Studio dari website resmi
# https://lmstudio.ai/

# 2. Install dan jalankan aplikasi

# 3. Download model yang diinginkan:
# - llama-3.1-8b-instruct (Recommended)
# - mistral-7b-instruct
# - codellama-7b-instruct

# 4. Start Local Server
# - Buka tab "Local Server"
# - Load model
# - Start server di port 1234
```

### Server/Production Setup
```bash
# Option 1: LM Studio CLI (jika tersedia)
lm-studio-cli start \
  --model llama-3.1-8b-instruct \
  --port 1234 \
  --host 0.0.0.0

# Option 2: Ollama (Alternative)
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Pull model
ollama pull llama3.1:8b

# Start server
ollama serve

# Update LM_STUDIO_URL ke http://localhost:11434/v1
```

---

## 📊 Monitoring & Logging

### Application Monitoring
```bash
# PM2 Monitoring
pm2 monit

# PM2 Logs
pm2 logs chatbot-api

# System resources
htop
iostat
free -h
df -h
```

### Log Configuration
```javascript
// logger.js
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

module.exports = logger;
```

### Health Check Monitoring
```bash
# Simple health check script
#!/bin/bash
# health-check.sh

URL="http://localhost:3000/healthz"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" $URL)

if [ $RESPONSE = "200" ]; then
    echo "✅ Service is healthy"
    exit 0
else
    echo "❌ Service is unhealthy (HTTP $RESPONSE)"
    # Restart service jika diperlukan
    pm2 restart chatbot-api
    exit 1
fi
```

### Monitoring dengan Grafana + Prometheus
```yaml
# docker-compose.monitoring.yml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml

  grafana:
    image: grafana/grafana
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana-data:/var/lib/grafana

volumes:
  grafana-data:
```

---

## 🔒 Security

### Firewall Configuration
```bash
# UFW (Ubuntu)
sudo ufw enable
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw deny 3000/tcp  # Block direct access to app
sudo ufw deny 1234/tcp  # Block direct access to LM Studio
```

### SSL/TLS Configuration
```nginx
# Strong SSL configuration
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
ssl_prefer_server_ciphers off;
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 1d;

# Security headers
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "no-referrer-when-downgrade" always;
add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
```

---

## 🔄 CI/CD Pipeline

### GitHub Actions
```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy to server
        uses: appleboy/ssh-action@v0.1.5
        with:
          host: ${{ secrets.HOST }}
          username: ${{ secrets.USERNAME }}
          key: ${{ secrets.SSH_KEY }}
          script: |
            cd /home/chatbot/app
            git pull origin main
            npm ci --only=production
            pm2 reload ecosystem.config.js
```

---

## 🚨 Troubleshooting

### Common Issues

#### 1. LM Studio Connection Error
```bash
# Check if LM Studio is running
curl http://localhost:1234/v1/models

# Restart LM Studio service
# Periksa firewall settings
# Pastikan model sudah di-load
```

#### 2. High Memory Usage
```bash
# Check memory usage
free -h
ps aux --sort=-%mem | head

# Restart PM2 apps with memory limit
pm2 restart all --max-memory-restart 1G
```

#### 3. Session Storage Issues
```bash
# Clear all sessions
curl -X DELETE http://localhost:3000/sessions

# Monitor session count
curl http://localhost:3000/healthz | jq '.active_sessions'
```

#### 4. Nginx 502 Bad Gateway
```bash
# Check upstream service
curl http://localhost:3001/healthz

# Check Nginx config
sudo nginx -t

# Check logs
sudo tail -f /var/log/nginx/error.log
```

### Performance Optimization

#### Node.js Optimization
```javascript
// Enable gzip compression
app.use(compression());

// Set appropriate cache headers
app.use('/static', express.static('public', {
  maxAge: '1d',
  etag: false
}));

// Enable keep-alive
app.use((req, res, next) => {
  res.setHeader('Connection', 'keep-alive');
  next();
});
```

#### Database/Session Optimization
```javascript
// Use Redis for session storage (production)
const session = require('express-session');
const RedisStore = require('connect-redis')(session);

app.use(session({
  store: new RedisStore({ host: 'localhost', port: 6379 }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 3600000 }
}));
```

---

## 📝 Maintenance

### Regular Tasks

#### Daily
- Monitor application logs
- Check system resources
- Verify health endpoints

#### Weekly  
- Update dependencies
- Review error logs
- Monitor disk usage
- Backup configurations

#### Monthly
- Security updates
- Performance review
- Log rotation
- Dependency audit

### Backup Strategy
```bash
#!/bin/bash
# backup.sh

# Backup application code
tar -czf /backup/chatbot-$(date +%Y%m%d).tar.gz /home/chatbot/app

# Backup logs
tar -czf /backup/logs-$(date +%Y%m%d).tar.gz /home/chatbot/app/logs

# Backup configurations
cp /etc/nginx/sites-available/chatbot /backup/nginx-$(date +%Y%m%d).conf

# Cleanup old backups (keep 30 days)
find /backup -name "*.tar.gz" -mtime +30 -delete
```

---

## 📞 Support & Maintenance

### Monitoring Alerts
Setup alerts untuk:
- Application downtime
- High error rates  
- Memory/CPU usage
- Disk space
- SSL certificate expiry

### Contact Information
- **Development Team**: dev-team@company.com
- **Operations Team**: ops-team@company.com
- **Emergency Hotline**: +62-xxx-xxxx-xxxx

---

**Last Updated**: August 2025  
**Version**: 1.0.0
