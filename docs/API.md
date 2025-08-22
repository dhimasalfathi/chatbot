# API Documentation

## Overview
Bank Customer Service Chatbot API menyediakan endpoints untuk pemrosesan chat, ekstraksi informasi, dan monitoring sistem.

## Base URL
```
http://localhost:3000
```

## Authentication
Saat ini tidak ada autentikasi yang diperlukan untuk development.

---

## Endpoints

### 1. Chat Processing

#### POST `/chat`
Memproses pesan chat dan mengembalikan respons bot.

**Request Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "message": "string",           // Pesan dari user (required)
  "session_id": "string"         // ID sesi (optional, akan dibuat otomatis jika tidak ada)
}
```

**Response:**
```json
{
  "session_id": "uuid-string",   // ID sesi unik
  "message": "string",           // Respons dari bot
  "action": "string",            // Status aksi saat ini
  "next_question": "string",     // Pertanyaan selanjutnya (optional)
  "suggestions": ["string"],     // Array saran tombol
  "collected_info": {            // Informasi yang terkumpul
    "channel": "string",         // Channel/platform
    "category": "string",        // Kategori keluhan
    "description": "string",     // Deskripsi masalah
    "full_name": "string",       // Nama lengkap (optional)
    "account_number": "string"   // Nomor rekening (optional)
  },
  "is_complete": boolean,        // Status kelengkapan data
  "confidence": number,          // Skor kepercayaan (0-1)
  "needs_confirmation": boolean, // Butuh konfirmasi user
  "extraction_method": "string"  // Metode ekstraksi yang digunakan
}
```

**Action Values:**
- `greeting` - Menyapa user
- `asking_channel` - Menanyakan channel
- `asking_category` - Menanyakan kategori
- `asking_description` - Menanyakan deskripsi
- `ready_for_confirmation` - Siap konfirmasi
- `asking_correction` - Menanyakan koreksi
- `asking_missing_info` - Melengkapi info
- `completed` - Selesai
- `error` - Error

**Example Request:**
```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Halo, saya ada masalah dengan mobile banking",
    "session_id": "123e4567-e89b-12d3-a456-426614174000"
  }'
```

**Example Response:**
```json
{
  "session_id": "123e4567-e89b-12d3-a456-426614174000",
  "message": "Terima kasih sudah menghubungi B-Care. Channel mana yang mengalami masalah?",
  "action": "asking_channel",
  "suggestions": ["Mobile Banking", "Internet Banking", "ATM"],
  "collected_info": {
    "channel": null,
    "category": null,
    "description": null
  },
  "is_complete": false,
  "confidence": 0.0
}
```

---

### 2. Information Extraction

#### POST `/extract`
Mengekstrak informasi dari teks menggunakan AI.

**Request Body:**
```json
{
  "text": "string"  // Teks yang akan diekstrak (required)
}
```

**Response:**
```json
{
  "channel": "string",          // Channel yang terdeteksi
  "category": "string",         // Kategori yang terdeteksi
  "description": "string",      // Deskripsi yang diekstrak
  "full_name": "string",        // Nama lengkap
  "account_number": "string",   // Nomor rekening
  "confidence": number          // Skor kepercayaan
}
```

**Example Request:**
```bash
curl -X POST http://localhost:3000/extract \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Saya John Doe dengan rekening 1234567890, mengalami masalah transfer di mobile banking BNI ke rekening BCA yang selalu gagal"
  }'
```

**Example Response:**
```json
{
  "channel": "MBANK",
  "category": "TRANSFER",
  "description": "Transfer dari mobile banking BNI ke rekening BCA yang selalu gagal",
  "full_name": "John Doe",
  "account_number": "1234567890",
  "confidence": 0.9
}
```

---

### 3. Health Check

#### GET `/healthz`
Memeriksa status kesehatan sistem dan koneksi ke LM Studio.

**Response:**
```json
{
  "status": "ok",               // Status sistem
  "timestamp": "string",        // Waktu check
  "uptime": number,            // Uptime dalam detik
  "model": "string",           // Model LM Studio yang aktif
  "memory_usage": {            // Penggunaan memori
    "rss": number,
    "heapTotal": number,
    "heapUsed": number
  },
  "active_sessions": number    // Jumlah sesi aktif
}
```

**Example Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-08-22T10:30:00.000Z",
  "uptime": 3600,
  "model": "llama-3.1-8b-instruct",
  "memory_usage": {
    "rss": 123456789,
    "heapTotal": 67108864,
    "heapUsed": 45088768
  },
  "active_sessions": 5
}
```

