# 🚀 BNI Customer Care Chatbot - Postman Testing Guide

## 📁 Files yang Sudah Dibuat

1. **`postman-collection.json`** - Koleksi lengkap semua endpoint
2. **`postman-environment.json`** - Environment variables
3. **`postman-testing-guide.md`** - Panduan ini

## 🔧 Cara Import ke Postman

### 1. Import Collection
1. Buka Postman
2. Klik **Import** (di kiri atas)
3. Pilih **Upload Files**
4. Select file `postman-collection.json`
5. Klik **Import**

### 2. Import Environment
1. Klik gear icon ⚙️ (di kanan atas)
2. Pilih **Import**
3. Select file `postman-environment.json`
4. Klik **Import**
5. Pilih environment "Chatbot Environment"

## 🎯 Testing Scenarios untuk Frontend Integration

### 🚀 Scenario 1: Basic Chatbot Flow
```
1. Health Check → GET /healthz
2. Start Chat → POST /chat (tanpa session_id)
3. Follow-up → POST /chat (dengan session_id dari step 2)
4. Get Session Info → GET /chat/{session_id}
```

### 💬 Scenario 2: Complete Customer Journey
```
POST /chat
Body:
{
  "message": "Saya mau komplain kartu kredit, nama John Doe, rekening 1234567890"
}

Expected Response:
{
  "success": true,
  "message": "...",
  "session_id": "uuid",
  "collected_info": {...},
  "next_step": "...",
  "confidence": 0.85
}
```

### 🔍 Scenario 3: Knowledge Base Testing
```
1. FAQ Search → GET /faq?q=saldo minimum
2. SLA Search → GET /sla?q=kartu kredit&category=complaint
```

## 📝 Frontend Integration Examples

### JavaScript Fetch Example:
```javascript
// Start new chat
async function sendChatMessage(message, sessionId = null) {
  try {
    const response = await fetch('http://localhost:3000/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: message,
        session_id: sessionId
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      // Handle successful response
      console.log('Bot response:', data.message);
      console.log('Session ID:', data.session_id);
      return data;
    } else {
      console.error('Chat error:', data.error);
    }
  } catch (error) {
    console.error('Network error:', error);
  }
}

// Usage
const result = await sendChatMessage("Halo, saya butuh bantuan");
```

### React Hook Example:
```javascript
import { useState, useCallback } from 'react';

export const useChatbot = () => {
  const [sessionId, setSessionId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const sendMessage = useCallback(async (message) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          session_id: sessionId
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        if (!sessionId && data.session_id) {
          setSessionId(data.session_id);
        }
        return data;
      } else {
        throw new Error(data.error || 'Chat error');
      }
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  return { sendMessage, sessionId, loading, error };
};
```

## 🧪 Testing Checklist

### ✅ Basic Functionality
- [ ] Health check responds with 200
- [ ] Chat endpoint accepts POST requests
- [ ] Session ID is generated and returned
- [ ] Follow-up messages use same session
- [ ] Error handling for empty/invalid messages

### ✅ Data Validation
- [ ] Customer name extraction works
- [ ] Account number validation
- [ ] Channel detection (mobile_banking, atm, etc.)
- [ ] Category classification (complaint, inquiry, etc.)
- [ ] Time window parsing

### ✅ Error Handling
- [ ] 400 for missing message
- [ ] 404 for invalid session ID
- [ ] 500 for server errors
- [ ] Proper error messages returned

### ✅ Integration Points
- [ ] CORS headers allow frontend domain
- [ ] Response format consistent
- [ ] Session persistence works
- [ ] FAQ/SLA endpoints accessible

## 🔧 Environment Configuration

### Development (localhost:3000)
```json
{
  "base_url": "http://localhost:3000"
}
```

### Production
```json
{
  "base_url": "https://your-production-domain.com"
}
```

## 📊 Expected Response Formats

### Chat Response:
```json
{
  "success": true,
  "message": "Terima kasih informasinya. Saya akan membantu menangani keluhan Anda...",
  "session_id": "uuid-here",
  "collected_info": {
    "full_name": "John Doe",
    "account_number": "1234567890",
    "channel": "mobile_banking",
    "category": "complaint",
    "description": "Masalah kartu kredit"
  },
  "next_step": "contact_preference",
  "confidence": 0.85,
  "is_complete": false
}
```

### Error Response:
```json
{
  "error": "Message is required",
  "success": false
}
```

### FAQ Response:
```json
{
  "answer": "Saldo minimum untuk rekening...",
  "matched_keywords": ["saldo", "minimum"]
}
```

## 🚨 Common Issues & Solutions

### Issue: CORS Error
**Solution:** Pastikan server running dan CORS configured properly

### Issue: Session Not Found
**Solution:** Check session_id format dan pastikan valid UUID

### Issue: Empty Response
**Solution:** Check LM Studio connection di `/test-lm` endpoint

### Issue: Slow Response
**Solution:** Monitor network dan LM Studio performance

## 🔄 WebSocket Integration (Optional)
Jika mau real-time chat, gunakan Socket.IO:

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:3000');

// Register user
socket.emit('auth:register', { userId: 'user123' });

// Send chat message
socket.emit('chat:send', {
  room: 'room123',
  message: 'Hello',
  from: 'user123'
});

// Listen for responses
socket.on('chat:new', (data) => {
  console.log('New message:', data);
});
```

## 📞 Support

Jika ada masalah saat testing:
1. Check server logs
2. Verify endpoint di browser dulu
3. Test dengan curl/httpie
4. Check network connectivity

Happy Testing! 🎉
