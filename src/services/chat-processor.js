const crypto = require('crypto');
const { 
  CHAT_SESSIONS, 
  extractInfoFromConversation, 
  extractInfoSimple,
  determineChatAction,
  generateSuggestions,
  generateDescriptionSummary,
  createChatSession,
  getTemplateResponse,
  computeConfidence
} = require('./chat-service');
const { getTimeBasedGreeting } = require('../utils/prompts');

// -----------------------------
// Main Chat Processing Function
// -----------------------------

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

module.exports = {
  processChatMessage
};