---

### 4. Session Management

#### GET `/sessions`
Mendapatkan daftar sesi aktif (development only).

**Response:**
```json
{
  "total_sessions": number,
  "sessions": [
    {
      "session_id": "string",
      "created_at": "string",
      "last_activity": "string",
      "message_count": number,
      "is_complete": boolean,
      "collected_info": {}
    }
  ]
}
```

#### DELETE `/sessions/{session_id}`
Menghapus sesi tertentu.

**Response:**
```json
{
  "success": true,
  "message": "Session deleted successfully"
}
```

---

## Error Responses

Semua error menggunakan format standar:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": "Additional error details"
  },
  "timestamp": "2025-08-22T10:30:00.000Z"
}
```

### Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `INVALID_REQUEST` | 400 | Request body tidak valid |
| `SESSION_NOT_FOUND` | 404 | Session ID tidak ditemukan |
| `LM_STUDIO_ERROR` | 502 | Error koneksi ke LM Studio |
| `EXTRACTION_FAILED` | 500 | Gagal mengekstrak informasi |
| `INTERNAL_ERROR` | 500 | Error internal server |

---

## Rate Limiting

- **Chat endpoint**: 60 requests per minute per IP
- **Extract endpoint**: 30 requests per minute per IP
- **Health endpoint**: 120 requests per minute per IP

---

## WebSocket API (Optional)

### Connection
```javascript
const socket = io('http://localhost:3000');
```

### Events

#### Client to Server
```javascript
// Send chat message
socket.emit('chat_message', {
  message: 'Hello',
  session_id: 'uuid'
});

// Join session room
socket.emit('join_session', {
  session_id: 'uuid'
});
```

#### Server to Client
```javascript
// Receive bot response
socket.on('bot_response', (data) => {
  console.log(data);
});

// Typing indicator
socket.on('bot_typing', (isTyping) => {
  console.log('Bot is typing:', isTyping);
});

// Session status update
socket.on('session_update', (sessionData) => {
  console.log('Session updated:', sessionData);
});
```

---

## SDK Examples

### JavaScript/Node.js
```javascript
const ChatbotAPI = require('./chatbot-sdk');

const client = new ChatbotAPI('http://localhost:3000');

// Send message
const response = await client.sendMessage('Hello', sessionId);
console.log(response.message);

// Extract information
const extracted = await client.extractInfo('User complaint text...');
console.log(extracted);
```

### Python
```python
import requests

class ChatbotAPI:
    def __init__(self, base_url):
        self.base_url = base_url
    
    def send_message(self, message, session_id=None):
        response = requests.post(
            f"{self.base_url}/chat",
            json={"message": message, "session_id": session_id}
        )
        return response.json()
    
    def extract_info(self, text):
        response = requests.post(
            f"{self.base_url}/extract",
            json={"text": text}
        )
        return response.json()

# Usage
client = ChatbotAPI("http://localhost:3000")
result = client.send_message("Hello")
```

---

## Testing

### Unit Tests
```bash
npm test
```

### API Tests
```bash
npm run test:api
```

### Load Testing
```bash
# Install k6
npm install -g k6

# Run load test
k6 run tests/load-test.js
```

---

## Monitoring

### Metrics Endpoint
```
GET /metrics
```

Returns Prometheus-compatible metrics:
```
# HELP chatbot_requests_total Total number of requests
# TYPE chatbot_requests_total counter
chatbot_requests_total{endpoint="/chat"} 1234

# HELP chatbot_response_duration_seconds Response duration
# TYPE chatbot_response_duration_seconds histogram
chatbot_response_duration_seconds_bucket{le="0.1"} 100
```

---

## Changelog

### v1.0.0 (2025-08-22)
- ✅ Initial release
- ✅ Chat processing API
- ✅ Information extraction
- ✅ Health monitoring
- ✅ Session management
