/**
 * Simple demo script to show One-Shot Extraction feature usage
 * This script demonstrates the API calls without actually making HTTP requests
 */

console.log('🚀 ONE-SHOT EXTRACTION FEATURE DEMO\n');

// Example 1: Complete information extraction
console.log('📋 Example 1: Complete Information');
console.log('━'.repeat(50));

const completeMessage = "Saya mau komplain kartu kredit, nama saya Ahmad Rizki, nomor rekening 1234567890123456, masalahnya limit kartu kredit tidak sesuai";

console.log('📥 Input Message:');
console.log(`"${completeMessage}"\n`);

console.log('📤 Expected Output from /chat/extract:');
console.log(JSON.stringify({
  "valid": true,
  "message": "Informasi berhasil diekstrak",
  "confidence": 0.85,
  "extracted": {
    "full_name": "Ahmad Rizki",
    "account_number": "1234567890123456",
    "channel": null,
    "category": "Kartu Kredit",
    "description": "Masalahnya limit kartu kredit tidak sesuai",
    "priority": "Medium",
    "preferred_contact": null
  },
  "summary": {
    "nama": "Ahmad Rizki",
    "no_rekening": "1234567890123456",
    "channel": null,
    "kategori": "Kartu Kredit",
    "deskripsi": "Masalahnya limit kartu kredit tidak sesuai"
  },
  "extraction_method": "one_shot"
}, null, 2));

console.log('\n' + '━'.repeat(50));

// Example 2: Chat flow with auto-detection
console.log('\n📋 Example 2: Chat Flow with Auto-Detection');
console.log('━'.repeat(50));

const detailedMessage = "Selamat pagi, nama saya Siti Nurhaliza, nomor rekening 0020001234567890. Saya mengalami masalah saat melakukan transfer antar bank melalui mobile banking BNI. Setiap kali saya coba transfer ke bank lain, transaksi gagal dengan pesan error 'sistem sedang maintenance'. Sudah 3 hari ini masalahnya berlangsung.";

console.log('📥 First Chat Message:');
console.log(`"${detailedMessage}"\n`);

console.log('📤 Expected Chat Response (Auto-detected one-shot extraction):');
console.log(JSON.stringify({
  "session_id": "generated-uuid",
  "message": "🎯 Terima kasih! Saya telah memahami keluhan Anda. Berikut informasi yang berhasil saya catat:\n\n📋 RINGKASAN KELUHAN ANDA\n\n👤 Nama: Siti Nurhaliza\n💳 No. Rekening: 0020001234567890\n📱 Channel: Mobile Banking\n📂 Kategori: Transfer Antar Bank\n📝 Deskripsi: Masalah transfer antar bank melalui mobile banking...\n\n✅ Informasi sudah lengkap!\n\nApakah data di atas sudah benar?",
  "action": "ready_for_confirmation",
  "suggestions": ["Ya, data sudah benar", "Ada yang perlu diperbaiki"],
  "is_complete": false,
  "confidence": 0.92,
  "extraction_method": "one_shot"
}, null, 2));

console.log('\n' + '━'.repeat(50));

// Example 3: API Usage
console.log('\n📋 Example 3: API Usage');
console.log('━'.repeat(50));

console.log('🔹 For direct extraction:');
console.log(`
curl -X POST http://localhost:3000/chat/extract \\
  -H "Content-Type: application/json" \\
  -d '{
    "text": "${completeMessage}"
  }'
`);

console.log('🔹 For chat flow with auto-detection:');
console.log(`
curl -X POST http://localhost:3000/chat \\
  -H "Content-Type: application/json" \\
  -d '{
    "message": "${detailedMessage}"
  }'
`);

console.log('\n' + '━'.repeat(50));

// Feature highlights
console.log('\n✨ Feature Highlights:');
console.log('━'.repeat(50));

const features = [
  '🎯 Auto-detection of comprehensive messages',
  '🚀 One-shot information extraction using LM models',
  '📊 Intelligent confidence scoring',
  '💬 Smart fallback to normal conversation flow',
  '🎨 Visual indicators in the web interface',
  '📝 Flexible output formats (detailed + summary)',
  '🔄 Seamless integration with existing chat flow'
];

features.forEach(feature => console.log(`  ${feature}`));

console.log('\n📚 See ONE_SHOT_EXTRACTION_GUIDE.md for complete documentation');
console.log('🧪 Use test-one-shot-extraction.js for live testing (requires running server)');

console.log('\n🎉 Demo completed! Start your server and try the examples above.');
