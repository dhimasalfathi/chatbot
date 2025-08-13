#!/bin/bash

# 🚀 Auto Setup Script untuk GCP VM deploy-test
# Jalankan script ini di SSH terminal VM

echo "🎯 Starting Chatbot Setup for GCP VM: deploy-test"
echo "📍 Zone: us-central1-c"
echo ""

# Update system
echo "📦 Updating system packages..."
sudo apt update -y

# Install Node.js
echo "🟢 Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
echo "✅ Node.js version: $(node --version)"
echo "✅ NPM version: $(npm --version)"

# Install PM2
echo "🔄 Installing PM2..."
sudo npm install -g pm2

# Create project directory
echo "📁 Creating project directory..."
mkdir -p ~/chatbot
cd ~/chatbot

# Check if we're in the right directory
echo "📍 Current directory: $(pwd)"

echo ""
echo "🎉 Basic setup completed!"
echo ""
echo "📋 Next steps:"
echo "1. Upload your project files to ~/chatbot/"
echo "2. Run: npm install"
echo "3. Run: chmod +x start-server.sh"  
echo "4. Run: ./start-server.sh production"
echo ""
echo "🌐 Manual file upload methods:"
echo "   Method 1: Git clone your repository"
echo "   Method 2: Copy-paste file contents via nano/vim"
echo "   Method 3: Download from GitHub as ZIP"
echo ""
echo "🔥 Don't forget to setup firewall rule in GCP web console!"
echo "   VPC Network > Firewall > CREATE FIREWALL RULE"
echo "   Name: allow-chatbot-port"
echo "   TCP Port: 8080"
echo "   Source: 0.0.0.0/0"
