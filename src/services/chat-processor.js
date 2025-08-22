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
const { extractJsonWithLM } = require('./lm-studio');
const { semanticAutocorrect } = require('../utils/classification');
const { getTimeBasedGreeting } = require('../utils/prompts');

// -----------------------------
// Helper Functions
// -----------------------------

/**
 * Detects if user message contains comprehensive information that can be extracted in one shot
 */
function detectCompleteInformation(message) {
  const lowerMsg = message.toLowerCase();
  
  // Check for key indicators of complete complaint
  const hasComplaintKeywords = ['komplain', 'keluhan', 'masalah', 'error', 'tidak bisa', 'gagal', 'salah', 'bermasalah', 'trouble'];
  const hasPersonalInfo = /\b(nama|saya|account|rekening|nomor)\b/i.test(message);
  const hasNumbers = /\d{8,}/i.test(message); // Account numbers typically long
  
  // Count information density
  const infoIndicators = [
    hasComplaintKeywords.some(keyword => lowerMsg.includes(keyword)),
    hasPersonalInfo,
    hasNumbers,
    message.length > 50, // Reasonably detailed message
    /\b(kartu kredit|mobile banking|internet banking|atm|transfer|gopay|tagihan|biometric|login|saldo|mutasi|tabungan|giro)\b/i.test(message)
  ];
  
  const infoScore = infoIndicators.filter(Boolean).length;
  
  // If message seems comprehensive enough, try one-shot extraction
  return infoScore >= 3;
}

/**
 * Process message using one-shot extraction via /extract endpoint logic
 */
