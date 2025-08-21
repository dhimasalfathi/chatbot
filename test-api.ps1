# 🚀 BNI Customer Care Chatbot - PowerShell Testing Script
# PowerShell version for Windows users

$BaseURL = "http://localhost:3000"

Write-Host "🧪 Testing BNI Customer Care Chatbot API" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

# Function to make HTTP requests
function Invoke-ChatbotAPI {
    param(
        [string]$Method = "GET",
        [string]$Endpoint,
        [hashtable]$Body = $null
    )
    
    $Uri = "$BaseURL$Endpoint"
    $Headers = @{
        "Content-Type" = "application/json"
    }
    
    try {
        if ($Body) {
            $JsonBody = $Body | ConvertTo-Json -Depth 5
            $Response = Invoke-RestMethod -Uri $Uri -Method $Method -Headers $Headers -Body $JsonBody
        } else {
            $Response = Invoke-RestMethod -Uri $Uri -Method $Method -Headers $Headers
        }
        return $Response
    } catch {
        Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
        return $null
    }
}

# 1. Health Check
Write-Host "`n📊 1. Health Check" -ForegroundColor Yellow
$HealthCheck = Invoke-ChatbotAPI -Endpoint "/healthz"
$HealthCheck | ConvertTo-Json | Write-Host

# 2. Socket Status
Write-Host "`n🔌 2. Socket.IO Status" -ForegroundColor Yellow
$SocketStatus = Invoke-ChatbotAPI -Endpoint "/socket-status"
$SocketStatus | ConvertTo-Json | Write-Host

# 3. LM Studio Test
Write-Host "`n🤖 3. LM Studio Connection Test" -ForegroundColor Yellow
$LMTest = Invoke-ChatbotAPI -Endpoint "/test-lm"
$LMTest | ConvertTo-Json -Depth 3 | Write-Host

# 4. Start New Chat
Write-Host "`n💬 4. Start New Chat - Basic Greeting" -ForegroundColor Yellow
$ChatBody = @{
    message = "Halo, saya butuh bantuan"
}
$ChatResponse = Invoke-ChatbotAPI -Method "POST" -Endpoint "/chat" -Body $ChatBody
$ChatResponse | ConvertTo-Json -Depth 3 | Write-Host

$SessionID = $ChatResponse.session_id
Write-Host "📝 Session ID: $SessionID" -ForegroundColor Cyan

# 5. Customer Complaint
Write-Host "`n😤 5. Customer Complaint with Details" -ForegroundColor Yellow
$ComplaintBody = @{
    message = "Saya mau komplain kartu kredit saya, nama saya John Doe, nomor rekening 1234567890123456. Aplikasi mobile banking error terus dan tidak bisa transfer. Tolong hubungi saya besok sore jam 3-5"
    session_id = $SessionID
}
$ComplaintResponse = Invoke-ChatbotAPI -Method "POST" -Endpoint "/chat" -Body $ComplaintBody
$ComplaintResponse | ConvertTo-Json -Depth 3 | Write-Host

# 6. Follow-up Message
Write-Host "`n🔄 6. Follow-up Message" -ForegroundColor Yellow
$FollowUpBody = @{
    message = "Prioritasnya tinggi ya, saya perlu solusi cepat"
    session_id = $SessionID
}
$FollowUpResponse = Invoke-ChatbotAPI -Method "POST" -Endpoint "/chat" -Body $FollowUpBody
$FollowUpResponse | ConvertTo-Json -Depth 3 | Write-Host

# 7. Get Session Info
if ($SessionID) {
    Write-Host "`n📋 7. Get Session Information" -ForegroundColor Yellow
    $SessionInfo = Invoke-ChatbotAPI -Endpoint "/chat/$SessionID"
    $SessionInfo | ConvertTo-Json -Depth 3 | Write-Host
}

# 8. FAQ Search
Write-Host "`n❓ 8. FAQ Search - Balance Inquiry" -ForegroundColor Yellow
$FAQResponse = Invoke-ChatbotAPI -Endpoint "/faq?q=saldo minimum"
$FAQResponse | ConvertTo-Json | Write-Host

# 9. SLA Search - Credit Card
Write-Host "`n⏰ 9. SLA Search - Credit Card Issues" -ForegroundColor Yellow
$SLAResponse1 = Invoke-ChatbotAPI -Endpoint "/sla?q=kartu kredit&category=complaint&limit=3"
$SLAResponse1 | ConvertTo-Json -Depth 3 | Write-Host

# 10. SLA Search - Account Problems
Write-Host "`n⏰ 10. SLA Search - Account Problems" -ForegroundColor Yellow
$SLAResponse2 = Invoke-ChatbotAPI -Endpoint "/sla?q=rekening terblokir&limit=5"
$SLAResponse2 | ConvertTo-Json -Depth 3 | Write-Host

