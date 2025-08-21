// 🚀 BNI Customer Care Chatbot - Frontend Integration Examples

/**
 * 1. Basic Chatbot Service Class
 */
class ChatbotService {
  constructor(baseURL = 'http://localhost:3000') {
    this.baseURL = baseURL;
    this.sessionId = null;
  }

  async sendMessage(message) {
    try {
      const response = await fetch(`${this.baseURL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message.trim(),
          session_id: this.sessionId
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Save session ID from first response
      if (!this.sessionId && data.session_id) {
        this.sessionId = data.session_id;
      }

      return data;
    } catch (error) {
      console.error('Chatbot service error:', error);
      throw error;
    }
  }

  async getSessionInfo() {
    if (!this.sessionId) {
      throw new Error('No active session');
    }

    try {
      const response = await fetch(`${this.baseURL}/chat/${this.sessionId}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Session info error:', error);
      throw error;
    }
  }

  async searchFAQ(query) {
    try {
      const response = await fetch(`${this.baseURL}/faq?q=${encodeURIComponent(query)}`);
      return await response.json();
    } catch (error) {
      console.error('FAQ search error:', error);
      throw error;
    }
  }

  async searchSLA(query, category = null, limit = 5) {
    try {
      let url = `${this.baseURL}/sla?q=${encodeURIComponent(query)}&limit=${limit}`;
      if (category) {
        url += `&category=${encodeURIComponent(category)}`;
      }
      
      const response = await fetch(url);
      return await response.json();
    } catch (error) {
      console.error('SLA search error:', error);
      throw error;
    }
  }

  resetSession() {
    this.sessionId = null;
  }
}

/**
 * 2. React Hook for Chatbot
 */
const useChatbot = (baseURL = 'http://localhost:3000') => {
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const sendMessage = useCallback(async (userMessage) => {
    setLoading(true);
    setError(null);

    // Add user message to chat
    const userMsg = {
      id: Date.now(),
      type: 'user',
      content: userMessage,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMsg]);

    try {
      const response = await fetch(`${baseURL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          session_id: sessionId
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      // Update session ID
      if (!sessionId && data.session_id) {
        setSessionId(data.session_id);
      }

      // Add bot response to chat
      const botMsg = {
        id: Date.now() + 1,
        type: 'bot',
        content: data.message,
        timestamp: new Date(),
        data: data
      };
      setMessages(prev => [...prev, botMsg]);

      return data;
    } catch (err) {
      setError(err.message);
      
      // Add error message to chat
      const errorMsg = {
        id: Date.now() + 1,
        type: 'error',
        content: 'Maaf, terjadi kesalahan. Silakan coba lagi.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMsg]);
      
      throw err;
    } finally {
      setLoading(false);
    }
  }, [baseURL, sessionId]);

  const clearChat = useCallback(() => {
    setMessages([]);
    setSessionId(null);
    setError(null);
  }, []);

  return {
    messages,
    sendMessage,
    clearChat,
    loading,
    error,
    sessionId
  };
};

/**
 * 3. Vue.js Composition API
 */
const useChatbotVue = (baseURL = 'http://localhost:3000') => {
  const sessionId = ref(null);
  const messages = ref([]);
  const loading = ref(false);
  const error = ref(null);

  const sendMessage = async (userMessage) => {
    loading.value = true;
    error.value = null;

    // Add user message
    messages.value.push({
      id: Date.now(),
      type: 'user',
      content: userMessage,
      timestamp: new Date()
    });

    try {
      const response = await fetch(`${baseURL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          session_id: sessionId.value
        })
      });

      const data = await response.json();

      if (!sessionId.value && data.session_id) {
        sessionId.value = data.session_id;
      }

      // Add bot response
      messages.value.push({
        id: Date.now() + 1,
        type: 'bot',
        content: data.message,
        timestamp: new Date(),
        data: data
      });

      return data;
    } catch (err) {
      error.value = err.message;
      throw err;
    } finally {
      loading.value = false;
    }
  };

  return {
    sessionId: readonly(sessionId),
    messages: readonly(messages),
    loading: readonly(loading),
    error: readonly(error),
    sendMessage
  };
};