async function processWithExtract(message) {
  try {
    console.log('🔍 Attempting one-shot extraction for message:', message.substring(0, 100) + '...');
    
    // 1) Extract JSON via LLM
    let extracted = await extractJsonWithLM(message);
    console.log('✅ Extracted data:', extracted);

    // 2) Semantic autocorrect
    extracted = semanticAutocorrect(extracted, message);
    console.log('✅ After semantic autocorrect:', extracted);

    // 3) Build summary in the expected format
    const summary = {
      nama: extracted.full_name ?? null,
      no_rekening: extracted.account_number ?? null,
      channel: extracted.channel ?? null,
      kategori: extracted.category ?? null,
      deskripsi: extracted.description ?? null
    };
    
    // Check how many fields were successfully extracted
    const filledFields = Object.values(summary).filter(val => val !== null && val !== '').length;
    
    console.log(`✅ One-shot extraction success: ${filledFields}/5 fields filled`);
    
    return {
      success: true,
      extracted,
      summary,
      filledFields
    };
    
  } catch (error) {
    console.error('❌ One-shot extraction failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

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
    // Check if the first message contains comprehensive information for one-shot extraction
    if (detectCompleteInformation(userMessage)) {
      console.log('🚀 Detected comprehensive first message, attempting one-shot extraction...');
      
      const extractResult = await processWithExtract(userMessage);
      
      if (extractResult.success && extractResult.filledFields >= 2) {
        // Successfully extracted substantial information
        console.log('✅ One-shot extraction successful, auto-filling session data');
        
        // Update session with extracted information
        Object.keys(extractResult.extracted).forEach(key => {
          if (extractResult.extracted[key] !== null && extractResult.extracted[key] !== '') {
            session.collected_info[key] = extractResult.extracted[key];
          }
        });
        
        // Create a comprehensive response showing what was extracted
        const extractedSummary = `
🎯 Terima kasih! Saya telah memahami keluhan Anda. Berikut informasi yang berhasil saya catat:

📋 **RINGKASAN KELUHAN ANDA**

 **Channel**: ${extractResult.summary.channel || '❓ _Belum diketahui_'}
📂 **Kategori**: ${extractResult.summary.kategori || '❓ _Belum diketahui_'}
📝 **Deskripsi**: ${extractResult.summary.deskripsi || '❓ _Belum diketahui_'}

${extractResult.filledFields < 3 ? 
'⚠️ Beberapa informasi masih kurang lengkap. Saya akan membantu melengkapinya.' : 
'✅ Informasi sudah lengkap!'}

Apakah data di atas sudah benar? Jika ada yang perlu diperbaiki atau dilengkapi, silakan beritahu saya.
        `.trim();
        
        session.messages.push({
          role: 'assistant',
          content: extractedSummary,
          timestamp: new Date()
        });
        
        // Determine what to do next based on completeness
        const missingFields = [];
        if (!extractResult.summary.channel) missingFields.push('channel');
        if (!extractResult.summary.kategori) missingFields.push('kategori');
        if (!extractResult.summary.deskripsi) missingFields.push('deskripsi');
        
        let suggestions = [];
        let nextAction = 'ready_for_confirmation';
        
        if (missingFields.length > 0) {
          // Still need some information
          nextAction = 'asking_missing_info';
          suggestions = [
            'Ya, data sudah benar',
            'Ada yang perlu diperbaiki',
            ...missingFields.map(field => `Tambahkan ${field}`)
          ];
        } else {
          // All information complete, ready for confirmation
          session.needs_confirmation = true;
          suggestions = [
            'Ya, data sudah benar',
            'Ada yang perlu diperbaiki'
          ];
        }
        
        return {
          session_id: sessionId,
          message: extractedSummary,
          action: nextAction,
          next_question: null,
          suggestions: suggestions,
          collected_info: session.collected_info,
          is_complete: false,
          confidence: computeConfidence(session.collected_info),
          extraction_method: 'one_shot',
          extracted_summary: extractResult.summary
        };
      }
    }
    
    // Fallback to normal greeting flow
    const greeting = getTimeBasedGreeting();
    const welcomeMessage = 
    `${greeting} Terima kasih sudah menghubungi B-Care. 
    Saya BNI Assistant akan dengan senang hati membantu Anda hari ini.
    Untuk membantu menyelesaikan masalah Anda, bisa Anda beri tahu saya channel atau platform yang Anda gunakan saat mengalami masalah ini?`;

    session.messages.push({
      role: 'assistant',
      content: welcomeMessage,
      timestamp: new Date()
    });
    
    return {
      session_id: sessionId,
      message: welcomeMessage,
      action: 'asking_channel',
      next_question: null,
      suggestions: ['Mobile Banking', 'Internet Banking', 'ATM', 'Kantor Cabang', 'Call Center', 'SMS Banking'],
      collected_info: session.collected_info,
      is_complete: false,
      confidence: computeConfidence(session.collected_info)
    };
  }

  try {
    // Handle correction responses FIRST - before any other processing
    if (session.current_step === 'asking_correction') {
      const correctionText = userMessage.toLowerCase().trim();
      
      console.log('Processing correction request:', correctionText);
      
      if (correctionText.includes('channel') || correctionText.includes('saluran')) {
        // Reset channel and ask for it again
        console.log('Resetting channel field');
        session.collected_info.channel = null;
        session.current_step = 'asking_channel';
        session.needs_confirmation = false;
        
        const channelMessage = "Baik, channel mana yang benar? Silakan pilih channel yang Anda gunakan saat mengalami masalah ini.";
        
        // Add new bot message instead of replacing the last one
        session.messages.push({
          role: 'assistant',
          content: channelMessage,
          timestamp: new Date()
        });
        
        return {
          session_id: sessionId,
          message: channelMessage,
          action: 'asking_channel',
          next_question: null,
          suggestions: generateSuggestions('asking_channel', session.collected_info),
          collected_info: session.collected_info,
          is_complete: false,
          confidence: computeConfidence(session.collected_info),
          needs_confirmation: false
        };
      } else if (correctionText.includes('kategori') || correctionText.includes('category')) {
        // Reset category and ask for it again
        console.log('Resetting category field');
        session.collected_info.category = null;
        session.current_step = 'asking_category';
        session.needs_confirmation = false;
        
        const categoryMessage = "Baik, kategori mana yang benar? Silakan pilih jenis keluhan yang sesuai dengan masalah Anda.";
        
        // Add new bot message instead of replacing the last one
        session.messages.push({
          role: 'assistant',
          content: categoryMessage,
          timestamp: new Date()
        });
        
        return {
          session_id: sessionId,
          message: categoryMessage,
          action: 'asking_category',
          next_question: null,
          suggestions: generateSuggestions('asking_category', session.collected_info),
          collected_info: session.collected_info,
          is_complete: false,
          confidence: computeConfidence(session.collected_info),
          needs_confirmation: false
        };
      } else if (correctionText.includes('deskripsi') || correctionText.includes('description')) {
        // Reset description and ask for it again - will use LM model
        console.log('Resetting description field - will use LM extraction');
        session.collected_info.description = null;
        if (session.collected_info.ai_generated_description) {
          delete session.collected_info.ai_generated_description;
        }
        session.current_step = 'asking_description';
        session.needs_confirmation = false;
        
        const descriptionMessage = "Baik, silakan berikan deskripsi yang benar. Jelaskan secara detail masalah yang Anda alami, kapan terjadi, dan langkah apa yang sudah Anda coba.";
        
        // Add new bot message instead of replacing the last one
        session.messages.push({
          role: 'assistant',
          content: descriptionMessage,
          timestamp: new Date()
        });
        
        return {
          session_id: sessionId,
          message: descriptionMessage,
          action: 'asking_description',
          next_question: null,
          suggestions: [],
          collected_info: session.collected_info,
          is_complete: false,
          confidence: computeConfidence(session.collected_info),
          needs_confirmation: false
        };
      } else {
        // Generic correction message if user doesn't specify what to correct
        console.log('User response not recognized, asking for clarification');
        const genericCorrectionMessage = "Mohon sebutkan secara spesifik bagian mana yang perlu diperbaiki. Apakah itu Channel, Kategori, atau Deskripsi?";
        
        // Add new bot message instead of replacing the last one
        session.messages.push({
          role: 'assistant',
          content: genericCorrectionMessage,
          timestamp: new Date()
        });
        
        return {
          session_id: sessionId,
          message: genericCorrectionMessage,
          action: 'asking_correction',
          next_question: null,
          suggestions: ['Channel salah', 'Kategori salah', 'Deskripsi salah'],
          collected_info: session.collected_info,
          is_complete: false,
          confidence: computeConfidence(session.collected_info),
          needs_confirmation: false
        };
      }
    }

    // Handle user confirmation response
    if (session.needs_confirmation) {
      const userMsgLower = userMessage.toLowerCase().trim();
      
      // Check for correction requests first (more specific)
      if (userMsgLower.includes('ada yang perlu diperbaiki') || 
          userMsgLower.includes('perlu diperbaiki') ||
          userMsgLower.includes('tidak benar') ||
          userMsgLower.includes('salah') ||
          userMsgLower.includes('perbaiki')) {
        
        console.log('User requested correction:', userMessage);
        
        // Reset confirmation and ask what needs to be corrected
        session.needs_confirmation = false;
        session.current_step = 'asking_correction';
        
        const correctionMessage = "Baik, ada yang perlu diperbaiki. Bisa Anda beritahu bagian mana yang perlu dikoreksi? Saya akan membantu memperbaiki data Anda.";
        
        session.messages[session.messages.length - 1].content = correctionMessage;
        
        return {
          session_id: sessionId,
          message: correctionMessage,
          action: 'asking_correction',
          next_question: null,
          suggestions: ['Channel salah', 'Kategori salah', 'Deskripsi salah'],
          collected_info: session.collected_info,
          is_complete: false,
          confidence: computeConfidence(session.collected_info),
          needs_confirmation: false
        };
      } 
      // Check for confirmation only if it's not a correction request
      else if (userMsgLower.includes('ya') || 
               userMsgLower.includes('benar') || 
               userMsgLower.includes('setuju') ||
               userMsgLower.includes('data sudah benar')) {
        
        console.log('User confirmed data:', userMessage);
        
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
      }
      // If neither confirmation nor correction is clearly detected, ask for clarification
      else {
        const clarificationMessage = "Mohon konfirmasi apakah data di atas sudah benar atau ada yang perlu diperbaiki?";
        
        session.messages[session.messages.length - 1].content = clarificationMessage;
        
        return {
          session_id: sessionId,
          message: clarificationMessage,
          action: 'ready_for_confirmation',
          next_question: null,
          suggestions: ['Ya, data sudah benar', 'Ada yang perlu diperbaiki'],
          collected_info: session.collected_info,
          is_complete: false,
          confidence: computeConfidence(session.collected_info),
          needs_confirmation: true
        };
      }
    }

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
    const requiredFields = ['channel', 'category', 'description'];
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

 Channel: ${summaryInfo.channel || 'Belum diisi'}

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
      const userMsgLower = userMessage.toLowerCase().trim();
      
      // Check for correction requests first (more specific)
      if (userMsgLower.includes('ada yang perlu diperbaiki') || 
          userMsgLower.includes('perlu diperbaiki') ||
          userMsgLower.includes('tidak benar') ||
          userMsgLower.includes('salah') ||
          userMsgLower.includes('perbaiki')) {
        
        console.log('User requested correction:', userMessage);
        
        // Reset confirmation and ask what needs to be corrected
        session.needs_confirmation = false;
        session.current_step = 'asking_correction';
        
        const correctionMessage = "Baik, ada yang perlu diperbaiki. Bisa Anda beritahu bagian mana yang perlu dikoreksi? Saya akan membantu memperbaiki data Anda.";
        
        session.messages[session.messages.length - 1].content = correctionMessage;
        
        return {
          session_id: sessionId,
          message: correctionMessage,
          action: 'asking_correction',
          next_question: null,
          suggestions: ['Channel salah', 'Kategori salah', 'Deskripsi salah'],
          collected_info: session.collected_info,
          is_complete: false,
          confidence: computeConfidence(session.collected_info),
          needs_confirmation: false
        };
      } 
      // Check for confirmation only if it's not a correction request
      else if (userMsgLower.includes('ya') || 
               userMsgLower.includes('benar') || 
               userMsgLower.includes('setuju') ||
               userMsgLower.includes('data sudah benar')) {
        
        console.log('User confirmed data:', userMessage);
        
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
      }
      // If neither confirmation nor correction is clearly detected, ask for clarification
      else {
        const clarificationMessage = "Mohon konfirmasi apakah data di atas sudah benar atau ada yang perlu diperbaiki?";
        
        session.messages[session.messages.length - 1].content = clarificationMessage;
        
        return {
          session_id: sessionId,
          message: clarificationMessage,
          action: 'ready_for_confirmation',
          next_question: null,
          suggestions: ['Ya, data sudah benar', 'Ada yang perlu diperbaiki'],
          collected_info: session.collected_info,
          is_complete: false,
          confidence: computeConfidence(session.collected_info),
          needs_confirmation: true
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
