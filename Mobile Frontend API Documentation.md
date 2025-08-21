# 📱 Mobile Frontend API Documentation
## Bank Customer Service Chatbot Integration

### 🌟 Overview
Dokumentasi ini menjelaskan cara mengintegrasikan chatbot API dengan aplikasi mobile (React Native, Flutter, atau native apps). API endpoints sama dengan yang digunakan di `chatbot.html`.

---

## 🔗 Base Configuration

### Environment Detection
```javascript
// Auto-detect base URL (sama seperti chatbot.html)
const detectBaseUrl = () => {
  if (__DEV__ || process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000'; // Local development
  } else {
    return 'https://your-production-domain.com'; // Production
  }
};

const BASE_URL = detectBaseUrl();
```

### Headers Configuration
```javascript
const defaultHeaders = {
  'Content-Type': 'application/json',
  'Accept': 'application/json'
};
```

---

## 🔌 Core API Endpoints

### 1. Health Check
**Endpoint:** `GET /healthz`  
**Purpose:** Cek status server dan konektivitas AI model

```javascript
const checkHealth = async () => {
  try {
    const response = await fetch(`${BASE_URL}/healthz`);
    const data = await response.json();
    return {
      success: true,
      status: data.status,
      model: data.model,
      isHealthy: response.ok
    };
  } catch (error) {
    return {
      success: false,
      isHealthy: false,
      error: error.message
    };
  }
};
```

**Response:**
```json
{
  "status": "ok",
  "model": "lmstudio-community/Meta-Llama-3.1-8B-Instruct-GGUF",
  "time": "2025-08-21T10:30:00.000Z"
}
```

### 2. Chat Conversation (Main Endpoint)
**Endpoint:** `POST /chat`  
**Purpose:** Kirim pesan dan terima response dari chatbot

```javascript
const sendMessage = async (message, sessionId = null) => {
  try {
    const response = await fetch(`${BASE_URL}/chat`, {
      method: 'POST',
      headers: defaultHeaders,
      body: JSON.stringify({
        message: message,
        session_id: sessionId
      })
    });
    
    const data = await response.json();
    return {
      success: true,
      data: data
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};
```

**Request Body:**
```json
{
  "message": "Halo, saya mau komplain kartu kredit",
  "session_id": "optional-uuid-string"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Terima kasih telah menghubungi customer service BNI. Saya akan membantu Anda dengan komplain kartu kredit. Untuk memproses komplain Anda, bisa tolong berikan nama lengkap Anda?",
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "collected_info": {
    "full_name": null,
    "account_number": null,
    "channel": "mobile_banking",
    "category": "complaint",
    "description": "kartu kredit"
  },
  "next_step": "asking_name",
  "action": "asking_name",
  "confidence": 0.45,
  "is_complete": false,
  "suggestions": [
    "John Doe",
    "Jane Smith",
    "Ahmad Rizki"
  ]
}
```

### 3. Get Session Info
**Endpoint:** `GET /chat/{session_id}`  
**Purpose:** Ambil informasi detail session tertentu

```javascript
const getSessionInfo = async (sessionId) => {
  try {
    const response = await fetch(`${BASE_URL}/chat/${sessionId}`);
    const data = await response.json();
    return {
      success: true,
      data: data
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};
```

### 4. FAQ Search
**Endpoint:** `GET /faq?q={keyword}`  
**Purpose:** Cari FAQ berdasarkan keyword

```javascript
const searchFAQ = async (keyword) => {
  try {
    const response = await fetch(`${BASE_URL}/faq?q=${encodeURIComponent(keyword)}`);
    const data = await response.json();
    return {
      success: true,
      data: data
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};
```

### 5. SLA Search
**Endpoint:** `GET /sla?q={keyword}&category={category}&limit={limit}`  
**Purpose:** Cari data SLA berdasarkan keyword dan kategori