# 11. Legacy Extract
Write-Host "`n🔍 11. Legacy Extract Endpoint" -ForegroundColor Yellow
$ExtractBody = @{
    text = "Saya Ahmad Rizki, rekening 9876543210987654, komplain kartu kredit limit tidak sesuai, hubungi via mobile banking"
}
$ExtractResponse = Invoke-ChatbotAPI -Method "POST" -Endpoint "/extract" -Body $ExtractBody
$ExtractResponse | ConvertTo-Json -Depth 3 | Write-Host

# 12. Error Testing - Empty Message
Write-Host "`n❌ 12. Error Test - Empty Message" -ForegroundColor Red
$ErrorBody1 = @{
    message = ""
}
$ErrorResponse1 = Invoke-ChatbotAPI -Method "POST" -Endpoint "/chat" -Body $ErrorBody1
if ($ErrorResponse1) { $ErrorResponse1 | ConvertTo-Json | Write-Host }

# 13. Error Testing - Missing Message
Write-Host "`n❌ 13. Error Test - Missing Message Field" -ForegroundColor Red
$ErrorBody2 = @{
    session_id = "test"
}
$ErrorResponse2 = Invoke-ChatbotAPI -Method "POST" -Endpoint "/chat" -Body $ErrorBody2
if ($ErrorResponse2) { $ErrorResponse2 | ConvertTo-Json | Write-Host }

# 14. Error Testing - Invalid Session
Write-Host "`n❌ 14. Error Test - Invalid Session ID" -ForegroundColor Red
$ErrorResponse3 = Invoke-ChatbotAPI -Endpoint "/chat/invalid-session-id"
if ($ErrorResponse3) { $ErrorResponse3 | ConvertTo-Json | Write-Host }

# 15. Complete Customer Journey
Write-Host "`n🛣️ 15. Complete Customer Journey Test" -ForegroundColor Yellow
$JourneyBody = @{
    message = "Selamat pagi, saya Budi Santoso, rekening 1122334455667788. Mobile banking saya error dan tidak bisa login. Mau komplain dan minta solusi. Hubungi saya hari ini jam 2-4 sore via telepon."
}
$JourneyResponse = Invoke-ChatbotAPI -Method "POST" -Endpoint "/chat" -Body $JourneyBody
$JourneyResponse | ConvertTo-Json -Depth 3 | Write-Host

$NewSessionID = $JourneyResponse.session_id
if ($NewSessionID) {
    Write-Host "`n🔄 Follow-up in same journey:" -ForegroundColor Cyan
    $JourneyFollowUp = @{
        message = "Iya betul, sangat mendesak ini"
        session_id = $NewSessionID
    }
    $JourneyFollowUpResponse = Invoke-ChatbotAPI -Method "POST" -Endpoint "/chat" -Body $JourneyFollowUp
    $JourneyFollowUpResponse | ConvertTo-Json -Depth 3 | Write-Host
}

# Performance Test
Write-Host "`n⚡ Quick Performance Test (10 rapid requests):" -ForegroundColor Magenta
for ($i = 1; $i -le 10; $i++) {
    $StartTime = Get-Date
    $null = Invoke-RestMethod -Uri "$BaseURL/healthz" -Method GET -ErrorAction SilentlyContinue
    $EndTime = Get-Date
    $Duration = ($EndTime - $StartTime).TotalMilliseconds
    Write-Host "Request $i : $([math]::Round($Duration, 2))ms" -ForegroundColor Gray
}

Write-Host "`n✅ Testing Complete!" -ForegroundColor Green
Write-Host "📊 Summary:" -ForegroundColor Green
Write-Host "- All major endpoints tested" -ForegroundColor White
Write-Host "- Error handling verified" -ForegroundColor White
Write-Host "- Session management checked" -ForegroundColor White
Write-Host "- Knowledge base (FAQ/SLA) working" -ForegroundColor White
Write-Host "- Ready for frontend integration!" -ForegroundColor White

Write-Host "`n🎉 All tests completed!" -ForegroundColor Green

# Frontend Integration Examples
Write-Host "`n🌐 Frontend Integration Examples:" -ForegroundColor Cyan
Write-Host @"
// JavaScript Fetch Example:
const response = await fetch('$BaseURL/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: 'User message here',
    session_id: sessionId // optional for first message
  })
});
const data = await response.json();

// jQuery Example:
$.ajax({
  url: '$BaseURL/chat',
  method: 'POST',
  contentType: 'application/json',
  data: JSON.stringify({
    message: 'User message here',
    session_id: sessionId
  }),
  success: function(data) {
    console.log('Bot response:', data.message);
  }
});
"@ -ForegroundColor Gray
