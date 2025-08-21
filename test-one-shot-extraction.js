// Note: Install node-fetch if not already available: npm install node-fetch
// For Node.js 18+, you can use built-in fetch instead

let fetch;
try {
  // Try to use built-in fetch (Node.js 18+)
  fetch = globalThis.fetch;
  if (!fetch) throw new Error('No built-in fetch');
} catch {
  // Fallback to node-fetch
  try {
    fetch = require('node-fetch');
  } catch {
    console.error('❌ Please install node-fetch: npm install node-fetch');
    console.error('Or use Node.js 18+ which has built-in fetch support');
    process.exit(1);
  }
}

const BASE_URL = 'http://localhost:3000';

// Test cases for one-shot extraction
const testCases = [
  {
    name: "Complete information",
    text: "Saya mau komplain kartu kredit, nama saya Ahmad Rizki, nomor rekening 1234567890123456, masalahnya limit kartu kredit tidak sesuai"
  },
  {
    name: "Partial information",
    text: "Halo, saya Budi Santoso, saya ada masalah dengan mobile banking tidak bisa login"
  },
  {
    name: "Detailed complaint",
    text: "Selamat pagi, nama saya Siti Nurhaliza, nomor rekening 0020001234567890. Saya mengalami masalah saat melakukan transfer antar bank melalui mobile banking BNI. Setiap kali saya coba transfer ke bank lain, transaksi gagal dengan pesan error 'sistem sedang maintenance'. Sudah 3 hari ini masalahnya berlangsung."
  }
];

async function testOneShot() {
  console.log('🧪 Testing One-Shot Extraction Feature\n');
  
  for (const testCase of testCases) {
    console.log(`📝 Test Case: ${testCase.name}`);
    console.log(`📥 Input: ${testCase.text}`);
    
    try {
      // Test with new /chat/extract endpoint
      const response = await fetch(`${BASE_URL}/chat/extract`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text: testCase.text })
      });
      
      const result = await response.json();
      
      console.log('📤 Output:');
      console.log(JSON.stringify(result, null, 2));
      console.log('─'.repeat(60));
      
    } catch (error) {
      console.error('❌ Error:', error.message);
    }
  }
}

async function testChatFlow() {
  console.log('\n🧪 Testing Chat Flow with One-Shot Detection\n');
  
  try {
    const response = await fetch(`${BASE_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        message: "Saya mau komplain kartu kredit, nama saya Ahmad Rizki, nomor rekening 1234567890123456, masalahnya limit kartu kredit tidak sesuai"
      })
    });
    
    const result = await response.json();
    
    console.log('📤 Chat Response:');
    console.log(JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run tests
async function runTests() {
  await testOneShot();
  await testChatFlow();
}

runTests().catch(console.error);
