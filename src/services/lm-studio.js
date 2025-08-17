const { LM_BASE_URL, LM_API_KEY, LM_MODEL, LM_TEMPERATURE } = require('../config/config');
const { getFallbackResponse } = require('../utils/prompts');

// -----------------------------
// LM Studio Integration
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
  const { EXTRACTION_SYSTEM, EXTRACTION_USER_TMPL } = require('../utils/prompts');
  const messages = [
    { role: 'system', content: EXTRACTION_SYSTEM },
    { role: 'user',   content: EXTRACTION_USER_TMPL(text) }
  ];
  
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

module.exports = {
  callLM,
  extractJsonWithLM
};
