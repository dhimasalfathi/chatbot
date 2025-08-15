#!/bin/bash

# Automated Deployment Script for GCP Compute Engine
# Run this script on your VM instance

set -e

echo "🚀 Starting chatbot deployment..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running on Linux
if [[ "$OSTYPE" != "linux-gnu"* ]]; then
    print_error "This script is designed for Linux. Please run on your GCP VM."
    exit 1
fi

# Update system packages
print_status "Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Node.js 18.x if not installed
if ! command -v node &> /dev/null; then
    print_status "Installing Node.js 18.x..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    print_status "Node.js already installed: $(node --version)"
fi

# Install PM2 if not installed
if ! command -v pm2 &> /dev/null; then
    print_status "Installing PM2..."
    sudo npm install -g pm2
else
    print_status "PM2 already installed: $(pm2 --version)"
fi

# Install Git if not installed
if ! command -v git &> /dev/null; then
    print_status "Installing Git..."
    sudo apt install git -y
else
    print_status "Git already installed: $(git --version)"
fi

# Navigate to home directory
cd ~

# Clone or update repository
if [ -d "chatbot" ]; then
    print_status "Updating existing repository..."
    cd chatbot
    git pull origin main
else
    print_status "Cloning repository..."
    git clone https://github.com/dhimasalfathi/chatbot.git
    cd chatbot
fi

# Install npm dependencies
print_status "Installing dependencies..."
npm install

# Create environment file
print_status "Creating environment configuration..."
cat > .env << 'EOF'
NODE_ENV=production
PORT=8080
LM_BASE_URL=https://6a7d04fe49a2.ngrok-free.app/v1
LM_MODEL=qwen2.5-7b-instruct-1m
LM_TEMPERATURE=0.8
EOF

# Configure UFW firewall
print_status "Configuring firewall..."
sudo ufw allow 8080 || print_warning "UFW may not be enabled"

# Stop existing PM2 process
print_status "Stopping existing PM2 processes..."
pm2 stop chatbot-server 2>/dev/null || print_warning "No existing PM2 process found"

# Start application with PM2
print_status "Starting application with PM2..."
pm2 start ecosystem.config.json --env production

# Save PM2 configuration
pm2 save

# Setup PM2 startup (user will need to run the displayed command)
print_status "Setting up PM2 startup..."
pm2 startup

# Test the deployment
print_status "Testing deployment..."
sleep 3

# Test health endpoint
if curl -s http://localhost:8080/healthz > /dev/null; then
    print_status "✅ Health check passed!"
else
    print_error "❌ Health check failed!"
fi

# Show PM2 status
print_status "PM2 Status:"
pm2 status

# Get external IP
EXTERNAL_IP=$(curl -s -H "Metadata-Flavor: Google" http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip 2>/dev/null || echo "Unable to get external IP")

print_status "🎉 Deployment completed!"
echo ""
echo "📋 Access URLs:"
echo "   Local:    http://localhost:8080"
echo "   External: http://$EXTERNAL_IP:8080"
echo ""
echo "🔧 Management commands:"
echo "   pm2 status          - Check status"
echo "   pm2 logs chatbot-server - View logs"
echo "   pm2 restart chatbot-server - Restart app"
echo "   pm2 stop chatbot-server - Stop app"
echo ""
echo "⚠️  Don't forget to:"
echo "   1. Run the PM2 startup command shown above"
echo "   2. Ensure GCP firewall allows port 8080"
echo "   3. Keep ngrok running on your local machine"

# Show last few log lines
echo ""
print_status "Recent logs:"
pm2 logs chatbot-server --lines 5 --nostream || true
