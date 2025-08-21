const crypto = require('crypto');
const { LM_BASE_URL, LM_API_KEY, LM_MODEL } = require('../config/config');
const { 
  STATES, 
  CHAT_SESSIONS, 
  validatePayload, 
  computeConfidence 
} = require('../services/chat-service');
const { processChatMessage } = require('../services/chat-processor');
const { extractJsonWithLM } = require('../services/lm-studio');
const { faqSearch } = require('../services/faq-service');
const { searchSLA } = require('../services/sla-service');
const { semanticAutocorrect, normalizeTimeWindow, inferPriority } = require('../utils/classification');

// -----------------------------
// Route Handlers
// -----------------------------

function setupRoutes(app) {
  // Health check
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

  // One-shot extraction endpoint - extracts complete information from single message
  app.post('/chat/extract', async (req, res) => {
    try {
      const { text } = req.body;
      
      if (!text || typeof text !== 'string' || text.trim() === '') {
        return res.status(400).json({ error: 'Text is required' });
      }

      // Use the extract logic directly
      let extracted = await extractJsonWithLM(text.trim());
      extracted = semanticAutocorrect(extracted, text.trim());

      // Validate & confidence
      const [valid, msg] = validatePayload(extracted);
      const confidence = Number(computeConfidence(extracted).toFixed(2));

      // Build summary in the requested format
      const summary = {
        nama: extracted.full_name ?? null,
        no_rekening: extracted.account_number ?? null,
        channel: extracted.channel ?? null,
        kategori: extracted.category ?? null,
        deskripsi: extracted.description ?? null
      };

      res.json({
        valid,
        message: valid ? 'Informasi berhasil diekstrak' : 'Data belum lengkap/valid.',
        confidence,
        extracted,
        summary,
        extraction_method: 'one_shot'
      });
    } catch (error) {
      console.error('One-shot extraction error:', error);
      res.status(500).json({ 
        error: 'internal_error', 
        detail: 'Terjadi kesalahan pada ekstraksi informasi.',
        message: 'Maaf, terjadi kesalahan saat memproses informasi Anda.'
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
}

module.exports = {
  setupRoutes
};