```javascript
const searchSLA = async (keyword, category = '', limit = 5) => {
  try {
    const params = new URLSearchParams({
      q: keyword,
      ...(category && { category }),
      limit: limit.toString()
    });
    
    const response = await fetch(`${BASE_URL}/sla?${params}`);
    const data = await response.json();
    return {
      success: true,
      data: data
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};
```

---

## 📱 Mobile Implementation Examples

### React Native Implementation
```javascript
// ChatbotService.js
import AsyncStorage from '@react-native-async-storage/async-storage';

class ChatbotService {
  constructor() {
    this.baseUrl = __DEV__ ? 'http://10.0.2.2:3000' : 'https://your-app.com';
    this.sessionId = null;
  }

  async initSession() {
    try {
      const savedSessionId = await AsyncStorage.getItem('chatbot_session_id');
      if (savedSessionId) {
        this.sessionId = savedSessionId;
      }
    } catch (error) {
      console.log('Error loading session:', error);
    }
  }

  async saveSession(sessionId) {
    try {
      this.sessionId = sessionId;
      await AsyncStorage.setItem('chatbot_session_id', sessionId);
    } catch (error) {
      console.log('Error saving session:', error);
    }
  }

  async sendMessage(message) {
    try {
      const response = await fetch(`${this.baseUrl}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message,
          session_id: this.sessionId
        })
      });

      const data = await response.json();
      
      if (data.session_id && data.session_id !== this.sessionId) {
        await this.saveSession(data.session_id);
      }

      return {
        success: true,
        data: data
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export default ChatbotService;
```

### React Native Hook
```javascript
// useChatbot.js
import { useState, useEffect } from 'react';
import ChatbotService from './ChatbotService';

export const useChatbot = () => {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [confidence, setConfidence] = useState(0);
  const [collectedInfo, setCollectedInfo] = useState({});
  const [chatbotService] = useState(() => new ChatbotService());

  useEffect(() => {
    chatbotService.initSession();
    startConversation();
  }, []);

  const startConversation = async () => {
    await sendMessage('Halo', true);
  };

  const sendMessage = async (text, isInitial = false) => {
    if (!isInitial) {
      addMessage('user', text);
    }
    
    setIsLoading(true);
    
    const result = await chatbotService.sendMessage(text);
    
    if (result.success) {
      const { data } = result;
      addMessage('bot', data.message, data.suggestions);
      
      if (data.session_id) {
        setSessionId(data.session_id);
      }
      
      if (data.confidence !== undefined) {
        setConfidence(data.confidence);
      }
      
      if (data.collected_info) {
        setCollectedInfo(data.collected_info);
      }
    } else {
      addMessage('bot', 'Maaf, terjadi kesalahan. Silakan coba lagi.');
    }
    
    setIsLoading(false);
  };

  const addMessage = (type, content, suggestions = []) => {
    const newMessage = {
      id: Date.now().toString(),
      type,
      content,
      suggestions,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, newMessage]);
  };

  return {
    messages,
    isLoading,
    sessionId,
    confidence,
    collectedInfo,
    sendMessage,
    addMessage
  };
};
```

### Flutter Implementation
```dart
// chatbot_service.dart
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class ChatbotService {
  static const String baseUrl = 'https://your-app.com'; // Change for production
  String? sessionId;

  Future<void> initSession() async {
    final prefs = await SharedPreferences.getInstance();
    sessionId = prefs.getString('chatbot_session_id');
  }

  Future<void> saveSession(String sessionId) async {
    final prefs = await SharedPreferences.getInstance();
    this.sessionId = sessionId;
    await prefs.setString('chatbot_session_id', sessionId);
  }

  Future<Map<String, dynamic>> sendMessage(String message) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/chat'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'message': message,
          'session_id': sessionId,
        }),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        
        if (data['session_id'] != null && data['session_id'] != sessionId) {
          await saveSession(data['session_id']);
        }

        return {'success': true, 'data': data};
      } else {
        return {'success': false, 'error': 'HTTP ${response.statusCode}'};
      }
    } catch (e) {
      return {'success': false, 'error': e.toString()};
    }
  }

  Future<Map<String, dynamic>> checkHealth() async {
    try {
      final response = await http.get(Uri.parse('$baseUrl/healthz'));
      if (response.statusCode == 200) {
        return {'success': true, 'data': jsonDecode(response.body)};
      } else {
        return {'success': false, 'error': 'HTTP ${response.statusCode}'};
      }
    } catch (e) {
      return {'success': false, 'error': e.toString()};
    }
  }
}
```

---

## 🔄 Conversation Flow

### 1. Initialize Conversation
```javascript
// Step 1: Check health
const health = await checkHealth();
if (!health.isHealthy) {
  // Show error message
  return;
}

