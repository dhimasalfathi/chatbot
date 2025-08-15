#!/bin/bash
# Test script untuk memastikan semua koneksi berjalan dengan baik

echo "🔍 Testing Chatbot Configuration..."
echo "================================="

# 1. Test LM Studio URL detection
echo "1. Testing LM Studio URL Detection:"
node -e "const { getLMStudioURL } = require('./lm-config'); console.log('   LM Studio URL:', getLMStudioURL());"
echo ""

# 2. Test LM Studio connectivity
echo "2. Testing LM Studio Connectivity:"
echo "   Checking if LM Studio is accessible..."
LM_URL=$(node -e "const { getLMStudioURL } = require('./lm-config'); console.log(getLMStudioURL());")
curl -s -H "ngrok-skip-browser-warning: true" "${LM_URL}/models" | head -n 5
echo ""

# 3. Test chatbot server health
echo "3. Testing Chatbot Server:"
if pgrep -f "node server.js" > /dev/null; then
    echo "   ✅ Server is running"
    echo "   Testing health endpoint..."
    curl -s http://localhost:5000/healthz | jq . 2>/dev/null || echo "   ⚠️ Health check failed or jq not installed"
else
    echo "   ❌ Server is not running"
    echo "   Start with: node server.js"
fi
echo ""

# 4. Show current configuration
echo "4. Current Configuration:"
echo "   NODE_ENV: ${NODE_ENV:-development}"
echo "   PORT: ${PORT:-5000}"
echo "   LM_BASE_URL: ${LM_BASE_URL:-auto-detected}"
echo ""

echo "🎯 Next Steps:"
echo "   1. If LM Studio connection fails: Check ngrok/devtunnel is running"
echo "   2. If server health fails: Start with 'node server.js'"
echo "   3. Test frontend: Open http://localhost:5000/chatbot"
echo "   4. For GCP: Make sure firewall allows port 5000/8080"
