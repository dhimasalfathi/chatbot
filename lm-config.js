// Environment-specific configuration for LM Studio connection
const os = require('os');

function detectEnvironment() {
  // Check if running on GCP
  const isGCP = process.env.GOOGLE_CLOUD_PROJECT || 
                process.env.GCP_PROJECT ||
                process.env.GCLOUD_PROJECT ||
                os.hostname().includes('gcp') ||
                os.hostname().includes('google');
  
  // Check if running in production
  const isProduction = process.env.NODE_ENV === 'production';
  
  return {
    isGCP,
    isProduction,
    isLocal: !isGCP && !isProduction
  };
}

function getLMStudioURL() {
  const env = detectEnvironment();
  
  // Priority 1: Environment variable (manual override)
  if (process.env.LM_BASE_URL) {
    console.log(`🔧 Using LM_BASE_URL from environment: ${process.env.LM_BASE_URL}`);
    return process.env.LM_BASE_URL;
  }
  
  // Priority 2: Check for ngrok URL file (useful for automated deployment)
  try {
    const fs = require('fs');
    const ngrokFile = require('path').join(__dirname, 'ngrok-url.txt');
    if (fs.existsSync(ngrokFile)) {
      const ngrokUrl = fs.readFileSync(ngrokFile, 'utf8').trim();
      if (ngrokUrl.startsWith('http')) {
        console.log(`🔧 Using ngrok URL from file: ${ngrokUrl}/v1`);
        return `${ngrokUrl}/v1`;
      }
    }
  } catch (e) {
    // Ignore file read errors
  }
  
  // Priority 3: Environment-specific defaults
  if (env.isGCP || env.isProduction) {
    // GCP deployment - need external connection to laptop
    console.log('🔴 GCP/Production detected - using placeholder URL');
    console.log('⚠️  Please set LM_BASE_URL environment variable or create ngrok-url.txt file');
    return 'http://YOUR_LAPTOP_IP_OR_NGROK_URL:1234/v1';
  } else {
    // Local development - use auto-detected IP
    const { getLocalIP } = require('./network-config');
    const localIP = getLocalIP();
    console.log(`🟡 Local development detected - using ${localIP}:1234`);
    return `http://${localIP}:1234/v1`;
  }
}

function getDeploymentInstructions() {
  const env = detectEnvironment();
  
  if (env.isGCP || env.isProduction) {
    return {
      environment: 'GCP/Production',
      instructions: [
        '1. Setup ngrok on your laptop: npm install -g ngrok',
        '2. Configure LM Studio with Host: 0.0.0.0, Port: 1234',
        '3. Run: ngrok http 1234',
        '4. Copy ngrok URL and set: export LM_BASE_URL="https://xxxxx.ngrok.io/v1"',
        '5. Or create file: echo "https://xxxxx.ngrok.io" > ngrok-url.txt',
        '6. Restart server: pm2 restart chatbot'
      ]
    };
  } else {
    return {
      environment: 'Local Development',
      instructions: [
        '1. Configure LM Studio with Host: 0.0.0.0, Port: 1234',
        '2. Enable "Allow external requests" in LM Studio',
        '3. Start LM Studio server',
        '4. Auto-detection will handle the rest'
      ]
    };
  }
}

module.exports = {
  detectEnvironment,
  getLMStudioURL,
  getDeploymentInstructions
};
