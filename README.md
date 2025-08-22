# Bank Customer Service Chatbot

## 📋 Deskripsi
Chatbot customer service bank yang menggunakan AI untuk mengumpulkan informasi keluhan nasabah secara otomatis. Sistem ini mengintegrasikan LM Studio untuk pemrosesan bahasa alami dan menyediakan interface web yang responsif.

## ✨ Fitur Utama

### 🤖 Pemrosesan Chat Cerdas
- **Ekstraksi Otomatis**: Deteksi informasi lengkap dari pesan pertama user
- **Alur Percakapan Terstruktur**: Mengumpulkan channel, kategori, dan deskripsi keluhan
- **Koreksi Data**: User dapat memperbaiki informasi yang salah
- **Konfirmasi Data**: Verifikasi sebelum menyimpan keluhan

### 📱 Interface Modern
- **Real-time Chat**: Interface seperti aplikasi messaging
- **Responsive Design**: Mendukung desktop dan mobile
- **Status Monitoring**: Indikator koneksi dan kelengkapan data
- **Suggestion Buttons**: Tombol cepat untuk respon umum

### 🔧 Integrasi AI
- **LM Studio**: Untuk ekstraksi dan summarisasi deskripsi
- **Pattern Matching**: Identifikasi channel dan kategori
- **Semantic Autocorrect**: Koreksi otomatis input user
- **Confidence Scoring**: Skor kelengkapan informasi

## 🏗️ Arsitektur Sistem

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Frontend HTML  │◄──►│  Express Server │◄──►│   LM Studio     │
│   (chatbot.html)│    │   (server.js)   │    │  (lm-studio.js) │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └─────────────────────────────────────────────────┘
                          WebSocket/HTTP
```

## 📂 Struktur Direktori

```
chatbot/
├── 📁 public/                 # Frontend files
│   ├── chatbot.html          # Main chat interface
│   ├── index.html            # Landing page
│   └── socket-test.html      # WebSocket testing
├── 📁 src/                   # Backend source code
│   ├── 📁 config/
│   │   └── config.js         # Configuration settings
│   ├── 📁 routes/
│   │   └── routes.js         # Express routes
│   ├── 📁 services/
│   │   ├── chat-processor.js # Main chat logic
│   │   ├── chat-service.js   # Core chat functions
│   │   ├── faq-service.js    # FAQ handling
│   │   ├── lm-studio.js      # LM Studio integration
│   │   └── sla-service.js    # SLA management
│   └── 📁 utils/
│       ├── classification.js # Data classification
│       ├── network-config.js # Network settings
│       └── prompts.js        # AI prompts
├── 📁 data/                  # Data files
│   └── data_sheet_sla_extracted.csv
├── 📁 realtime/              # WebSocket implementation
│   └── socket.ts
├── 📁 server/                # Server configuration
│   ├── index.js              # Socket.IO server
│   └── package.json
├── channel_category.json     # Channel & category config
├── server.js                 # Main Express server
└── package.json             # Project dependencies
```

## 🚀 Instalasi dan Setup

### Prerequisites
- Node.js 16+ 
- npm atau yarn
- LM Studio (untuk AI processing)

### 1. Clone Repository
```bash
git clone <repository-url>
cd chatbot
```

### 2. Install Dependencies
```bash
# Install main dependencies
npm install

# Install server dependencies
cd server
npm install
cd ..
```

### 3. Konfigurasi LM Studio
```bash
# Pastikan LM Studio berjalan di localhost:1234
# Atau update URL di src/services/lm-studio.js
```

### 4. Jalankan Aplikasi
```bash
# Development mode
npm run dev

# Production mode
npm start
```

### 5. Akses Aplikasi
- Frontend: `http://localhost:3000/chatbot.html`
- API Health: `http://localhost:3000/healthz`

## 🔧 Konfigurasi

### Channel dan Kategori
Edit file `channel_category.json` untuk menambah opsi baru:

```json
{
  "channels": [
    "ATM", "IBANK", "MBANK", "CRM", 
    "MTUNAI ALFAMART", "DISPUTE DEBIT", "QRIS DEBIT"
  ],
  "categories": [
    "PEMBAYARAN", "TOP UP", "TRANSFER", "TARIK TUNAI",
    "SETOR TUNAI", "MOBILE TUNAI", "BI FAST", "DISPUTE", "LAINNYA"
  ]
}
```

### Environment Variables
```bash
# .env file
PORT=3000
LM_STUDIO_URL=http://localhost:1234
NODE_ENV=development
```