/**
 * 4. Simple HTML + JavaScript Example
 */
function initSimpleChatbot() {
  const chatbot = new ChatbotService();
  const messagesContainer = document.getElementById('messages');
  const inputField = document.getElementById('messageInput');
  const sendButton = document.getElementById('sendButton');

  function addMessage(content, type) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.innerHTML = `
      <div class="message-content">${content}</div>
      <div class="message-time">${new Date().toLocaleTimeString()}</div>
    `;
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  async function sendMessage() {
    const message = inputField.value.trim();
    if (!message) return;

    addMessage(message, 'user');
    inputField.value = '';
    sendButton.disabled = true;

    try {
      const response = await chatbot.sendMessage(message);
      addMessage(response.message, 'bot');
    } catch (error) {
      addMessage('Maaf, terjadi kesalahan. Silakan coba lagi.', 'error');
    } finally {
      sendButton.disabled = false;
    }
  }

  sendButton.addEventListener('click', sendMessage);
  inputField.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
  });
}

/**
 * 5. Testing Helper Functions
 */
const testChatbotEndpoints = async () => {
  const chatbot = new ChatbotService();
  
  console.log('🧪 Testing Chatbot Endpoints...');
  
  try {
    // Test health check
    const health = await fetch('http://localhost:3000/healthz');
    console.log('✅ Health check:', await health.json());
    
    // Test chat
    const chatResponse = await chatbot.sendMessage('Halo, saya butuh bantuan');
    console.log('✅ Chat response:', chatResponse);
    
    // Test session info
    const sessionInfo = await chatbot.getSessionInfo();
    console.log('✅ Session info:', sessionInfo);
    
    // Test FAQ
    const faq = await chatbot.searchFAQ('saldo minimum');
    console.log('✅ FAQ search:', faq);
    
    // Test SLA
    const sla = await chatbot.searchSLA('kartu kredit', 'complaint');
    console.log('✅ SLA search:', sla);
    
    console.log('🎉 All tests passed!');
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
};

/**
 * 6. Error Handling Utilities
 */
const handleChatbotError = (error) => {
  if (error.message.includes('400')) {
    return 'Pesan tidak boleh kosong. Silakan masukkan pertanyaan Anda.';
  } else if (error.message.includes('404')) {
    return 'Sesi chat tidak ditemukan. Silakan mulai percakapan baru.';
  } else if (error.message.includes('500')) {
    return 'Terjadi kesalahan server. Silakan coba lagi dalam beberapa saat.';
  } else if (error.message.includes('Failed to fetch')) {
    return 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.';
  } else {
    return 'Terjadi kesalahan yang tidak diketahui. Silakan coba lagi.';
  }
};

/**
 * 7. WebSocket Integration (Optional)
 */
class ChatbotWebSocket {
  constructor(baseURL = 'http://localhost:3000') {
    this.baseURL = baseURL;
    this.socket = null;
    this.userId = null;
    this.currentRoom = null;
  }

  connect(userId) {
    this.socket = io(this.baseURL);
    this.userId = userId;

    this.socket.on('connect', () => {
      console.log('🔌 Connected to chatbot socket');
      this.socket.emit('auth:register', { userId });
    });

    this.socket.on('auth:ok', (data) => {
      console.log('✅ Authenticated:', data);
    });

    this.socket.on('chat:new', (message) => {
      console.log('💬 New message:', message);
      // Handle incoming message
    });

    return this.socket;
  }

  sendMessage(message, room) {
    if (!this.socket) throw new Error('Socket not connected');
    
    this.socket.emit('chat:send', {
      room,
      message,
      from: this.userId,
      timestamp: new Date().toISOString()
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ChatbotService,
    useChatbot,
    testChatbotEndpoints,
    handleChatbotError,
    ChatbotWebSocket
  };
}
