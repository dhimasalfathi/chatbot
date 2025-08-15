#!/bin/bash
# Simple start script untuk GCP deployment

echo "🚀 Starting Chatbot Server..."

# Set LM Studio URL jika belum ada
if [ -z "$LM_BASE_URL" ]; then
    echo "⚠️  LM_BASE_URL not set. Use default or set manually:"
    echo "   export LM_BASE_URL=\"https://your-ngrok-url.ngrok.io/v1\""
    echo ""
fi

# Start server
echo "Starting server on port ${PORT:-5000}..."
node server.js
