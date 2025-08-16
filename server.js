const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const { parse: csvParse } = require('csv-parse/sync');
const { getLocalIP, getNetworkConfig } = require('./network-config');
const { 
  KEYS, 
  PRIO_HIGH, 
  matchAny, 
  inferCategorySubcategory, 
  inferPriority, 
  normalizeTimeWindow, 
  semanticAutocorrect 
} = require('./classification');
const {
  EXTRACTION_SYSTEM,
  EXTRACTION_USER_TMPL,
  CHAT_SYSTEM_PROMPT,
  getTimeBasedGreeting,
  getFallbackResponse
} = require('./prompts');

// -----------------------------
// Config
// -----------------------------
const PORT = process.env.PORT || 4000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// LM Studio configuration - simple environment variable or default
const LM_BASE_URL = process.env.LM_BASE_URL || 'http://localhost:1234/v1';
const LM_API_KEY  = process.env.LM_API_KEY  || 'lm-studio';
const LM_MODEL    = process.env.LM_MODEL    || 'qwen2.5-7b-instruct-1m';
const LM_TEMPERATURE = parseFloat(process.env.LM_TEMPERATURE) || 0.8;

console.log(`🔧 Environment: ${NODE_ENV}`);
console.log(`🌐 Port: ${PORT}`);
console.log(`🤖 LM Studio: ${LM_BASE_URL}`);
console.log(`🌡️ Temperature: ${LM_TEMPERATURE}`);

// -----------------------------
// Load SLA knowledge base from CSV
// -----------------------------
let SLA_DATA = [];

function loadSLAData() {
  try {
    const csvPath = require('path').join(__dirname, 'data_sheet_sla_extracted.csv');
    if (!fs.existsSync(csvPath)) {
      console.warn(`ℹ️ SLA CSV not found at ${csvPath} - skipping`);
      return;
    }
    
    const raw = fs.readFileSync(csvPath, 'utf8');
    const records = csvParse(raw, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });
    
    // Normalize and clean data
    SLA_DATA = records.map(r => ({
      no: r.No || r.NO || r.no || null,
      service: (r.Service || '').trim(),
      channel: (r.Channel || '').trim(),
      category: (r.Category || '').trim(),
      sla: (r.SLA || '').toString().trim(),
      uic: (r.UIC || '').replace(/\s+$/,'').trim(),
      keterangan: (r.Keterangan || '').replace(/\s+/g,' ').trim()
    }));
    
    console.log(`📚 Loaded ${SLA_DATA.length} SLA entries from CSV`);
    console.log(`📊 Sample entry:`, SLA_DATA[0] ? {
      service: SLA_DATA[0].service,
      channel: SLA_DATA[0].channel,
      sla: SLA_DATA[0].sla + ' hari'
    } : 'No data');
  } catch (e) {
    console.error('Failed to load SLA CSV:', e.message);
  }
}

// Load SLA data on startup
loadSLAData();

// SLA search functions
function scoreSLARecord(rec, queryTokens, preferredCategory) {
  const haystack = `${rec.service} ${rec.channel} ${rec.category} ${rec.keterangan}`.toLowerCase();
  let score = 0;
  
  for (const token of queryTokens) {
    if (!token || token.length < 2) continue;
    if (haystack.includes(token)) score += 2;
  }
  
  // Boost score if category matches
  if (preferredCategory && rec.category.toLowerCase().includes(preferredCategory.toLowerCase())) {
    score += 3;
  }
  
  return score;
}

