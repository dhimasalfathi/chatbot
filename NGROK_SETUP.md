# Quick Fix: Use ngrok to expose LM Studio

## Step 1: Download ngrok
1. Go to https://ngrok.com/
2. Sign up for free account
3. Download ngrok for Windows

## Step 2: Install and Setup
1. Extract ngrok.exe
2. Open Command Prompt in ngrok folder
3. Run: `ngrok authtoken YOUR_TOKEN` (get from ngrok dashboard)

## Step 3: Expose LM Studio
```cmd
ngrok http 169.254.198.50:1234
```

## Step 4: Get Public URL
ngrok will provide a public URL like: `https://abc123.ngrok.io`

## Step 5: Update server.js
```javascript
const LM_BASE_URL = process.env.LM_BASE_URL || 'https://abc123.ngrok.io/v1';
```

## Step 6: Test from GCP SSH
```bash
curl https://abc123.ngrok.io/v1/models
```

## ⚠️ Note: 
- Free ngrok has session limits
- URL changes every restart
- Consider paid plan for persistent URLs
