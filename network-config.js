const os = require('os');

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  
  // Priority order: Wi-Fi, Ethernet, then others
  const priorityOrder = ['Wi-Fi', 'Ethernet', 'Local Area Connection'];
  
  // First try priority interfaces
  for (const priority of priorityOrder) {
    for (const name of Object.keys(interfaces)) {
      if (name.toLowerCase().includes(priority.toLowerCase())) {
        for (const interface of interfaces[name]) {
          // Skip internal, non-IPv4, and APIPA addresses
          if (interface.family === 'IPv4' && 
              !interface.internal && 
              !interface.address.startsWith('169.254.') &&
              !interface.address.startsWith('127.')) {
            console.log(`🌐 Selected network interface: ${name} (${interface.address})`);
            return interface.address;
          }
        }
      }
    }
  }
  
  // Fallback: any valid IPv4 address that's not APIPA or loopback
  for (const name of Object.keys(interfaces)) {
    for (const interface of interfaces[name]) {
      if (interface.family === 'IPv4' && 
          !interface.internal && 
          !interface.address.startsWith('169.254.') &&
          !interface.address.startsWith('127.')) {
        console.log(`🌐 Fallback network interface: ${name} (${interface.address})`);
        return interface.address;
      }
    }
  }
  
  console.warn('⚠️  No valid network interface found, using localhost');
  return 'localhost';
}

function getNetworkConfig() {
  const localIP = getLocalIP();
  
  return {
    localIP,
    chatbotURL: `http://${localIP}:5000/chatbot`,
    apiURL: `http://${localIP}:5000/chat`,
    lmStudioURL: `http://${localIP}:1234/v1`,
    externalAccessible: localIP !== 'localhost'
  };
}

// Export untuk digunakan di server.js
module.exports = { getLocalIP, getNetworkConfig };

// Jika dijalankan langsung, tampilkan info network
if (require.main === module) {
  const config = getNetworkConfig();
  
  console.log('🌐 NETWORK CONFIGURATION');
  console.log('========================');
  console.log(`Local IP: ${config.localIP}`);
  console.log(`Chatbot: ${config.chatbotURL}`);
  console.log(`API: ${config.apiURL}`);
  console.log(`LM Studio: ${config.lmStudioURL}`);
  console.log(`External Access: ${config.externalAccessible ? '✅ Available' : '❌ Not Available'}`);
  console.log('');
  
  if (config.externalAccessible) {
    console.log('📱 MOBILE/EXTERNAL ACCESS:');
    console.log('==========================');
    console.log('1. Pastikan firewall mengizinkan port 5000 dan 1234');
    console.log('2. Setup LM Studio dengan host: 0.0.0.0');
    console.log('3. Akses dari device lain menggunakan URL di atas');
  } else {
    console.log('⚠️  WARNING: External access tidak tersedia');
    console.log('   Periksa koneksi network dan konfigurasi IP');
  }
}