function searchSLA(query, preferredCategory = null, limit = 3) {
  if (!SLA_DATA || SLA_DATA.length === 0) return [];
  
  const q = String(query || '').toLowerCase();
  const tokens = q.split(/[^a-z0-9]+/).filter(w => w && w.length > 2);
  
  const scored = SLA_DATA
    .map(rec => ({ 
      rec, 
      score: scoreSLARecord(rec, tokens, preferredCategory) 
    }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(x => x.rec);
    
  return scored;
}

function formatSLAHints(records) {
  if (!records || records.length === 0) return null;
  
  const lines = records.map(r => 
    `- ${r.service} (${r.channel}) | ${r.category} | SLA: ${r.sla} hari | ${r.uic} | ${r.keterangan}`
  );
  
  return `Informasi SLA terkait:\n${lines.join('\n')}\n\nCatatan: SLA adalah target waktu penyelesaian complaint dalam hari kerja.`;
}

// -----------------------------
// App bootstrap
// -----------------------------
const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// In-memory conversation states dan chat sessions
const STATES = new Map();
const CHAT_SESSIONS = new Map();


// -----------------------------
// Validation & confidence
// -----------------------------
function validatePayload(d) {
  const okCat = [null, 'Top Up Gopay', 'Transfer Antar Bank', 'Pembayaran Tagihan', 'Biometric/Login Error', 'Saldo/Mutasi', 'Tabungan', 'Kartu Kredit', 'Giro', 'Lainnya'];
  if (!okCat.includes(d.category)) {
    return [false, 'Kategori tidak valid. Pilihan: Top Up Gopay/Transfer Antar Bank/Pembayaran Tagihan/Biometric Login Error/Saldo Mutasi/Tabungan/Kartu Kredit/Giro/Lainnya.'];
  }
  
  const okChannel = [null, 'Mobile Banking', 'Internet Banking', 'ATM', 'Kantor Cabang', 'Call Center', 'SMS Banking'];
  if (!okChannel.includes(d.channel)) {
    return [false, 'Channel tidak valid. Pilihan: Mobile Banking/Internet Banking/ATM/Kantor Cabang/Call Center/SMS Banking.'];
  }
  
  if (d.account_number && !/^(\d{3}-\d{6}-\d{5}|\d{10,16})$/.test(String(d.account_number))) {
    return [false, 'Format nomor rekening tidak valid (contoh: 002-000123-77099 atau 10-16 digit).'];
  }
  if (!d.description || String(d.description).trim() === '') {
    return [false, 'Deskripsi keluhan wajib diisi.'];
  }
  const okPrio = ['Low', 'Medium', 'High'];
  if (!okPrio.includes(d.priority)) {
    return [false, 'Priority harus salah satu: Low/Medium/High.'];
  }
  if (![null, 'call', 'chat'].includes(d.preferred_contact)) {
    return [false, 'preferred_contact harus call/chat/null.'];
  }
  return [true, 'ok'];
}

function computeConfidence(extracted) {
  const requiredFields = ['full_name', 'account_number', 'channel', 'category', 'description'];
  const filled = requiredFields.filter(field => {
    const value = extracted[field];
    return value !== null && value !== '' && value !== undefined;
  }).length;
  
  // Base confidence based on required fields completion
  let base = (filled / requiredFields.length) * 0.9;
  
  // Additional boost for having all required fields
  if (filled === requiredFields.length) base += 0.1;
  
  return Math.max(0, Math.min(1, base));
}

// -----------------------------
// Chatbot Conversation System
// -----------------------------

async function extractInfoFromConversation(messages) {
  // This function is now only used for extracting description from conversation
  // Skip extraction if conversation is too short
  if (messages.length < 6) return {};
  
  // Only extract description from user messages about their problem
  const userMessages = messages.filter(m => m.role === 'user');
  const lastFewMessages = userMessages.slice(-3); // Get last 3 user messages
  
  // Look for substantial description in recent messages
  for (const msg of lastFewMessages.reverse()) {
    if (msg.content.length > 20 && 
        !msg.content.match(/^(mobile banking|internet banking|atm|kantor cabang|call center|sms banking)$/i) &&
        !msg.content.match(/^(top up gopay|transfer antar bank|pembayaran tagihan|biometric\/login error|saldo\/mutasi|tabungan|kartu kredit|giro|lainnya)$/i) &&
        !msg.content.match(/^\d{3}-\d{6}-\d{5}$|\d{10,16}$/)) {
      
      // This looks like a description, return it
      return { description: msg.content.trim() };
    }
  }
  
  return {};
}

function extractInfoSimple(userMessage, currentAction) {
  const info = {};
  const text = userMessage.toLowerCase().trim();
  
  // Extract based on current step
  switch (currentAction) {
    case 'asking_name':
      // Extract name - assume the entire message is the name if it doesn't contain numbers or special banking terms
      if (!text.match(/\d{3}-\d{6}-\d{5}|\d{10,16}/) && 
          !/(mobile|internet|banking|atm|cabang|call center|sms)/i.test(text) &&
          text.length > 2 && text.length < 50) {
        info.full_name = userMessage.trim();
      }
      break;
      
    case 'asking_account':
      // Extract account number
      const accountMatch = text.match(/(\d{3}-\d{6}-\d{5}|\d{10,16})/);
      if (accountMatch) {
        info.account_number = accountMatch[1];
      }
      break;
      
    case 'asking_channel':
      // Extract channel
      if (text.includes('mobile banking') || text.includes('m-banking') || text === 'mobile banking') {
        info.channel = 'Mobile Banking';
      } else if (text.includes('internet banking') || text.includes('i-banking') || text === 'internet banking') {
        info.channel = 'Internet Banking';
      } else if (text.includes('atm') || text === 'atm') {
        info.channel = 'ATM';
      } else if (text.includes('cabang') || text.includes('kantor') || text === 'kantor cabang') {
        info.channel = 'Kantor Cabang';
      } else if (text.includes('call center') || text.includes('telepon') || text === 'call center') {
        info.channel = 'Call Center';
      } else if (text.includes('sms') || text === 'sms banking') {
        info.channel = 'SMS Banking';
      }
      break;
      
    case 'asking_category':
      // Extract category - exact match prioritized
      if (text === 'top up gopay' || text.includes('top up gopay')) {
        info.category = 'Top Up Gopay';
      } else if (text === 'transfer antar bank' || text.includes('transfer antar bank')) {
        info.category = 'Transfer Antar Bank';
      } else if (text === 'pembayaran tagihan' || text.includes('pembayaran tagihan')) {
        info.category = 'Pembayaran Tagihan';
      } else if (text.includes('biometric') || text.includes('login error')) {
        info.category = 'Biometric/Login Error';
      } else if (text === 'saldo/mutasi' || text.includes('saldo') || text.includes('mutasi')) {
        info.category = 'Saldo/Mutasi';
      } else if (text === 'tabungan' && text.length < 20) {
        info.category = 'Tabungan';
      } else if (text === 'kartu kredit' && text.length < 20) {
        info.category = 'Kartu Kredit';
      } else if (text === 'giro' && text.length < 20) {
        info.category = 'Giro';
      } else if (text === 'lainnya' && text.length < 20) {
        info.category = 'Lainnya';
      }
      break;
      
    case 'asking_description':
      // For description, we'll let the LLM handle it
      if (text.length > 10) {
        info.description = userMessage.trim();
      }
      break;
  }
  
  return info;
}

function extractInfoFallback(messages) {
  const userMessages = messages.filter(m => m.role === 'user');
  const info = {};
  
  // Extract name only from explicit mentions
  for (const msg of userMessages) {
    const nameMatch = msg.content.match(/nama\s+(?:saya\s+)?(?:adalah\s+)?([a-zA-Z\s]+)/i);
    if (nameMatch && nameMatch[1].trim().length > 1) {
      info.full_name = nameMatch[1].trim();
      break;
    }
  }
  
  // Extract account number only from explicit mentions
  for (const msg of userMessages) {
    const accountMatch = msg.content.match(/(?:rekening|nomor)[:\s]*(\d{3}-\d{6}-\d{5}|\d{10,16})/i);
    if (accountMatch) {
      info.account_number = accountMatch[1];
      break;
    }
  }
  
  // Extract channel only from explicit mentions
  for (const msg of userMessages) {
    const text = msg.content.toLowerCase();
    if (text.includes('mobile banking') || text.includes('m-banking')) {
      info.channel = 'Mobile Banking';
      break;
    } else if (text.includes('internet banking') || text.includes('i-banking')) {
      info.channel = 'Internet Banking';
      break;
    } else if (text.includes('atm')) {
      info.channel = 'ATM';
      break;
    } else if (text.includes('cabang') || text.includes('kantor')) {
      info.channel = 'Kantor Cabang';
      break;
    } else if (text.includes('call center') || text.includes('telepon')) {
      info.channel = 'Call Center';
      break;
    } else if (text.includes('sms')) {
      info.channel = 'SMS Banking';
      break;
    }
  }
  
  // Extract category only from explicit mentions
  for (const msg of userMessages) {
    const text = msg.content.toLowerCase();
    if (text === 'top up gopay' || text.includes('top up gopay')) {
      info.category = 'Top Up Gopay';
      break;
    } else if (text === 'transfer antar bank' || text.includes('transfer antar bank')) {
      info.category = 'Transfer Antar Bank';
      break;
    } else if (text === 'pembayaran tagihan' || text.includes('pembayaran tagihan')) {
      info.category = 'Pembayaran Tagihan';
      break;
    } else if (text.includes('biometric') || text.includes('login error')) {
      info.category = 'Biometric/Login Error';
      break;
    } else if (text === 'saldo/mutasi' || text.includes('saldo/mutasi')) {
      info.category = 'Saldo/Mutasi';
      break;
    } else if (text === 'tabungan' && text.length < 20) {
      info.category = 'Tabungan';
      break;
    } else if (text === 'kartu kredit' && text.length < 20) {
      info.category = 'Kartu Kredit';
      break;
    } else if (text === 'giro' && text.length < 20) {
      info.category = 'Giro';
      break;
    } else if (text === 'lainnya' && text.length < 20) {
      info.category = 'Lainnya';
      break;
    }
  }
  
  return info;
}

function determineChatAction(collected_info, messageCount) {
  if (messageCount <= 2) return 'greeting';
  if (!collected_info.full_name) return 'asking_name';
  if (!collected_info.account_number) return 'asking_account';
  if (!collected_info.channel) return 'asking_channel';
  if (!collected_info.category) return 'asking_category';
  if (!collected_info.description) return 'asking_description';
  
  // Only go to confirmation if we have ALL required fields
  const requiredFields = ['full_name', 'account_number', 'channel', 'category', 'description'];
  const hasAllRequired = requiredFields.every(field => {
    const value = collected_info[field];
    return value !== null && value !== '' && value !== undefined;
  });
  
  if (hasAllRequired) {
    return 'ready_for_confirmation';
  }
  
  return 'asking_description'; // Default fallback
}

function generateSuggestions(action, collected_info) {
  switch (action) {
    case 'asking_channel':
      return ['Mobile Banking', 'Internet Banking', 'ATM', 'Kantor Cabang', 'Call Center', 'SMS Banking'];
    case 'asking_category':
      return ['Top Up Gopay', 'Transfer Antar Bank', 'Pembayaran Tagihan', 'Biometric/Login Error', 'Saldo/Mutasi', 'Tabungan', 'Kartu Kredit', 'Giro', 'Lainnya'];
    case 'ready_for_confirmation':
      return ['Ya, data sudah benar', 'Ada yang perlu diperbaiki'];
    case 'asking_correction':
      return ['Nama salah', 'No rekening salah', 'Channel salah', 'Kategori salah', 'Deskripsi salah'];
    default:
      return [];
  }
}

function generateConfirmationSummary(collected_info) {
  return `
📋 RINGKASAN KELUHAN ANDA

👤 Nama: ${collected_info.full_name || 'Belum diisi'}
💳 No. Rekening: ${collected_info.account_number || 'Belum diisi'}
📱 Channel: ${collected_info.channel || 'Belum diisi'}
📂 Kategori: ${collected_info.category || 'Belum diisi'}
📝 Deskripsi: ${collected_info.description || 'Belum diisi'}

Apakah data di atas sudah benar? Silakan konfirmasi atau beri tahu jika ada yang perlu diperbaiki.
  `.trim();
}

async function generateDescriptionSummary(messages, collected_info) {
  const conversationText = messages
    .filter(m => m.role === 'user')
    .map(m => m.content)
    .join(' ');
  
  const summaryPrompt = `
Berdasarkan percakapan customer service berikut, buatlah ringkasan singkat dan profesional tentang keluhan nasabah:

Kategori: ${collected_info.category}
Channel: ${collected_info.channel}
Percakapan: ${conversationText}

Buatlah ringkasan dalam 1-2 kalimat yang menjelaskan masalah utama nasabah secara jelas dan profesional. 
Format: "Nasabah mengalami [masalah] saat [aktivitas] melalui [channel]."

Contoh: "Nasabah mengalami masalah pembayaran tagihan yang sudah terdebit namun transaksi gagal melalui Mobile Banking."
`;

  try {
    const response = await callLM([
      { role: 'system', content: 'Kamu adalah AI yang membuat ringkasan keluhan nasabah bank. Buatlah ringkasan yang singkat, jelas, dan profesional.' },
      { role: 'user', content: summaryPrompt }
    ], false);
    
    // Clean up the response
    let summary = response.trim();
    
    // Remove quotes if present
    summary = summary.replace(/^["']|["']$/g, '');
    
    // Ensure it starts with "Nasabah"
    if (!summary.toLowerCase().startsWith('nasabah')) {
      summary = `Nasabah mengalami ${summary.toLowerCase()}`;
    }
    
    return summary;
  } catch (error) {
    console.error('Error generating description summary:', error);
    
    // Fallback: create simple summary
    return `Nasabah mengalami masalah terkait ${collected_info.category} melalui ${collected_info.channel}.`;
  }
}

function createChatSession() {
  return {
    id: crypto.randomUUID(),
    created_at: new Date(),
    messages: [],
    collected_info: {
      full_name: null,
      account_number: null,
      channel: null,
      category: null,
      description: null,
      ai_generated_description: null, // Temporary field for AI summary
      preferred_contact: 'chat',
      standby_call_window: null,
      priority: 'Medium'
    },
    current_step: 'greeting',
    is_complete: false,
    needs_confirmation: false
  };
}

// Template responses for each step
function getTemplateResponse(action, collected_info, userMessage) {
  switch (action) {
    case 'asking_name':
      return "Terima kasih sudah memberikan informasinya! Sekarang, bisa saya tahu nama lengkap Anda terlebih dahulu untuk penanganan lebih baik?";
    
    case 'asking_account':
      return `Terima kasih atas informasinya, ${collected_info.full_name}! Sekarang, bisa saya tanyakan nomor rekening yang Anda gunakan untuk menghadapi masalah ini? Pastikan nomor rekening diinput dalam format yang benar yaitu 002-000123-77099 atau minimal 10-16 digit angka.`;
    
    case 'asking_channel':
      return `Terima kasih sudah memberikan nomor rekeningnya, ${collected_info.full_name}. Selanjutnya, bisa Anda beri tahu saya channel atau platform yang Anda gunakan saat mengalami masalah ini?`;
    
    case 'asking_category':
      return `Terima kasih sudah memberikan informasinya, ${collected_info.full_name}. Sekarang, untuk membantu kita mengatasi masalah Anda dengan cepat dan tepat, bisa Anda beri tahu saya jenis keluhan yang Anda alami?`;
    
    case 'asking_description':
      return `Terima kasih sudah memberikan informasinya, ${collected_info.full_name}. Kategori keluhan "${collected_info.category}" telah dipilih. Sekarang, silakan beri saya deskripsi detail masalah yang Anda alami. Jelaskan secara lengkap apa yang terjadi, kapan masalah terjadi, dan langkah apa yang sudah Anda coba.`;
    
    default:
      return "Terima kasih atas informasinya. Silakan lanjutkan dengan memberikan detail yang diminta.";
  }
}

async function processChatMessage(sessionId, userMessage) {
  let session = CHAT_SESSIONS.get(sessionId);
  if (!session) {
    session = createChatSession();
    CHAT_SESSIONS.set(sessionId, session);
  }

  // Add user message to history
  session.messages.push({
    role: 'user',
    content: userMessage,
    timestamp: new Date()
  });

  // Handle first message (greeting)
  if (session.messages.length === 1) {
    const greeting = getTimeBasedGreeting();
    const welcomeMessage = `${greeting} Terima kasih sudah menghubungi kami. Saya akan dengan senang hati membantu Anda hari ini. Bisa saya tahu nama lengkap Anda terlebih dahulu untuk penanganan lebih baik?`;
    
    session.messages.push({
      role: 'assistant',
      content: welcomeMessage,
      timestamp: new Date()
    });
    
    return {
      session_id: sessionId,
      message: welcomeMessage,
      action: 'greeting',
      next_question: null,
      suggestions: [],
      collected_info: session.collected_info,
      is_complete: false,
      confidence: computeConfidence(session.collected_info)
    };
  }

  try {
    // Extract information from user message using simple pattern matching
    let extractedInfo = {};
    
    // Only use LM extraction for description step
    const currentAction = determineChatAction(session.collected_info, session.messages.length);
    
    if (currentAction === 'asking_description' && session.messages.length > 2) {
      // Use LM Studio only for extracting description from conversation
      extractedInfo = await extractInfoFromConversation(session.messages);
      console.log('LLM Extracted info for description:', extractedInfo);
    } else {
      // Use simple pattern matching for other fields
      extractedInfo = extractInfoSimple(userMessage, currentAction);
      console.log('Simple extracted info:', extractedInfo);
    }
    
    // Update collected info only with non-null values
    Object.keys(extractedInfo).forEach(key => {
      if (extractedInfo[key] !== null && extractedInfo[key] !== '') {
        session.collected_info[key] = extractedInfo[key];
      }
    });
    
    // Determine current action after extraction
    const action = determineChatAction(session.collected_info, session.messages.length);
    session.current_step = action;
    
    // Generate template response instead of calling LM Studio
    let response;
    
    if (action === 'asking_description') {
      // Use template response for asking description
      response = getTemplateResponse(action, session.collected_info, userMessage);
    } else {
      // Use template response for other steps
      response = getTemplateResponse(action, session.collected_info, userMessage);
    }
    
    // Add bot response to session
    session.messages.push({
      role: 'assistant',
      content: response,
      timestamp: new Date()
    });
    
    // Generate suggestions
    const suggestions = generateSuggestions(action, session.collected_info);
    
    // Check if conversation is complete
    const requiredFields = ['full_name', 'account_number', 'channel', 'category', 'description'];
    const hasRequired = requiredFields.every(field => session.collected_info[field]);
    
    // Handle confirmation step
    if (action === 'ready_for_confirmation' && !session.needs_confirmation) {
      session.needs_confirmation = true;
      
      // Generate AI summary for description
      const aiGeneratedDescription = await generateDescriptionSummary(session.messages, session.collected_info);
      
      // Update the collected info with AI-generated description for the summary
      const summaryInfo = { 
        ...session.collected_info, 
        description: aiGeneratedDescription 
      };
      
      const confirmationMessage = `
📋 RINGKASAN KELUHAN ANDA

👤 Nama: ${summaryInfo.full_name || 'Belum diisi'}
💳 No. Rekening: ${summaryInfo.account_number || 'Belum diisi'}
📱 Channel: ${summaryInfo.channel || 'Belum diisi'}
📂 Kategori: ${summaryInfo.category || 'Belum diisi'}
📝 Deskripsi: ${summaryInfo.description || 'Belum diisi'}

Apakah data di atas sudah benar? Silakan konfirmasi atau beri tahu jika ada yang perlu diperbaiki.
      `.trim();
      
      // Store the AI-generated description in session for final save
      session.collected_info.ai_generated_description = aiGeneratedDescription;
      
      // Override the LLM response with confirmation summary
      session.messages[session.messages.length - 1].content = confirmationMessage;
      
      return {
        session_id: sessionId,
        message: confirmationMessage,
        action: action,
        next_question: null,
        suggestions: generateSuggestions(action, session.collected_info),
        collected_info: { ...session.collected_info, description: aiGeneratedDescription }, // Show AI description in UI
        is_complete: false,
        confidence: computeConfidence(session.collected_info),
        needs_confirmation: true
      };
    }
    
    // Handle user confirmation response
    if (session.needs_confirmation) {
      if (userMessage.toLowerCase().includes('ya') || userMessage.toLowerCase().includes('benar') || userMessage.toLowerCase().includes('setuju')) {
        session.is_complete = true;
        session.needs_confirmation = false;
        
        // Use AI-generated description for final data
        if (session.collected_info.ai_generated_description) {
          session.collected_info.description = session.collected_info.ai_generated_description;
          delete session.collected_info.ai_generated_description; // Clean up temporary field
        }
        
        const finalMessage = "✅ Terima kasih! Keluhan Anda telah berhasil dicatat. Tim kami akan segera menindaklanjuti keluhan Anda sesuai dengan SLA yang berlaku. Anda akan dihubungi melalui channel yang tersedia.";
        
        session.messages[session.messages.length - 1].content = finalMessage;
        
        return {
          session_id: sessionId,
          message: finalMessage,
          action: 'completed',
          next_question: null,
          suggestions: [],
          collected_info: session.collected_info,
          is_complete: true,
          confidence: 1.0,
          needs_confirmation: false
        };
      } else if (userMessage.toLowerCase().includes('perbaiki') || userMessage.toLowerCase().includes('salah') || userMessage.toLowerCase().includes('tidak benar')) {
        // Reset confirmation and ask what needs to be corrected
        session.needs_confirmation = false;
        
        const correctionMessage = "Baik, ada yang perlu diperbaiki. Bisa Anda beritahu bagian mana yang perlu dikoreksi? Saya akan membantu memperbaiki data Anda.";
        
        session.messages[session.messages.length - 1].content = correctionMessage;
        
        return {
          session_id: sessionId,
          message: correctionMessage,
          action: 'asking_correction',
          next_question: null,
          suggestions: ['Nama salah', 'No rekening salah', 'Channel salah', 'Kategori salah', 'Deskripsi salah'],
          collected_info: session.collected_info,
          is_complete: false,
          confidence: computeConfidence(session.collected_info),
          needs_confirmation: false
        };
      }
    }
    
    session.is_complete = hasRequired && action === 'completed';

    return {
      session_id: sessionId,
      message: response,
      action: action,
      next_question: null,
      suggestions: suggestions,
      collected_info: session.collected_info,
      is_complete: session.is_complete,
      confidence: computeConfidence(session.collected_info)
    };

  } catch (error) {
    console.error('Chat processing error:', error);
    
    // Fallback response
    return {
      session_id: sessionId,
      message: "Maaf, saya mengalami kendala teknis. Bisakah Anda ulangi pesan Anda?",
      action: "error",
      next_question: null,
      suggestions: [],
      collected_info: session.collected_info,
      is_complete: false,
      confidence: 0
    };
  }
}

// -----------------------------
// LM Studio call helpers
// -----------------------------
async function callLM(messages, useJsonMode = true) {
  const payload = {
    model: LM_MODEL,
    messages,
    temperature: LM_TEMPERATURE
  };
  
  console.log(`🤖 Calling LM Studio at: ${LM_BASE_URL}`);
  console.log('📤 Payload:', JSON.stringify({...payload, messages: `${payload.messages.length} messages`}));

  // Create AbortController for proper timeout handling
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000); // 25 second timeout

  try {
    const res = await fetch(`${LM_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LM_API_KEY}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
        'User-Agent': 'GCP-Chatbot/1.0',
        'Accept': 'application/json',
        'Cache-Control': 'no-cache'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId); // Clear timeout if request succeeds

    console.log(`📡 LM Response Status: ${res.status}`);
    
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error(`❌ LM HTTP Error ${res.status}:`, text.slice(0, 500));
      
      // Specific error handling
      if (res.status === 400 && text.includes('Model unloaded')) {
        console.warn('⚠️ LM Studio model not loaded, using fallback response');
        return getFallbackResponse(messages);
      }
      
      if (res.status === 503) {
        console.warn('⚠️ LM Studio service unavailable, using fallback response');
        return getFallbackResponse(messages);
      }
      
      throw new Error(`LM HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
    
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content?.trim() ?? '';
    
    if (!content) {
      console.warn('⚠️ Empty response from LM Studio, using fallback');
      return getFallbackResponse(messages);
    }
    
    console.log('✅ LM Response received:', content.slice(0, 100) + (content.length > 100 ? '...' : ''));
    return content;
    
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      console.error('❌ LM Studio request timeout (25s)');
    } else {
      console.error('❌ LM Studio connection failed:', error.message);
    }
    
    console.error('🔧 Error details:', {
      name: error.name,
      message: error.message,
      url: LM_BASE_URL
    });
    
    console.warn('⚠️ Using fallback response due to LM Studio unavailability');
    return getFallbackResponse(messages);
  }
}

async function extractJsonWithLM(text) {
  const messages = [
    { role: 'system', content: EXTRACTION_SYSTEM },
    { role: 'user',   content: EXTRACTION_USER_TMPL(text) }
  ];
  // LM Studio doesn't support JSON mode, so use text mode and parse manually
  try {
    const content = await callLM(messages, false);
    // Try to extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    } else {
      return JSON.parse(content);
    }
  } catch (e) {
    throw new Error(`Failed to parse LLM JSON. raw="${content.slice(0,200)}..."`);
  }
}

// -----------------------------
// FAQ (static demo)
// -----------------------------
const FAQS = [
  {
    q: ['cara blokir kartu debit', 'debit hilang', 'kartu debit hilang', 'blokir debit'],
    a: 'Untuk blokir kartu debit: buka aplikasi mobile banking → menu Kartu → Blokir Kartu, atau hubungi call center resmi. Siapkan data verifikasi (nama, tanggal lahir, 4 digit akhir rekening).'
  },
  {
    q: ['limit kartu kredit', 'cek limit kredit', 'sisa limit cc'],
    a: 'Cek limit kartu kredit melalui aplikasi mobile banking/website resmi pada menu Kartu Kredit → Informasi Limit, atau hubungi call center untuk informasi terbaru.'
  },
  {
    q: ['biaya admin tabungan', 'biaya bulanan tabungan'],
    a: 'Biaya admin tabungan bervariasi per jenis produk. Silakan cek brosur/website resmi produk tabungan atau tanyakan ke cabang terdekat.'
  },
  {
    q: ['chargeback', 'refund transaksi kartu kredit', 'transaksi tidak dikenali kartu kredit'],
    a: 'Untuk dispute/chargeback transaksi kartu kredit: laporkan maksimal 2×24 jam sejak mengetahui transaksi, isi formulir dispute, dan lampirkan bukti pendukung. Proses investigasi mengikuti ketentuan penerbit.'
  },
  {
    q: ['reset pin', 'lupa pin atm', 'pin terblokir'],
    a: 'PIN terblokir/lupa: lakukan reset via ATM (Jika tersedia), aplikasi, atau ke cabang dengan membawa identitas dan buku tabungan/kartu terkait.'
  }
];

function faqSearch(query) {
  const q = (query || '').toLowerCase();
  // Skor sederhana: jumlah kata kunci yang match
  let best = null;
  let bestScore = 0;
  for (const item of FAQS) {
    const score = item.q.reduce((acc, kw) => acc + (q.includes(kw) ? 1 : 0), 0);
    if (score > bestScore) { best = item; bestScore = score; }
  }
  if (best) return { answer: best.a, matched: best.q };
  return { answer: null, matched: [] };
}

// -----------------------------
// Routes
// -----------------------------
app.get('/healthz', (req, res) => {
  res.json({ status: 'ok', model: LM_MODEL });
});

// New Chatbot endpoint - two-way conversation
app.post('/chat', async (req, res) => {
  try {
    const { message, session_id } = req.body;
    
    if (!message || typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({ error: 'Message is required' });
    }

    const sessionId = session_id || crypto.randomUUID();
    const response = await processChatMessage(sessionId, message.trim());
    
    res.json(response);
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ 
      error: 'internal_error', 
      detail: 'Terjadi kesalahan pada sistem chat.',
      message: 'Maaf, saya mengalami kendala teknis. Silakan coba lagi.'
    });
  }
});

