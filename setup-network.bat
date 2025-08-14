@echo off
echo ======================================
echo    LM Studio Network Setup
echo ======================================
echo.

REM Get local IP address
echo Mencari IP Address lokal...
for /f "tokens=2 delims=:" %%i in ('ipconfig ^| findstr /i "IPv4"') do (
    for /f "tokens=1" %%j in ("%%i") do (
        set LOCAL_IP=%%j
        goto :found
    )
)

:found
echo Local IP Address: %LOCAL_IP%
echo.

echo ======================================
echo   LANGKAH SETUP LM STUDIO
echo ======================================
echo.
echo 1. Buka LM Studio
echo 2. Go to Local Server tab
echo 3. Set Server Port: 1234
echo 4. Set Server Host: 0.0.0.0 (PENTING!)
echo 5. Enable "Allow requests from external devices"
echo 6. Start Server
echo.

echo ======================================
echo   FIREWALL SETUP (OPSIONAL)
echo ======================================
echo.
echo Untuk mengizinkan akses external, jalankan command berikut sebagai Administrator:
echo.
echo netsh advfirewall firewall add rule name="LM Studio API" dir=in action=allow protocol=TCP localport=1234
echo netsh advfirewall firewall add rule name="Chatbot Server" dir=in action=allow protocol=TCP localport=5000
echo.

echo ======================================
echo   URL AKSES EXTERNAL
echo ======================================
echo.
echo Setelah setup, aplikasi bisa diakses dari device lain dengan:
echo.
echo Chatbot: http://%LOCAL_IP%:5000/chatbot
echo API: http://%LOCAL_IP%:5000/chat
echo LM Studio API: http://%LOCAL_IP%:1234/v1
echo.

echo ======================================
echo   ENVIRONMENT VARIABLES
echo ======================================
echo.
echo Untuk production, set environment variables:
echo.
echo set LM_BASE_URL=http://%LOCAL_IP%:1234/v1
echo set PORT=5000
echo set NODE_ENV=production
echo.

pause