## 📡 API Endpoints

### Chat API
```
POST /chat
Content-Type: application/json

Request:
{
  "message": "string",
  "session_id": "string (optional)"
}

Response:
{
  "session_id": "string",
  "message": "string",
  "action": "string",
  "suggestions": ["string"],
  "collected_info": {
    "channel": "string",
    "category": "string", 
    "description": "string"
  },
  "is_complete": boolean,
  "confidence": number
}
```

### Health Check
```
GET /healthz

Response:
{
  "status": "ok",
  "timestamp": "string",
  "model": "string"
}
```

### Extract Information
```
POST /extract
Content-Type: application/json

Request:
{
  "text": "string"
}

Response:
{
  "channel": "string",
  "category": "string",
  "description": "string",
  "full_name": "string",
  "account_number": "string"
}
```

## 🔄 Alur Percakapan

### 1. Greeting
```
Bot: "Selamat pagi! Saya BNI Assistant..."
```

### 2. Channel Detection
```
Bot: "Channel atau platform yang Anda gunakan?"
User: "Mobile Banking"
```

### 3. Category Selection  
```
Bot: "Jenis keluhan yang sesuai?"
User: "Transfer"
```

### 4. Description Collection
```
Bot: "Jelaskan masalah yang Anda alami..."
User: "Transfer ke BCA gagal terus"
```

### 5. Confirmation
```
Bot: "📋 RINGKASAN KELUHAN
     🔗 Channel: Mobile Banking
     📂 Kategori: Transfer  
     📝 Deskripsi: Transfer ke BCA gagal..."
```

### 6. Correction Flow
```
User: "Ada yang perlu diperbaiki"
Bot: "Bagian mana yang perlu dikoreksi?"
User: "Channel salah"
Bot: "Channel mana yang benar?"
```

## 🧠 AI Processing

### LM Studio Integration
```javascript
// Ekstraksi informasi menggunakan LLM
const extracted = await extractJsonWithLM(message);

// Generate deskripsi summary
const summary = await generateDescriptionSummary(messages, collectedInfo);
```

### Pattern Matching
```javascript
// Deteksi channel sederhana
const channelPatterns = {
  'mobile banking': 'MBANK',
  'internet banking': 'IBANK',
  'atm': 'ATM'
};
```

### Confidence Scoring
```javascript
function computeConfidence(collectedInfo) {
  const requiredFields = ['channel', 'category', 'description'];
  const filledFields = requiredFields.filter(field => 
    collectedInfo[field] && collectedInfo[field].trim() !== ''
  );
  return filledFields.length / requiredFields.length;
}
```

## 🎨 Frontend Features

### Real-time Updates
```javascript
// Auto-scroll ke pesan terbaru
scrollToBottom() {
  this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
}

// Typing indicator
setTyping(isTyping) {
  this.typingIndicator.style.display = isTyping ? 'flex' : 'none';
}
```

### Suggestion Buttons
```javascript
// Generate tombol saran otomatis
suggestions.forEach(suggestion => {
  const btn = document.createElement('button');
  btn.onclick = () => {
    this.chatInput.value = suggestion;
    this.sendMessage();
  };
});
```

### Status Monitoring
- **Session ID**: Identifikasi unik percakapan
- **Confidence**: Persentase kelengkapan data
- **Health Status**: Status koneksi ke LM Studio

## 🔍 Debugging

### Logging
```javascript
console.log('🔍 Attempting one-shot extraction...');
console.log('✅ Extracted data:', extracted);
console.log('❌ One-shot extraction failed:', error);
```

### Error Handling
```javascript
try {
  // Chat processing logic
} catch (error) {
  console.error('Chat processing error:', error);
  return fallbackResponse;
}
```

## 🚀 Deployment

### Production Build
```bash
# Set environment
export NODE_ENV=production

# Start server
npm start
```

### Docker (Optional)
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

## 📊 Monitoring

### Health Checks
- `/healthz` endpoint untuk monitoring
- Status koneksi LM Studio
- Session management

### Performance Metrics
- Response time per message
- Extraction success rate
- User completion rate

## 🤝 Contributing

1. Fork repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Create Pull Request

## 📝 License

MIT License - lihat file LICENSE untuk detail lengkap.

## 📞 Support

Untuk pertanyaan atau dukungan, hubungi tim development.

---

**Terakhir diupdate**: Agustus 2025
**Versi**: 1.0.0