// Step 2: Start conversation
const response = await sendMessage('Halo');
// Bot responds with greeting and asks for information
```

### 2. Information Collection Flow
```javascript
const conversationFlow = {
  'greeting': () => {
    // Bot greets and identifies issue category
    // Usually asks for name next
  },
  
  'asking_name': () => {
    // User provides name
    // Bot asks for account number
  },
  
  'asking_account': () => {
    // User provides account number
    // Bot asks for channel (mobile banking, internet banking, etc.)
  },
  
  'asking_channel': () => {
    // User provides channel
    // Bot asks for category (complaint, inquiry, etc.)
  },
  
  'asking_category': () => {
    // User provides category
    // Bot asks for detailed description
  },
  
  'asking_description': () => {
    // User provides description
    // Bot shows collected information for confirmation
  },
  
  'ready_for_confirmation': () => {
    // Bot shows all collected info
    // Asks user to confirm or correct
  },
  
  'asking_correction': () => {
    // User corrects specific information
    // Bot updates and asks for confirmation again
  },
  
  'completed': () => {
    // All information collected and confirmed
    // Bot provides next steps or resolution
  }
};
```

### 3. Response Data Structure
```javascript
// Every chat response contains:
{
  "success": true,
  "message": "Bot response text",
  "session_id": "unique-session-id", 
  "collected_info": {
    "full_name": "John Doe",
    "account_number": "1234567890", 
    "channel": "mobile_banking",
    "category": "complaint",
    "description": "Kartu kredit tidak bisa digunakan"
  },
  "next_step": "asking_description", // What bot expects next
  "action": "asking_description",    // Current action/state
  "confidence": 0.75,               // How complete the info is (0-1)
  "is_complete": false,             // Whether all info is collected
  "suggestions": [                  // Quick reply suggestions
    "Kartu ATM",
    "Kartu Kredit", 
    "Transfer Online"
  ]
}
```

---

## 📊 State Management

### Session Management
```javascript
class ChatSessionManager {
  constructor() {
    this.sessionId = null;
    this.collectedInfo = {};
    this.confidence = 0;
    this.currentStep = 'greeting';
  }

  updateSession(responseData) {
    this.sessionId = responseData.session_id;
    this.collectedInfo = responseData.collected_info || {};
    this.confidence = responseData.confidence || 0;
    this.currentStep = responseData.next_step || responseData.action;
  }

  getProgress() {
    const requiredFields = ['full_name', 'account_number', 'channel', 'category', 'description'];
    const filledFields = requiredFields.filter(field => 
      this.collectedInfo[field] && this.collectedInfo[field] !== null
    );
    return filledFields.length / requiredFields.length;
  }

  isComplete() {
    return this.confidence >= 0.9 && this.currentStep === 'completed';
  }
}
```

---

## 🎨 UI Components

### Message Types
```javascript
const MessageTypes = {
  USER: 'user',
  BOT: 'bot',
  SYSTEM: 'system',
  INFO_PANEL: 'info_panel'
};

