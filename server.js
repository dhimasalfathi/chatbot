// server.js
// ------------------------------------------------------------
// Chat-to-Form (MVP) with LM Studio (OpenAI-compatible API)
// + Auto Clarification + Simple FAQ
// ------------------------------------------------------------
// Requirements:
//   npm i express cors
// Node.js 18+
//
// Env vars (opsional, punya default):
//   LM_BASE_URL=http://localhost:1234/v1
//   LM_API_KEY=lm-studio
//   LM_MODEL=qwen2.5-7b-instruct-q4_k_m
//
// Run:
//   node server.js
// ------------------------------------------------------------

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const { parse: csvParse } = require('csv-parse/sync');
const { getLocalIP, getNetworkConfig } = require('./network-config');

// -----------------------------
// Config
// -----------------------------
const PORT = process.env.PORT || (process.env.NODE_ENV === 'production' ? 8080 : 5000);
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
// Prompts
// -----------------------------
const EXTRACTION_SYSTEM = `
You are a bank customer-care assistant for Indonesia. Extract a structured JSON from the user's complaint.

Hard rules:
- Output VALID JSON only (no prose).
- Unknown fields = null.
- category ∈ {Tabungan, Giro, Kartu Kredit, Lainnya}.
- Use bahasa Indonesia for subcategory & description.
- preferred_contact ∈ {call, chat, null}.
- standby_call_window format: HH:mm-HH:mm (Asia/Jakarta).

Classification rules (very important):
- Jika menyebut: kartu debit / debit / ATM / rekening tabungan / tarik-setor tunai → category = Tabungan.
- Jika menyebut: kartu kredit / CC / tagihan/limit/cicilan/chargeback/refund merchant → category = Kartu Kredit.
- Jika menyebut: giro / bilyet giro (BG) / cek / inkaso / kliring → category = Giro.
- Jika tidak yakin dengan kategori → category = null (jangan tebak).

Subcategory hints:
- Tabungan: “Kartu debit tertelan”, “Tarik tunai gagal”, “Saldo tidak sesuai”, “Kartu debit hilang”, “PIN terblokir”.
- Kartu Kredit: “Transaksi tidak dikenali”, “Tagihan tidak sesuai”, “Kartu kredit hilang”, “Kena biaya tahunan”, “Limit tidak cukup”.
- Giro: “BG tolak”, “Setoran cek pending”, “Inkaso terlambat”.

Priority rules:
- High jika ada kata kunci: “hilang”, “dicuri”, “fraud”, “transaksi tidak dikenal/tidak dikenali”, “akses tidak sah/ilegal”.
- Selain itu default Medium (kecuali jelas Low).

Time window:
- Contoh masukan “13-15” → “13:00-15:00”; “13.30-15.45” → “13:30-15:45”.
`.trim();

const EXTRACTION_USER_TMPL = (text) => `
Schema:
{
  "full_name": "string|null",
  "account_number": "string|null",
  "category": "Tabungan|Giro|Kartu Kredit|Lainnya|null",
  "subcategory": "string|null",
  "description": "string",
  "priority": "Low|Medium|High",
  "preferred_contact": "call|chat|null",
  "standby_call_window": "string|null",
  "attachments": []
}

Examples:
Input:
"Halo, kartu debit saya tertelan di ATM BNI Semarang semalam. Rekening 123456789012. Saya standby telepon 13-15."
Output:
{
  "full_name": null,
  "account_number": "123456789012",
  "category": "Tabungan",
  "subcategory": "Kartu debit tertelan",
  "description": "Kartu debit tertelan di ATM BNI Semarang semalam.",
  "priority": "Medium",
  "preferred_contact": "call",
  "standby_call_window": "13:00-15:00",
  "attachments": []
}

Input:
"Saya keberatan tagihan kartu kredit bulan ini, ada transaksi tidak saya kenal."
Output:
{
  "full_name": null,
  "account_number": null,
  "category": "Kartu Kredit",
  "subcategory": "Transaksi tidak dikenali",
  "description": "Keberatan tagihan kartu kredit, ada transaksi tidak dikenali.",
  "priority": "High",
  "preferred_contact": null,
  "standby_call_window": null,
  "attachments": []
}

Input:
"BG saya ditolak, tolong cek statusnya."
Output:
{
  "full_name": null,
  "account_number": null,
  "category": "Giro",
  "subcategory": "BG tolak",
  "description": "Bilyet giro ditolak dan perlu pengecekan status.",
  "priority": "Medium",
  "preferred_contact": null,
  "standby_call_window": null,
  "attachments": []
}

User complaint (free text):
"""${text}"""

Output only the JSON object, nothing else.
`.trim();

