# Router Port Forwarding Setup

## Step 1: Find Router IP
```cmd
ipconfig | findstr "Default Gateway"
```

## Step 2: Access Router Admin
1. Open browser: http://192.168.226.1 (your gateway)
2. Login with admin credentials

## Step 3: Setup Port Forwarding
1. Find "Port Forwarding" or "Virtual Server" section
2. Add new rule:
   - External Port: 1234
   - Internal IP: 192.168.226.14 (your computer)
   - Internal Port: 1234
   - Protocol: TCP

## Step 4: Find Public IP
```cmd
curl ifconfig.me
```

## Step 5: Test External Access
```bash
curl http://YOUR_PUBLIC_IP:1234/v1/models
```

## Step 6: Update server.js
```javascript
const LM_BASE_URL = process.env.LM_BASE_URL || 'http://YOUR_PUBLIC_IP:1234/v1';
```

## ⚠️ Security Note:
- This exposes LM Studio to internet
- Consider adding authentication
- Use firewall rules to restrict access
