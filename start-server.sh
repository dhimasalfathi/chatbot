#!/bin/bash

# Script untuk menjalankan chatbot server di GCP
# Penggunaan: ./start-server.sh [production|development]

MODE=${1:-development}

echo "🚀 Starting Chatbot Server in $MODE mode..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js first."
    exit 1
fi

# Check if npm packages are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing npm packages..."
    npm install
fi

# Set environment variables for GCP
export PORT=8080  # GCP Cloud Run default port
export LM_BASE_URL="http://localhost:1234/v1"  # Fallback will be used
export NODE_ENV=$MODE

# Kill any existing server process
echo "🔄 Checking for existing server processes..."
pkill -f "node server.js" 2>/dev/null || true

if [ "$MODE" = "production" ]; then
    echo "🎯 Starting server in production mode with PM2..."
    
    # Install PM2 if not available
    if ! command -v pm2 &> /dev/null; then
        echo "📦 Installing PM2..."
        npm install -g pm2
    fi
    
    # Start with PM2
    pm2 start server.js --name "chatbot-server" --watch --ignore-watch="node_modules" || {
        echo "❌ Failed to start with PM2, falling back to nohup..."
        nohup node server.js > server.log 2>&1 &
        echo $! > server.pid
        echo "✅ Server started with PID: $(cat server.pid)"
    }
    
    echo "✅ Production server started!"
    echo "📊 Use 'pm2 status' to check server status"
    echo "📋 Use 'pm2 logs chatbot-server' to view logs"
    
else
    echo "🔧 Starting server in development mode..."
    node server.js
fi

echo "🌐 Server should be accessible at:"
echo "   - Local: http://localhost:8080"
echo "   - GCP External IP: http://YOUR_EXTERNAL_IP:8080"
echo ""
echo "📁 Available endpoints:"
echo "   - Chat API: POST /chat"
echo "   - Health Check: GET /healthz"
echo "   - Legacy API: POST /extract"
echo "   - Web Interface: GET /chatbot"