// Message structure for UI
const createMessage = (type, content, extras = {}) => ({
  id: generateUniqueId(),
  type: type,
  content: content,
  timestamp: new Date(),
  suggestions: extras.suggestions || [],
  collectedInfo: extras.collectedInfo || null,
  confidence: extras.confidence || null
});
```

### Suggestion Buttons
```javascript
// Quick replies from bot response
const renderSuggestions = (suggestions, onSuggestionTap) => {
  return suggestions.map((suggestion, index) => (
    <TouchableOpacity 
      key={index}
      onPress={() => onSuggestionTap(suggestion)}
      style={styles.suggestionButton}
    >
      <Text style={styles.suggestionText}>{suggestion}</Text>
    </TouchableOpacity>
  ));
};
```

### Info Panel
```javascript
// Show collected information progress
const InfoPanel = ({ collectedInfo, confidence }) => (
  <View style={styles.infoPanel}>
    <Text style={styles.infoPanelTitle}>Form Complain</Text>
    <InfoItem label="Nama" value={collectedInfo.full_name} />
    <InfoItem label="No Rekening" value={collectedInfo.account_number} />
    <InfoItem label="Channel" value={collectedInfo.channel} />
    <InfoItem label="Kategori" value={collectedInfo.category} />
    <InfoItem label="Deskripsi" value={collectedInfo.description} />
    <InfoItem label="Kelengkapan" value={`${Math.round(confidence * 100)}%`} />
  </View>
);
```

---

## 🔧 Error Handling

### Network Errors
```javascript
const handleNetworkError = (error) => {
  if (error.message.includes('Network request failed')) {
    return 'Tidak ada koneksi internet. Silakan periksa koneksi Anda.';
  } else if (error.message.includes('timeout')) {
    return 'Koneksi timeout. Silakan coba lagi.';
  } else {
    return 'Terjadi kesalahan. Silakan coba lagi.';
  }
};
```

### API Error Responses
```javascript
const handleApiError = (response) => {
  switch (response.status) {
    case 400:
      return 'Permintaan tidak valid. Silakan periksa input Anda.';
    case 500:
      return 'Terjadi kesalahan server. Silakan coba lagi nanti.';
    case 503:
      return 'Layanan sedang maintenance. Silakan coba lagi nanti.';
    default:
      return 'Terjadi kesalahan. Silakan coba lagi.';
  }
};
```

---

## 🚀 Production Deployment

### Environment Configuration
```javascript
const Config = {
  development: {
    baseUrl: 'http://localhost:3000',
    timeout: 10000,
    debug: true
  },
  production: {
    baseUrl: 'https://your-production-domain.com',
    timeout: 15000,
    debug: false
  }
};

const getConfig = () => {
  return __DEV__ ? Config.development : Config.production;
};
```

### Performance Optimization
```javascript
// Debounce typing for better UX
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};
```

---

## 📋 Testing Checklist

### Mobile Testing Scenarios
- [ ] Health check on app start
- [ ] Initial greeting conversation
- [ ] Complete information collection flow
- [ ] Suggestion button interactions  
- [ ] Session persistence across app restarts
- [ ] Network error handling
- [ ] Offline state management
- [ ] Background/foreground state handling
- [ ] Deep linking to chat screen
- [ ] Push notifications integration

### API Testing
- [ ] All endpoints respond correctly
- [ ] Session management works properly
- [ ] Error responses are handled
- [ ] Timeout scenarios
- [ ] Large message handling
- [ ] Special character support
- [ ] Multiple concurrent sessions

---

## 📖 Additional Resources

### Documentation Links
- [Main API Collection](postman-collection.json)
- [Frontend Integration Examples](frontend-integration-examples.js)
- [Testing Guide](postman-testing-guide.md)

### Support
Jika ada pertanyaan atau masalah dengan implementasi mobile, silakan check:
1. Server logs untuk error debugging
2. Health endpoint untuk status service
3. Session endpoint untuk debugging conversation state

Dokumentasi ini mencakup semua yang diperlukan untuk mengintegrasikan chatbot API dengan aplikasi mobile Anda! 🚀