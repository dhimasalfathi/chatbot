# LM Studio Network Configuration Guide

## Problem: SSH GCP can't access LM Studio API
Currently LM Studio is bound to localhost (127.0.0.1:1234) which is only accessible from the same machine.

## Solution: Configure LM Studio to accept external connections

### Step 1: Configure LM Studio Server
1. Open LM Studio
2. Go to "Local Server" tab
3. Look for "Server Configuration" or "Network Settings"
4. Change binding from:
   ```
   127.0.0.1:1234  (localhost only)
   ```
   To:
   ```
   0.0.0.0:1234    (all network interfaces)
   ```

### Step 2: Find Your Local IP Address
Open Command Prompt/PowerShell and run:
```cmd
ipconfig
```
Look for your local network IP (usually starts with 192.168.x.x or 10.x.x.x)

### Step 3: Test Local Network Access
```cmd
curl http://YOUR_LOCAL_IP:1234/v1/models
# Example: curl http://192.168.1.100:1234/v1/models
```

### Step 4: Configure Windows Firewall
1. Open Windows Defender Firewall
2. Click "Advanced settings"
3. Click "Inbound Rules" > "New Rule"
4. Select "Port" > Next
5. Select "TCP" and enter port "1234"
6. Allow the connection
7. Apply to all profiles (Domain, Private, Public)
8. Name it "LM Studio API"

### Step 5: Update Server.js Configuration
Update the LM_BASE_URL to use your local IP:
```javascript
const LM_BASE_URL = process.env.LM_BASE_URL || 'http://YOUR_LOCAL_IP:1234/v1';
```

### Step 6: Test from GCP SSH
```bash
curl http://YOUR_LOCAL_IP:1234/v1/models
```

## Alternative Solutions:

### Option A: Port Forwarding (if behind router)
Configure your router to forward port 1234 to your computer's local IP.

### Option B: VPN Solution
Use a VPN service to create a secure tunnel between GCP and your local machine.

### Option C: Run LM Studio on GCP
Install LM Studio directly on the GCP instance (if it has enough resources).

### Option D: Use Tunneling Service
Use tools like ngrok to create a public tunnel to your local LM Studio.
