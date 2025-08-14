# GCP Deployment Commands

## 1. Pull Latest Code
```bash
git pull origin main
```

## 2. Set Environment Variables
```bash
# Set LM Studio URL (CRITICAL!)
export LM_BASE_URL="https://6a7d04fe49a2.ngrok-free.app/v1"
export LM_MODEL="qwen2.5-7b-instruct-1m"
export LM_TEMPERATURE="0.8"
export NODE_ENV="production"
export PORT="8080"

# Verify settings
echo "LM_BASE_URL: $LM_BASE_URL"
echo "NODE_ENV: $NODE_ENV"
echo "PORT: $PORT"
```

## 3. Install Dependencies (if needed)
```bash
npm install
```

## 4. PM2 Restart
```bash
# Stop existing process
pm2 stop chatbot

# Start with environment variables
pm2 start ecosystem.config.json

# Or direct start:
pm2 start server.js --name "chatbot" --env production

# Check status
pm2 status
pm2 logs chatbot --lines 20
```

## 5. Test Deployment
```bash
# Test health
curl http://localhost:8080/healthz

# Test chat
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"message": "Halo, saya ada masalah ATM"}' \
  http://localhost:8080/chat

# Test from external (replace YOUR_GCP_IP)
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"message": "Test from external"}' \
  http://YOUR_GCP_IP:8080/chat
```

## 6. Monitoring
```bash
# Real-time logs
pm2 logs chatbot --follow

# Process info
pm2 info chatbot

# Restart if needed
pm2 restart chatbot
```

## ⚠️ Critical Notes:

1. **LM_BASE_URL** MUST be set to ngrok URL
2. **PORT** should be 8080 for production
3. **Firewall** must allow port 8080
4. **ngrok tunnel** must be active on your local machine

## 🔧 Troubleshooting:

If LM Studio not connecting:
- Check if ngrok is still active: `curl https://6a7d04fe49a2.ngrok-free.app/v1/models`
- Verify environment variables: `env | grep LM_`
- Check PM2 logs: `pm2 logs chatbot`
- Test local connectivity first