// -----------------------------
// Heuristics (semantic autocorrect)
// -----------------------------
const KEYS = {
  tabungan: [
    /\bkartu\s*debit\b/i, /\bdebit\b/i, /\batm\b/i,
    /\brekening(?!\s*kredit)\b/i, /\btarik\b/i, /\bsetor\b/i,
    /\bbuku\s*tabungan\b/i, /\bsaldo\b/i
  ],
  kredit: [
    /\bkartu\s*kredit\b/i, /\bcc\b/i, /\blimit\b/i,
    /\bcicilan\b/i, /\bcharge\s*back\b/i, /\bchargeback\b/i,
    /\brefund\s*merchant\b/i, /\btagihan\b/i
  ],
  giro: [
    /\bgiro\b/i, /\bbilyet\s*giro\b/i, /\bbg\b/i,
    /\bcek\b/i, /\binkaso\b/i, /\bkliring\b/i
  ]
};

const PRIO_HIGH = [
  /\bhilang\b/i, /\bdicuri\b/i, /\bfraud\b/i,
  /\btidak\s*kenal(i)?\b/i, /\btidak\s*dikenal(i)?\b/i,
  /\bakses\s*(tidak\s*sah|ilegal)\b/i
];

function matchAny(text, regexList) {
  return regexList.some((re) => re.test(text));
}

function inferCategorySubcategory(text) {
  const t = text.toLowerCase();
  if (matchAny(t, KEYS.kredit)) return { category: 'Kartu Kredit', subcategory: null };
  if (matchAny(t, KEYS.giro))   return { category: 'Giro', subcategory: null };
  if (matchAny(t, KEYS.tabungan)) {
    if (/tertelan/i.test(t)) return { category: 'Tabungan', subcategory: 'Kartu debit tertelan' };
    if (/hilang/i.test(t))   return { category: 'Tabungan', subcategory: 'Kartu debit hilang' };
    if (/tarik.*gagal|gagal.*tarik/i.test(t)) return { category: 'Tabungan', subcategory: 'Tarik tunai gagal' };
    if (/pin.*blok|blok.*pin/i.test(t)) return { category: 'Tabungan', subcategory: 'PIN terblokir' };
    return { category: 'Tabungan', subcategory: null };
  }
  return { category: null, subcategory: null };
}

function inferPriority(text, current) {
  if (matchAny(text, PRIO_HIGH)) return 'High';
  return ['Low', 'Medium', 'High'].includes(current) ? current : 'Medium';
}

function normalizeTimeWindow(s) {
  if (!s) return null;
  let v = String(s).trim();
  v = v.replace(/\s+/g, '');
  v = v.replace(/\./g, ':').replace(/[–—]/g, '-');
  const m = v.match(/^(\d{1,2})(?::?(\d{2}))?-(\d{1,2})(?::?(\d{2}))?$/);
  if (!m) return v;
  let [_, h1, m1, h2, m2] = m;
  h1 = parseInt(h1, 10); h2 = parseInt(h2, 10);
  m1 = m1 ? parseInt(m1, 10) : 0;
  m2 = m2 ? parseInt(m2, 10) : 0;
  if (![h1,h2,m1,m2].every(Number.isFinite)) return v;
  if (h1<0||h1>23||h2<0||h2>23||m1<0||m1>59||m2<0||m2>59) return v;
  return `${String(h1).padStart(2,'0')}:${String(m1).padStart(2,'0')}-${String(h2).padStart(2,'0')}:${String(m2).padStart(2,'0')}`;
}

function semanticAutocorrect(payload, originalText) {
  const { category, subcategory } = inferCategorySubcategory(originalText);
  const out = { ...payload };

  if (category && out.category !== category) out.category = category;
  if (!out.subcategory && subcategory) out.subcategory = subcategory;

  out.priority = inferPriority(originalText, out.priority);
  out.standby_call_window = normalizeTimeWindow(out.standby_call_window);

  return out;
}

