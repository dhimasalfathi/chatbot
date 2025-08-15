# Test script untuk memastikan semua koneksi berjalan dengan baik
Write-Host "Testing Chatbot Configuration..." -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan

# 1. Test LM Studio URL detection
Write-Host "1. Testing LM Studio URL Detection:" -ForegroundColor Yellow
$lmUrl = & node -e "const { getLMStudioURL } = require('./lm-config'); console.log(getLMStudioURL());"
Write-Host "   LM Studio URL: $lmUrl" -ForegroundColor Green
Write-Host ""

# 2. Test LM Studio connectivity  
Write-Host "2. Testing LM Studio Connectivity:" -ForegroundColor Yellow
Write-Host "   Checking if LM Studio is accessible..." -ForegroundColor White
try {
    $response = Invoke-RestMethod -Uri "$lmUrl/models" -Headers @{"ngrok-skip-browser-warning"="true"} -TimeoutSec 10
    Write-Host "   LM Studio is accessible" -ForegroundColor Green
    Write-Host "   Available models: $($response.data.Count)" -ForegroundColor Green
} catch {
    Write-Host "   LM Studio connection failed: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# 3. Test chatbot server health
Write-Host "3. Testing Chatbot Server:" -ForegroundColor Yellow
try {
    $healthCheck = Invoke-RestMethod -Uri "http://localhost:5000/healthz" -TimeoutSec 5
    Write-Host "   Health check passed: $($healthCheck.status)" -ForegroundColor Green
} catch {
    Write-Host "   Health check failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   Start with: node server.js" -ForegroundColor White
}
Write-Host ""

# 4. Show current configuration
Write-Host "4. Current Configuration:" -ForegroundColor Yellow
$nodeEnv = if ($env:NODE_ENV) { $env:NODE_ENV } else { "development" }
$port = if ($env:PORT) { $env:PORT } else { "5000" }
$lmBaseUrl = if ($env:LM_BASE_URL) { $env:LM_BASE_URL } else { "auto-detected" }

Write-Host "   NODE_ENV: $nodeEnv" -ForegroundColor White
Write-Host "   PORT: $port" -ForegroundColor White
Write-Host "   LM_BASE_URL: $lmBaseUrl" -ForegroundColor White
Write-Host ""

Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "   1. If LM Studio connection fails: Check ngrok/devtunnel is running" -ForegroundColor White
Write-Host "   2. If server health fails: Start with 'node server.js'" -ForegroundColor White  
Write-Host "   3. Test frontend: Open http://localhost:5000/chatbot" -ForegroundColor White
Write-Host "   4. For GCP: Make sure firewall allows port 5000/8080" -ForegroundColor White
