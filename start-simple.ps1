# Simple start script untuk GCP deployment (PowerShell)

Write-Host "🚀 Starting Chatbot Server..." -ForegroundColor Green

# Set LM Studio URL jika belum ada
if (-not $env:LM_BASE_URL) {
    Write-Host "⚠️  LM_BASE_URL not set. Use default or set manually:" -ForegroundColor Yellow
    Write-Host '   $env:LM_BASE_URL = "https://your-ngrok-url.ngrok.io/v1"' -ForegroundColor White
    Write-Host ""
}

# Start server
$port = if ($env:PORT) { $env:PORT } else { "5000" }
Write-Host "Starting server on port $port..." -ForegroundColor Cyan
node server.js
