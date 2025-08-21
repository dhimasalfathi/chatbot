const crypto = require('crypto');
const { callLM } = require('./lm-studio');
const { getTimeBasedGreeting } = require('../utils/prompts');

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
  
  // Optional validation for account number if provided
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
  // Only require channel, category, and description (skip name and account)
  const requiredFields = ['channel', 'category', 'description'];
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
// Information Extraction Functions
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

function determineChatAction(collected_info, messageCount) {
  if (messageCount <= 2) return 'greeting';
  // Skip asking for name and account number - go directly to channel
  if (!collected_info.channel) return 'asking_channel';
  if (!collected_info.category) return 'asking_category';
  if (!collected_info.description) return 'asking_description';
  
  // Only go to confirmation if we have required fields (excluding name and account)
  const requiredFields = ['channel', 'category', 'description'];
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
      return ['Channel salah', 'Kategori salah', 'Deskripsi salah'];
    default:
      return [];
  }
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
    case 'asking_channel':
      return "Terima kasih sudah menghubungi B-Care! Untuk membantu menyelesaikan masalah Anda, bisa Anda beri tahu saya channel atau platform yang Anda gunakan saat mengalami masalah ini?";
    
    case 'asking_category':
      return `Terima kasih sudah memberikan informasinya. Sekarang, untuk membantu kita mengatasi masalah Anda dengan cepat dan tepat, bisa Anda beri tahu saya jenis keluhan yang Anda alami?`;
    
    case 'asking_description':
      return `Terima kasih sudah memberikan informasinya. Kategori keluhan "${collected_info.category}" telah dipilih. Sekarang, silakan beri saya deskripsi detail masalah yang Anda alami. Jelaskan secara lengkap apa yang terjadi, kapan masalah terjadi, dan langkah apa yang sudah Anda coba.`;
    
    default:
      return "Terima kasih atas informasinya. Silakan lanjutkan dengan memberikan detail yang diminta.";
  }
}

module.exports = {
  STATES,
  CHAT_SESSIONS,
  validatePayload,
  computeConfidence,
  extractInfoFromConversation,
  extractInfoSimple,
  determineChatAction,
  generateSuggestions,
  generateDescriptionSummary,
  createChatSession,
  getTemplateResponse
};
