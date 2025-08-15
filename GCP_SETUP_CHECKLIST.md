# GCP Setup Checklist - WAJIB SEBELUM DEPLOY

## 🔧 1. Project GCP Setup

### Check Current Project
```bash
# Cek project yang aktif
gcloud config get-value project

# List semua project
gcloud projects list

# Set project jika belum benar
gcloud config set project chatbot-441815
```

### Enable Required APIs
```bash
# Enable Cloud Run API
gcloud services enable run.googleapis.com

# Enable Cloud Build API (untuk Docker build)
gcloud services enable cloudbuild.googleapis.com

# Enable Container Registry API
gcloud services enable containerregistry.googleapis.com

# Verify enabled services
gcloud services list --enabled | grep -E "(run|build|container)"
```

## 🔧 2. Authentication & Permissions

### Login & Set Default Region
```bash
# Login ke GCP
gcloud auth login

# Set default region (Jakarta/Singapore region)
gcloud config set run/region asia-southeast2

# Verify configuration
gcloud config list
```

### Check IAM Permissions
```bash
# Check current user
gcloud auth list

# Your account needs these roles:
# - Cloud Run Admin
# - Cloud Build Editor  
# - Storage Admin
# - Service Account User
```

## 🔧 3. VM Instance Setup (Jika Pakai Compute Engine)

### Create VM Instance (Optional - jika tidak pakai Cloud Run)
```bash
# Create VM instance
gcloud compute instances create chatbot-vm \
    --zone=asia-southeast2-a \
    --machine-type=e2-medium \
    --network-tier=PREMIUM \
    --maintenance-policy=MIGRATE \
    --service-account=YOUR_SERVICE_ACCOUNT@chatbot-441815.iam.gserviceaccount.com \
    --scopes=https://www.googleapis.com/auth/cloud-platform \
    --image=ubuntu-2004-focal-v20240110 \
    --image-project=ubuntu-os-cloud \
    --boot-disk-size=20GB \
    --boot-disk-type=pd-standard

# Enable HTTP/HTTPS traffic
gcloud compute instances add-tags chatbot-vm --tags=http-server,https-server --zone=asia-southeast2-a
```

### Firewall Rules
```bash
# Allow HTTP traffic (port 80)
gcloud compute firewall-rules create allow-http \
    --allow tcp:80 \
    --source-ranges 0.0.0.0/0 \
    --description "Allow HTTP traffic"

# Allow HTTPS traffic (port 443)  
gcloud compute firewall-rules create allow-https \
    --allow tcp:443 \
    --source-ranges 0.0.0.0/0 \
    --description "Allow HTTPS traffic"

# Allow custom port 8080 for chatbot
gcloud compute firewall-rules create allow-chatbot \
    --allow tcp:8080 \
    --source-ranges 0.0.0.0/0 \
    --description "Allow chatbot on port 8080"

# List firewall rules
gcloud compute firewall-rules list
```

## 🔧 4. Cloud Run Setup (Recommended)

### Set Default Configuration
```bash
# Set default region for Cloud Run
gcloud config set run/region asia-southeast2

# Set default platform
gcloud config set run/platform managed
```

## 🔧 5. Pre-Deployment Checks

### Verify ngrok is Running
```bash
# Test ngrok URL from local
curl -H "ngrok-skip-browser-warning: true" https://6a7d04fe49a2.ngrok-free.app/v1/models

# Should return list of models
```

### Test Local Build (Optional)
```bash
# Test Docker build locally
docker build -t chatbot-test .

# Test run locally
docker run -p 8080:8080 \
  -e LM_BASE_URL=https://6a7d04fe49a2.ngrok-free.app/v1 \
  -e NODE_ENV=production \
  chatbot-test
```

## 🔧 6. Environment Variables Checklist

Pastikan variables ini sudah benar:
- ✅ **PROJECT_ID**: `chatbot-441815`
- ✅ **REGION**: `asia-southeast2` 
- ✅ **LM_BASE_URL**: `https://6a7d04fe49a2.ngrok-free.app/v1`
- ✅ **PORT**: `8080`
- ✅ **NODE_ENV**: `production`

## 🚨 CRITICAL CHECKS BEFORE DEPLOY:

1. ✅ GCP project exists and accessible
2. ✅ Required APIs enabled 
3. ✅ Proper IAM permissions
4. ✅ ngrok tunnel active and reachable
5. ✅ Firewall rules configured (if using VM)
6. ✅ gcloud CLI configured and authenticated

## 📝 Quick Verification Commands:

```bash
# All-in-one verification
echo "Project: $(gcloud config get-value project)"
echo "Region: $(gcloud config get-value run/region)"  
echo "User: $(gcloud config get-value account)"
echo "ngrok Status: $(curl -s -o /dev/null -w "%{http_code}" https://6a7d04fe49a2.ngrok-free.app/v1/models)"
```

## ⚠️ Jika Pakai VM Instance:

### SSH ke VM dan Setup
```bash
# SSH ke instance
gcloud compute ssh chatbot-vm --zone=asia-southeast2-a

# Di dalam VM:
# Install Node.js, Git, PM2, dll
# Clone repository
# Setup environment variables
# Run aplikasi
```

## 🎯 Ready to Deploy When:

All checks above pass ✅ Then run:
```bash
# For Cloud Run
./deploy-to-gcp.ps1

# For VM Instance  
# SSH dan jalankan manual deployment
```
