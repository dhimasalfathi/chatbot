// Demo percakapan chatbot - berbagai skenario
async function demoConversations() {
  console.log('🎭 DEMO PERCAKAPAN CHATBOT CUSTOMER SERVICE BANK\n');

  // Scenario 1: ATM Transfer Problem
  console.log('=== 💳 SCENARIO 1: MASALAH TRANSFER ATM ===');
  await simulateChat([
    "Halo, transfer ATM saya bermasalah",
    "Nama saya Ahmad Rizki", 
    "Transfer ke sesama BNI gagal tapi uang sudah kepotong",
    "Rekening 1234567890123",
    "Telepon saja",
    "09:00-17:00"
  ]);

  // Scenario 2: Credit Card Fraud
  console.log('\n=== 💳 SCENARIO 2: TRANSAKSI KARTU KREDIT MENCURIGAKAN ===');
  await simulateChat([
    "Ada transaksi kartu kredit yang tidak saya lakukan",
    "Siti Aminah",
    "Ada transaksi 2.5 juta di merchant online yang tidak saya kenali",
    "Chat saja"
  ]);

  // Scenario 3: E-wallet Top Up Issue  
  console.log('\n=== 📱 SCENARIO 3: TOP UP E-WALLET GAGAL ===');
  await simulateChat([
    "Top up Dana saya gagal tapi uang kepotong",
    "Budi Santoso",
    "1234567890",
    "Telepon antara 13-15"
  ]);

  // Scenario 4: ATM Card Stuck
  console.log('\n=== 🏧 SCENARIO 4: KARTU TERTELAN ATM ===');
  await simulateChat([
    "Kartu debit saya tertelan di ATM BCA",
    "Linda Sari",
    "Kemarin malam di ATM BCA Sudirman, rekening 9876543210123",
    "Telepon pagi",
    "08:00-12:00"
  ]);
}

async function simulateChat(messages) {
  let sessionId = null;
  
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    console.log(`👤 User: ${message}`);
    
    try {
      const response = await fetch('http://localhost:5000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message,
          session_id: sessionId
        })
      });
      
      const data = await response.json();
      sessionId = data.session_id;
      
      console.log(`🤖 Bot: ${data.message}`);
      
      // Show progress
      if (data.collected_info) {
        const info = data.collected_info;
        const progress = [];
        if (info.full_name) progress.push('✅ Nama');
        if (info.category) progress.push('✅ Kategori');  
        if (info.description) progress.push('✅ Keluhan');
        if (info.account_number) progress.push('✅ Rekening');
        if (info.preferred_contact) progress.push('✅ Kontak');
        if (info.standby_call_window) progress.push('✅ Waktu');
        
        console.log(`📊 Progress: ${progress.join(', ')} | Confidence: ${Math.round(data.confidence * 100)}%`);
      }
      
      if (data.is_complete) {
        console.log('✅ KELUHAN BERHASIL TERCATAT LENGKAP!');
        console.log('📋 Summary:', JSON.stringify(data.collected_info, null, 2));
      }
      
      console.log('---');
      
      // Small delay untuk readability
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
  }
  
  console.log('\n');
}

// Jalankan demo
demoConversations().catch(console.error);
