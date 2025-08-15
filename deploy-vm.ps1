# PowerShell Script untuk Deploy ke VM dari Windows
# Jalankan script ini dari local machine untuk setup dan deploy ke VM

param(
    [Parameter(Mandatory=$true)]
    [string]$VMName,
    
    [Parameter(Mandatory=$true)]
    [string]$Zone,
    
    [string]$Username = $env:USERNAME
)

Write-Host "🚀 Deploying chatbot to GCP VM: $VMName" -ForegroundColor Green

# Function untuk colored output
function Write-Status {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

try {
    # Check if gcloud is installed
    if (!(Get-Command gcloud -ErrorAction SilentlyContinue)) {
        Write-Error "gcloud CLI not found. Please install Google Cloud SDK first."
        exit 1
    }

    # Check if VM exists
    Write-Status "Checking VM status..."
    $vmInfo = gcloud compute instances describe $VMName --zone=$Zone --format="value(status)" 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Error "VM '$VMName' not found in zone '$Zone'"
        exit 1
    }

    if ($vmInfo -ne "RUNNING") {
        Write-Warning "VM is not running. Starting VM..."
        gcloud compute instances start $VMName --zone=$Zone
        Start-Sleep 10
    }

    # Setup firewall rule (one time)
    Write-Status "Setting up firewall rules..."
    $firewallExists = gcloud compute firewall-rules list --filter="name=allow-chatbot-8080" --format="value(name)" 2>$null
    if ([string]::IsNullOrEmpty($firewallExists)) {
        Write-Status "Creating firewall rule for port 8080..."
        gcloud compute firewall-rules create allow-chatbot-8080 `
            --allow tcp:8080 `
            --source-ranges 0.0.0.0/0 `
            --description "Allow chatbot on port 8080"
    } else {
        Write-Status "Firewall rule already exists"
    }

    # Copy deployment script to VM
    Write-Status "Copying deployment script to VM..."
    gcloud compute scp deploy-vm.sh "${VMName}:~/" --zone=$Zone

    # Make script executable and run it
    Write-Status "Executing deployment script on VM..."
    gcloud compute ssh $VMName --zone=$Zone --command="chmod +x ~/deploy-vm.sh && ~/deploy-vm.sh"

    # Get VM external IP
    Write-Status "Getting VM external IP..."
    $externalIP = gcloud compute instances describe $VMName --zone=$Zone --format="value(networkInterfaces[0].accessConfigs[0].natIP)"

    # Test deployment
    Write-Status "Testing deployment..."
    Start-Sleep 5
    
    try {
        $response = Invoke-WebRequest -Uri "http://${externalIP}:8080/healthz" -TimeoutSec 10 -UseBasicParsing
        if ($response.StatusCode -eq 200) {
            Write-Status "✅ Deployment successful!"
        }
    } catch {
        Write-Warning "❌ Health check failed, but deployment may still be working"
    }

    # Show access information
    Write-Host ""
    Write-Host "🎉 Deployment Summary:" -ForegroundColor Cyan
    Write-Host "=====================================]" -ForegroundColor Cyan
    Write-Host "VM Name:      $VMName" -ForegroundColor White
    Write-Host "Zone:         $Zone" -ForegroundColor White
    Write-Host "External IP:  $externalIP" -ForegroundColor White
    Write-Host ""
    Write-Host "📋 Access URLs:" -ForegroundColor Yellow
    Write-Host "   Chatbot:   http://${externalIP}:8080/chatbot.html" -ForegroundColor White
    Write-Host "   API:       http://${externalIP}:8080/chat" -ForegroundColor White
    Write-Host "   Health:    http://${externalIP}:8080/healthz" -ForegroundColor White
    Write-Host "   SLA:       http://${externalIP}:8080/sla" -ForegroundColor White
    Write-Host ""
    Write-Host "🔧 SSH to VM:" -ForegroundColor Yellow
    Write-Host "   gcloud compute ssh $VMName --zone=$Zone" -ForegroundColor White
    Write-Host ""
    Write-Host "📊 Monitor with:" -ForegroundColor Yellow
    Write-Host "   pm2 status" -ForegroundColor White
    Write-Host "   pm2 logs chatbot-server" -ForegroundColor White

} catch {
    Write-Error "Deployment failed: $($_.Exception.Message)"
    exit 1
}

Write-Host ""
Write-Host "⚠️  Important Reminders:" -ForegroundColor Yellow
Write-Host "  1. Keep ngrok running on your local machine" -ForegroundColor White
Write-Host "  2. ngrok URL: https://6a7d04fe49a2.ngrok-free.app/v1" -ForegroundColor White
Write-Host "  3. If deployment fails, SSH to VM and check: pm2 logs chatbot-server" -ForegroundColor White
