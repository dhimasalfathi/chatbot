# GCP Cloud Run Deployment Script
# Run this from the chatbot directory

param(
    [string]$ProjectId = "chatbot-441815",
    [string]$ServiceName = "chatbot-server",
    [string]$Region = "asia-southeast2",
    [string]$NgrokUrl = "https://6a7d04fe49a2.ngrok-free.app/v1"
)

Write-Host "🚀 Starting GCP Cloud Run Deployment..." -ForegroundColor Green

# Set project
Write-Host "📋 Setting GCP project: $ProjectId" -ForegroundColor Yellow
gcloud config set project $ProjectId

# Build and push image
Write-Host "🔨 Building and pushing container image..." -ForegroundColor Yellow
gcloud builds submit --tag gcr.io/$ProjectId/$ServiceName

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed!" -ForegroundColor Red
    exit 1
}

# Deploy to Cloud Run
Write-Host "🌐 Deploying to Cloud Run..." -ForegroundColor Yellow
gcloud run deploy $ServiceName `
  --image gcr.io/$ProjectId/$ServiceName `
  --platform managed `
  --region $Region `
  --allow-unauthenticated `
  --port 8080 `
  --memory 1Gi `
  --cpu 1 `
  --timeout 300 `
  --concurrency 1000 `
  --max-instances 10 `
  --set-env-vars NODE_ENV=production `
  --set-env-vars PORT=8080 `
  --set-env-vars LM_BASE_URL=$NgrokUrl `
  --set-env-vars LM_MODEL=qwen2.5-7b-instruct-1m `
  --set-env-vars LM_TEMPERATURE=0.8

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Deployment failed!" -ForegroundColor Red
    exit 1
}

# Get service URL
Write-Host "🔍 Getting service URL..." -ForegroundColor Yellow
$ServiceUrl = gcloud run services describe $ServiceName --region=$Region --format="value(status.url)"

Write-Host "✅ Deployment successful!" -ForegroundColor Green
Write-Host "📡 Service URL: $ServiceUrl" -ForegroundColor Cyan

# Test deployment
Write-Host "🧪 Testing deployment..." -ForegroundColor Yellow

# Test health endpoint
Write-Host "Testing health endpoint..." -ForegroundColor Gray
$HealthResponse = Invoke-RestMethod -Uri "$ServiceUrl/healthz" -Method Get -ErrorAction SilentlyContinue
if ($HealthResponse) {
    Write-Host "✅ Health check passed: $($HealthResponse.status)" -ForegroundColor Green
} else {
    Write-Host "❌ Health check failed" -ForegroundColor Red
}

# Test chat endpoint
Write-Host "Testing chat endpoint..." -ForegroundColor Gray
$ChatBody = @{
    message = "Halo, saya ada masalah dengan ATM transfer"
} | ConvertTo-Json

try {
    $ChatResponse = Invoke-RestMethod -Uri "$ServiceUrl/chat" -Method Post -Body $ChatBody -ContentType "application/json"
    Write-Host "✅ Chat test passed!" -ForegroundColor Green
    Write-Host "Bot Response: $($ChatResponse.message.Substring(0, [Math]::Min(100, $ChatResponse.message.Length)))..." -ForegroundColor Cyan
    Write-Host "Action: $($ChatResponse.action)" -ForegroundColor Cyan
    Write-Host "Confidence: $($ChatResponse.confidence)" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Chat test failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test SLA endpoint
Write-Host "Testing SLA endpoint..." -ForegroundColor Gray
try {
    $SlaResponse = Invoke-RestMethod -Uri "$ServiceUrl/sla?q=ATM&limit=2" -Method Get
    Write-Host "✅ SLA test passed! Found $($SlaResponse.count) results" -ForegroundColor Green
} catch {
    Write-Host "❌ SLA test failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n🎉 Deployment and testing complete!" -ForegroundColor Green
Write-Host "🌐 Chatbot URL: $ServiceUrl/chatbot" -ForegroundColor Cyan
Write-Host "📡 API URL: $ServiceUrl/chat" -ForegroundColor Cyan
Write-Host "📊 SLA API: $ServiceUrl/sla" -ForegroundColor Cyan

# Save URLs to file
$UrlInfo = @"
# GCP Deployment URLs
Chatbot Interface: $ServiceUrl/chatbot
Chat API: $ServiceUrl/chat
SLA API: $ServiceUrl/sla
Health Check: $ServiceUrl/healthz

# Deployment Info
Service: $ServiceName
Region: $Region
Project: $ProjectId
LM Studio URL: $NgrokUrl

Deployed at: $(Get-Date)
"@

$UrlInfo | Out-File -FilePath "deployment-urls.txt" -Encoding UTF8
Write-Host "📝 URLs saved to deployment-urls.txt" -ForegroundColor Gray