// Get chat session info
app.get('/chat/:session_id', (req, res) => {
  const session = CHAT_SESSIONS.get(req.params.session_id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  res.json({
    session_id: session.id,
    created_at: session.created_at,
    current_step: session.current_step,
    collected_info: session.collected_info,
    is_complete: session.is_complete,
    message_count: session.messages.length,
    confidence: computeConfidence(session.collected_info)
  });
});

// Legacy endpoint - single extraction (for backward compatibility)
app.post('/extract', async (req, res) => {
  try {
    const text = String(req.body?.text || '').trim();
    if (!text) return res.status(400).json({ error: 'text kosong' });

    // 1) Extract JSON via LLM
    let extracted = await extractJsonWithLM(text);

    // 2) Semantic autocorrect
    extracted = semanticAutocorrect(extracted, text);

    // 3) Validate & confidence
    const [valid, msg] = validatePayload(extracted);
    const confidence = Number(computeConfidence(extracted).toFixed(2));

    // 4) Build summary
    const summary = {
      nama: extracted.full_name ?? null,
      no_rekening: extracted.account_number ?? null,
      channel: extracted.channel ?? null,
      kategori: extracted.category ?? null,
      deskripsi: extracted.description ?? null
    };

    res.json({
      valid,
      message: valid ? 'ok' : 'Data belum lengkap/valid.',
      confidence,
      extracted,
      summary
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal_error', detail: String(err.message || err) });
  }
});

// Legacy clarify endpoint (for backward compatibility)
app.post('/clarify', async (req, res) => {
  try {
    const { state_id, answers } = req.body || {};
    if (!state_id || !STATES.has(state_id)) {
      return res.status(400).json({ error: 'invalid_state', detail: 'state_id tidak ditemukan atau sudah kadaluarsa.' });
    }
    const st = STATES.get(state_id);
    const merged = { ...st.extracted, ...(answers || {}) };

    // Normalisasi waktu & prioritas dll setelah merge
    merged.standby_call_window = normalizeTimeWindow(merged.standby_call_window);
    merged.priority = inferPriority(JSON.stringify(answers || ''), merged.priority);

    // Validasi & confidence
    const [valid, msg] = validatePayload(merged);
    const confidence = Number(computeConfidence(merged).toFixed(2));

    // Bangun summary
    const summary = {
      nama: merged.full_name ?? null,
      no_rekening: merged.account_number ?? null,
      channel: merged.channel ?? null,
      kategori: merged.category ?? null,
      deskripsi: merged.description ?? null
    };

    STATES.delete(state_id); // cleanup

    res.json({
      valid,
      message: valid ? 'ok' : 'Data belum lengkap/valid.',
      confidence,
      extracted: merged,
      summary
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal_error', detail: String(err.message || err) });
  }
});

// Simple FAQ
app.get('/faq', (req, res) => {
  const q = String(req.query?.q || '').trim();
  if (!q) return res.status(400).json({ error: 'q kosong' });
  const hit = faqSearch(q);
  if (hit.answer) {
    res.json({ answer: hit.answer, matched_keywords: hit.matched });
  } else {
    res.json({ answer: null, matched_keywords: [], hint: 'Tidak ada jawaban di FAQ. Silakan hubungi agent.' });
  }
});

// SLA search endpoint
app.get('/sla', (req, res) => {
  try {
    const q = String(req.query?.q || '').trim();
    const category = String(req.query?.category || '').trim() || null;
    const limit = parseInt(req.query?.limit || '5', 10);
    
    if (!q) {
      return res.status(400).json({ error: 'Parameter q (query) diperlukan' });
    }
    
    const results = searchSLA(q, category, Math.min(limit, 10));
    
    res.json({ 
      count: results.length, 
      query: q,
      category: category,
      results: results.map(r => ({
        service: r.service,
        channel: r.channel,
        category: r.category,
        sla_days: r.sla,
        uic: r.uic,
        description: r.keterangan
      }))
    });
  } catch (e) {
    console.error('SLA search error:', e);
    res.status(500).json({ error: 'internal_error', detail: e.message });
  }
});

// Test LM Studio connectivity endpoint
app.get('/test-lm', async (req, res) => {
  try {
    console.log('🔍 Testing LM Studio connectivity from server...');
    
    // Test models endpoint first
    const modelsRes = await fetch(`${LM_BASE_URL}/models`, {
      headers: {
        'ngrok-skip-browser-warning': 'true',
        'User-Agent': 'Chatbot-Server/1.0',
        'Accept': 'application/json'
      },
      timeout: 10000
    });
    
    const modelsStatus = modelsRes.status;
    let modelsData = null;
    
    if (modelsRes.ok) {
      modelsData = await modelsRes.json();
    }
    
    // Test chat endpoint
    const chatRes = await fetch(`${LM_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LM_API_KEY}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
        'User-Agent': 'Chatbot-Server/1.0',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        model: LM_MODEL,
        messages: [{ role: 'user', content: 'Test connection' }],
        temperature: 0.7,
        max_tokens: 20
      }),
      timeout: 15000
    });
    
    const chatStatus = chatRes.status;
    let chatData = null;
    let chatError = null;
    
    if (chatRes.ok) {
      chatData = await chatRes.json();
    } else {
      chatError = await chatRes.text();
    }
    
    res.json({
      timestamp: new Date().toISOString(),
      lm_base_url: LM_BASE_URL,
      lm_model: LM_MODEL,
      tests: {
        models: {
          status: modelsStatus,
          success: modelsStatus === 200,
          data: modelsData?.data?.length ? `${modelsData.data.length} models found` : 'No models',
          available_models: modelsData?.data?.map(m => m.id) || []
        },
        chat: {
          status: chatStatus,
          success: chatStatus === 200,
          response: chatData?.choices?.[0]?.message?.content || null,
          error: chatError?.slice(0, 200) || null
        }
      },
      overall_status: (modelsStatus === 200 && chatStatus === 200) ? 'HEALTHY' : 'UNHEALTHY',
      recommendations: [
        modelsStatus !== 200 ? 'Check LM Studio server status' : null,
        chatStatus !== 200 ? 'Check model loading and API configuration' : null,
        'Verify ngrok tunnel is active',
        'Check firewall settings'
      ].filter(Boolean)
    });
    
  } catch (error) {
    console.error('LM connectivity test error:', error);
    res.status(500).json({
      timestamp: new Date().toISOString(),
      lm_base_url: LM_BASE_URL,
      error: error.message,
      overall_status: 'ERROR',
      recommendations: [
        'Check if LM Studio is running',
        'Verify ngrok tunnel is active',
        'Check network connectivity',
        'Review server logs for details'
      ]
    });
  }
});

// -----------------------------
// Start
// -----------------------------

const path = require('path');
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/chatbot', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'chatbot.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  const LOCAL_IP = getLocalIP();
  
  console.log(`🚀 Chat-to-Form server running on http://0.0.0.0:${PORT}`);
  console.log(`🤖 LM base URL: ${LM_BASE_URL} | Model: ${LM_MODEL}`);
  console.log(`📋 Legacy API Tester: http://localhost:${PORT}/`);
  console.log(`💬 New Chatbot Interface: http://localhost:${PORT}/chatbot`);
  console.log(`\n🌐 Network Access:`);
  console.log(`   Server binding to all interfaces (0.0.0.0:${PORT})`);
  console.log(`   Local IP detected: ${LOCAL_IP}`);
  console.log(`   Environment: ${NODE_ENV}`);
  
  if (NODE_ENV === 'production') {
    console.log(`🔴 Production mode - server will run in background`);
    console.log(`📊 Use PM2 commands for management`);
  } else {
    console.log(`🟡 Development mode - server will stop when SSH disconnects`);
    console.log(`💡 Use './start-server.sh production' for persistent running`);
  }
  
  console.log(`\n🔧 Configuration:`);
  console.log(`   Current LM URL: ${LM_BASE_URL}`);
  console.log(`   To change LM URL: export LM_BASE_URL="https://your-ngrok-url.ngrok.io/v1"`);
  
  console.log(`\n🔥 Firewall Setup (Run as Administrator):`);
  console.log(`   netsh advfirewall firewall add rule name="LM Studio" dir=in action=allow protocol=TCP localport=1234`);
  console.log(`   netsh advfirewall firewall add rule name="Chatbot" dir=in action=allow protocol=TCP localport=${PORT}`);
});