// -----------------------------
// Validation & confidence
// -----------------------------
function validatePayload(d) {
  const okCat = [null, 'Tabungan', 'Giro', 'Kartu Kredit', 'Lainnya'];
  if (!okCat.includes(d.category)) {
    return [false, 'Kategori tidak valid. Pilihan: Tabungan/Giro/Kartu Kredit/Lainnya.'];
  }
  if (d.account_number && !/^\d{10,16}$/.test(String(d.account_number))) {
    return [false, 'Format nomor rekening tidak valid (10–16 digit).'];
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
  const filled = Object.values(extracted).filter(v => v !== null && v !== '' && !(Array.isArray(v) && v.length === 0)).length;
  let base = 0.45 + 0.06 * filled;
  if (extracted.category && extracted.description) base += 0.05;
  return Math.max(0, Math.min(1, base));
}

// -----------------------------
// Chatbot Conversation System
// -----------------------------
// Helper function to get time-based greeting
function getTimeBasedGreeting() {
  const now = new Date();
  const jakartaTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Jakarta"}));
  const hour = jakartaTime.getHours();
  
  if (hour >= 5 && hour < 12) {
    return "Selamat pagi";
  } else if (hour >= 12 && hour < 15) {
    return "Selamat siang";
  } else if (hour >= 15 && hour < 18) {
    return "Selamat sore";
  } else {
    return "Selamat malam";
  }
}

const CHAT_SYSTEM_PROMPT = `
Kamu adalah asisten customer service bank di Indonesia yang ramah dan profesional. Tugasmu adalah membantu nasabah dengan keluhan dan pertanyaan mereka.

INSTRUKSI PERCAKAPAN:
- Gunakan sapaan yang sesuai dengan waktu (pagi/siang/sore/malam) tanpa menyebut assalamualaikum atau salam agama tertentu
- Gunakan bahasa yang netral dan profesional
- Jangan menggunakan kata "saya" atau "kamu", gunakan bahasa yang lebih formal
- Tanya nama lengkap terlebih dahulu jika belum ada
- Tanyakan kategori masalah (Tabungan/Kartu Kredit/Giro/Lainnya)
- Minta detail keluhan secara spesifik
- Jika masalah terkait tabungan/giro, tanyakan nomor rekening
- Tanyakan preferensi kontak (telepon/chat)
- Jika memilih telepon, tanyakan waktu standby
- Berikan empati dan gunakan bahasa yang sopan
- Tanya satu hal per waktu agar tidak membingungkan

INFORMASI SLA:
- Jika ada informasi SLA yang relevan, sampaikan dengan jelas berapa lama waktu penyelesaian
- SLA adalah target waktu penyelesaian dalam hari kerja
- Berikan informasi UIC (unit yang menangani) jika tersedia
- Jelaskan proses penanganan secara singkat

Berikan respons yang natural dan ramah sesuai konteks percakapan.
`.trim();

async function extractInfoFromConversation(messages) {
  const extractionPrompt = `
Analisis percakapan berikut dan ekstrak informasi nasabah:

${messages.map(m => `${m.role}: ${m.content}`).join('\n')}

Berikan hasil dalam format JSON yang valid:
{
  "full_name": "nama lengkap atau null",
  "category": "Tabungan|Kartu Kredit|Giro|Lainnya|null",
  "description": "ringkasan masalah atau null",
  "account_number": "nomor rekening atau null",
  "preferred_contact": "call|chat|null",
  "standby_call_window": "waktu standby atau null"
}
`;

  try {
    const response = await callLM([
      { role: 'system', content: 'Kamu adalah AI yang mengekstrak informasi dari percakapan customer service. Berikan hasil dalam format JSON yang valid.' },
      { role: 'user', content: extractionPrompt }
    ], false);
    
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return {};
  } catch (error) {
    console.error('Error extracting info:', error);
    
    // Fallback extraction using simple pattern matching
    return extractInfoFallback(messages);
  }
}

function extractInfoFallback(messages) {
  const allText = messages.map(m => m.content).join(' ').toLowerCase();
  const info = {};
  
  // Extract name (simple pattern)
  const nameMatch = allText.match(/nama\s+(?:saya\s+)?(?:adalah\s+)?([a-zA-Z\s]+)/i);
  if (nameMatch) {
    info.full_name = nameMatch[1].trim();
  }
  
  // Extract category
  if (allText.includes('tabungan') || allText.includes('debit') || allText.includes('atm')) {
    info.category = 'Tabungan';
  } else if (allText.includes('kartu kredit') || allText.includes('kredit')) {
    info.category = 'Kartu Kredit';
  } else if (allText.includes('giro') || allText.includes('cek')) {
    info.category = 'Giro';
  }
  
  // Extract account number
  const accountMatch = allText.match(/(?:rekening|nomor|account)[:\s]*(\d{10,16})/);
  if (accountMatch) {
    info.account_number = accountMatch[1];
  }
  
  // Extract contact preference
  if (allText.includes('telepon') || allText.includes('call')) {
    info.preferred_contact = 'call';
  } else if (allText.includes('chat') || allText.includes('pesan')) {
    info.preferred_contact = 'chat';
  }
  
  return info;
}

function determineChatAction(collected_info, messageCount) {
  if (messageCount <= 1) return 'greeting';
  if (!collected_info.full_name) return 'asking';
  if (!collected_info.category) return 'asking';
  if (!collected_info.description) return 'collecting';
  if (collected_info.category === 'Tabungan' && !collected_info.account_number) return 'collecting';
  if (!collected_info.preferred_contact) return 'collecting';
  if (collected_info.preferred_contact === 'call' && !collected_info.standby_call_window) return 'collecting';
  return 'completed';
}

function generateSuggestions(action, collected_info) {
  if (!collected_info.category) {
    return ['Tabungan', 'Kartu Kredit', 'Giro', 'Lainnya'];
  }
  if (!collected_info.preferred_contact) {
    return ['Telepon', 'Chat'];
  }
  return [];
}

function createChatSession() {
  return {
    id: crypto.randomUUID(),
    created_at: new Date(),
    messages: [],
    collected_info: {
      full_name: null,
      category: null,
      subcategory: null,
      description: null,
      account_number: null,
      preferred_contact: null,
      standby_call_window: null,
      priority: 'Medium'
    },
    current_step: 'greeting',
    is_complete: false
  };
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

  // Build conversation context
  const conversationHistory = session.messages.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'assistant',
    content: msg.content
  }));

  // Add context about current state
  const greeting = getTimeBasedGreeting();
  const contextMessage = `
Informasi yang sudah dikumpulkan: ${JSON.stringify(session.collected_info, null, 2)}
Percakapan ke-${session.messages.length}.
Waktu saat ini: ${greeting} (${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })})

Berdasarkan konteks di atas, berikan respons yang sesuai. Gunakan sapaan waktu yang tepat jika ini adalah awal percakapan.
  `.trim();

  // Get SLA information based on conversation context
  const lastUserMessage = userMessage || '';
  const preferredCategory = session.collected_info?.category || null;
  const slaMatches = searchSLA(lastUserMessage, preferredCategory, 2);
  const slaHintText = formatSLAHints(slaMatches);

  const messages = [
    { role: 'system', content: CHAT_SYSTEM_PROMPT },
    { role: 'system', content: contextMessage },
    ...(slaHintText ? [{ role: 'system', content: slaHintText }] : []),
    ...conversationHistory.slice(-6) // Keep last 6 messages for context
  ];

  try {
    // Get natural response from LLM
    const response = await callLM(messages, false);
    console.log('LLM Natural Response:', response);
    
    // Add bot response to session
    session.messages.push({
      role: 'assistant',
      content: response,
      timestamp: new Date()
    });

    // Extract information from the entire conversation
    const extractedInfo = await extractInfoFromConversation(session.messages);
    console.log('Extracted info:', extractedInfo);
    
    // Update collected info
    session.collected_info = { ...session.collected_info, ...extractedInfo };
    
    // Determine current action
    const action = determineChatAction(session.collected_info, session.messages.length);
    session.current_step = action;
    
    // Generate suggestions
    const suggestions = generateSuggestions(action, session.collected_info);
    
    // Check if conversation is complete
    const requiredFields = ['full_name', 'category', 'description'];
    const hasRequired = requiredFields.every(field => session.collected_info[field]);
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

function getFallbackResponse(messages) {
  const lastUserMessage = messages.filter(m => m.role === 'user').pop()?.content?.toLowerCase() || '';
  const greeting = getTimeBasedGreeting();
  
  // Simple fallback responses based on keywords
  if (lastUserMessage.includes('halo') || lastUserMessage.includes('hai')) {
    return `${greeting}! Selamat datang di layanan customer service bank. Untuk membantu Anda lebih baik, mohon berikan nama lengkap dan kategori masalah yang dihadapi (Tabungan/Kartu Kredit/Giro/Lainnya).`;
  }
  
  if (lastUserMessage.includes('nama')) {
    return 'Terima kasih atas informasinya. Sekarang mohon jelaskan kategori masalah yang Anda hadapi: Tabungan, Kartu Kredit, Giro, atau Lainnya?';
  }
  
  if (lastUserMessage.includes('tabungan') || lastUserMessage.includes('debit')) {
    return 'Terima kasih. Untuk masalah tabungan, mohon jelaskan detail masalah yang Anda hadapi dan berikan nomor rekening Anda.';
  }
  
  if (lastUserMessage.includes('kartu kredit') || lastUserMessage.includes('kredit')) {
    return 'Terima kasih. Untuk masalah kartu kredit, mohon jelaskan detail masalah yang Anda hadapi.';
  }
  
  return 'Terima kasih atas informasinya. Mohon berikan detail lebih lanjut mengenai masalah yang Anda hadapi agar kami dapat membantu dengan lebih baik.';
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
      kategori: extracted.category ?? null,
      subkategori: extracted.subcategory ?? null,
      ringkasan: extracted.description ?? null,
      kontak: extracted.preferred_contact ?? null,
      waktu_standby: extracted.standby_call_window ?? null
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
      kategori: merged.category ?? null,
      subkategori: merged.subcategory ?? null,
      ringkasan: merged.description ?? null,
      kontak: merged.preferred_contact ?? null,
      waktu_standby: merged.standby_call_window ?? null
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
