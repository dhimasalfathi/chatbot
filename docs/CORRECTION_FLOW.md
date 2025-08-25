# Correction Flow Documentation

## 📋 Overview
Dokumentasi khusus untuk fitur **"Ada yang perlu diperbaiki"** - sistem koreksi data yang memungkinkan user memperbaiki informasi yang sudah dikumpulkan chatbot.

## 🔄 Flow Diagram

```
User: "Ada yang perlu diperbaiki"
          ↓
Bot: "Bagian mana yang perlu dikoreksi?"
          ↓
    ┌─────────────┬─────────────┬─────────────┐
    │   Channel   │  Kategori   │  Deskripsi  │
    │    salah    │    salah    │    salah    │
    └─────────────┴─────────────┴─────────────┘
          ↓             ↓             ↓
   Reset channel   Reset kategori  Reset deskripsi
   Ask channel     Ask kategori    Ask dengan LM
```

## 🎯 Problem yang Diselesaikan

### Before (Bug):
- User klik "Ada yang perlu diperbaiki" → Conversation end ❌
- Button "Channel salah", "Kategori salah", "Deskripsi salah" tidak berfungsi ❌
- Logic order conflict: correction logic terjadi setelah normal extraction ❌

### After (Fixed):
- User bisa request koreksi dan conversation continue ✅
- Specific correction buttons berfungsi dengan baik ✅
- Proper logic ordering: correction handling prioritas tertinggi ✅

## 🔧 Technical Implementation

### 1. Session State Management

#### Session Properties untuk Correction
```javascript
// Session structure yang mendukung correction
const session = {
  id: 'uuid',
  current_step: 'string',        // Current state: 'asking_correction'
  needs_confirmation: boolean,    // Flag for confirmation mode
  collected_info: {              // Data yang bisa dikoreksi
    channel: 'string',
    category: 'string', 
    description: 'string'
  },
  messages: []                   // Conversation history
};
```

#### Key States
```javascript
const CORRECTION_STATES = {
  ASKING_CORRECTION: 'asking_correction',    // Asking what to correct
  ASKING_CHANNEL: 'asking_channel',          // Re-asking channel
  ASKING_CATEGORY: 'asking_category',        // Re-asking category  
  ASKING_DESCRIPTION: 'asking_description'   // Re-asking description
};
```

### 2. Logic Flow Priority (CRITICAL)

#### File: `chat-processor.js`
**Line 219-320**: Correction handling logic placed at TOP of try block

```javascript
async function processChatMessage(sessionId, userMessage) {
  // ... session setup ...

  try {
    // 🔥 PRIORITY 1: Handle correction responses FIRST
    if (session.current_step === 'asking_correction') {
      // Handle specific corrections
      return handleSpecificCorrection(session, userMessage);
    }

    // 🔥 PRIORITY 2: Handle confirmation responses  
    if (session.needs_confirmation) {
      // Handle confirmation or correction requests
      return handleConfirmationResponse(session, userMessage);
    }

    // 🔥 PRIORITY 3: Normal extraction flow
    // Extract info and continue normal flow...
  }
}
```

### 3. Correction Detection Logic

#### Trigger Phrases
```javascript
const CORRECTION_TRIGGERS = [
  'ada yang perlu diperbaiki',
  'perlu diperbaiki', 
  'tidak benar',
  'salah',
  'perbaiki'
];

function detectCorrectionRequest(message) {
  const lowerMsg = message.toLowerCase().trim();
  return CORRECTION_TRIGGERS.some(trigger => lowerMsg.includes(trigger));
}
```

#### Specific Field Correction
```javascript
function detectFieldCorrection(message) {
  const lowerMsg = message.toLowerCase().trim();
  
  if (lowerMsg.includes('channel') || lowerMsg.includes('saluran')) {
    return 'channel';
  } else if (lowerMsg.includes('kategori') || lowerMsg.includes('category')) {
    return 'category';
  } else if (lowerMsg.includes('deskripsi') || lowerMsg.includes('description')) {
    return 'description';
  }
  
  return null;
}
```

### 4. Field Reset & Re-asking Logic

#### Channel Correction
```javascript
if (correctionText.includes('channel')) {
  // Reset channel and ask for it again
  session.collected_info.channel = null;
  session.current_step = 'asking_channel';
  session.needs_confirmation = false;
  
  const channelMessage = "Baik, channel mana yang benar? Silakan pilih channel yang Anda gunakan.";
  
  return {
    session_id: sessionId,
    message: channelMessage,
    action: 'asking_channel',
    suggestions: generateSuggestions('asking_channel', session.collected_info),
    collected_info: session.collected_info,
    is_complete: false,
    needs_confirmation: false
  };
}
```

#### Category Correction
```javascript
if (correctionText.includes('kategori')) {
  // Reset category and ask for it again
  session.collected_info.category = null;
  session.current_step = 'asking_category';
  session.needs_confirmation = false;
  
  const categoryMessage = "Baik, kategori mana yang benar? Silakan pilih jenis keluhan yang sesuai.";
  
  return {
    session_id: sessionId,
    message: categoryMessage,
    action: 'asking_category',
    suggestions: generateSuggestions('asking_category', session.collected_info),
    collected_info: session.collected_info,
    is_complete: false,
    needs_confirmation: false
  };
}
```

#### Description Correction (LM Model Integration)
```javascript
if (correctionText.includes('deskripsi')) {
  // Reset description and use LM model for re-extraction
  session.collected_info.description = null;
  if (session.collected_info.ai_generated_description) {
    delete session.collected_info.ai_generated_description;
  }
  session.current_step = 'asking_description';
  session.needs_confirmation = false;
  
  const descriptionMessage = "Baik, silakan berikan deskripsi yang benar. Jelaskan secara detail masalah yang Anda alami.";
  
  return {
    session_id: sessionId,
    message: descriptionMessage,
    action: 'asking_description',
    suggestions: [], // No suggestions for description
    collected_info: session.collected_info,
    is_complete: false,
    needs_confirmation: false
  };
}
```

## 🎮 User Experience Flow

### 1. Confirmation Stage
```
Bot: "📋 RINGKASAN KELUHAN ANDA
     🔗 Channel: Mobile Banking
     📂 Kategori: Transfer
     📝 Deskripsi: Transfer ke BCA gagal...
     
     Apakah data di atas sudah benar?"

Suggestions: ["Ya, data sudah benar", "Ada yang perlu diperbaiki"]
```

### 2. Correction Request
```
User: "Ada yang perlu diperbaiki"
          ↓
Bot: "Baik, ada yang perlu diperbaiki. Bisa Anda beritahu bagian mana yang perlu dikoreksi?"

Suggestions: ["Channel salah", "Kategori salah", "Deskripsi salah"]
```

### 3. Specific Correction Examples

#### Channel Correction
```
User: "Channel salah"
          ↓
Bot: "Baik, channel mana yang benar? Silakan pilih channel yang Anda gunakan."

Suggestions: ["Mobile Banking", "Internet Banking", "ATM", "CRM", ...]
```

#### Category Correction  
```
User: "Kategori salah"
          ↓
Bot: "Baik, kategori mana yang benar? Silakan pilih jenis keluhan yang sesuai."

Suggestions: ["PEMBAYARAN", "TRANSFER", "TOP UP", "TARIK TUNAI", ...]
```

#### Description Correction
```
User: "Deskripsi salah"
          ↓
Bot: "Baik, silakan berikan deskripsi yang benar. Jelaskan secara detail masalah yang Anda alami."

Suggestions: [] // No suggestions, free text input for LM processing
```

## 🔧 Configuration

### Suggestion Generation (chat-service.js)
```javascript
function generateSuggestions(action, collectedInfo) {
  switch (action) {
    case 'asking_channel':
      return [
        'Mobile Banking', 'Internet Banking', 'ATM', 'CRM',
        'MTUNAI ALFAMART', 'DISPUTE DEBIT', 'QRIS DEBIT'
      ];
      
    case 'asking_category':
      return [
        'PEMBAYARAN', 'TOP UP', 'TRANSFER', 'TARIK TUNAI',
        'SETOR TUNAI', 'MOBILE TUNAI', 'BI FAST', 'DISPUTE', 'LAINNYA'
      ];
      
    case 'asking_correction':
      return ['Channel salah', 'Kategori salah', 'Deskripsi salah'];
      
    case 'ready_for_confirmation':
      return ['Ya, data sudah benar', 'Ada yang perlu diperbaiki'];
      
    default:
      return [];
  }
}
```

### Channel & Category Data (channel_category.json)
```json
{
  "channels": [
    "ATM", "IBANK", "MBANK", "CRM", 
    "MTUNAI ALFAMART", "DISPUTE DEBIT", "QRIS DEBIT"
  ],
  "categories": [
    "PEMBAYARAN", "TOP UP", "TRANSFER", "TARIK TUNAI",
    "SETOR TUNAI", "MOBILE TUNAI", "BI FAST", "DISPUTE", "LAINNYA"
  ]
}
```

## 🐛 Bug Fixes Applied

### 1. Logic Order Issue
**Problem**: Correction logic executed after normal extraction
**Solution**: Moved correction handling to top of try block (line 219)

**Before**:
```javascript
try {
  // Normal extraction first
  extractedInfo = extractInfoSimple(userMessage, currentAction);
  
  // Correction handling (too late!)
  if (session.current_step === 'asking_correction') {
    // This never executed because extraction reset the state
  }
}
```

**After**:
```javascript
try {
  // Correction handling FIRST (line 219)
  if (session.current_step === 'asking_correction') {
    return handleSpecificCorrection(session, userMessage);
  }
  
  // Then normal extraction
  extractedInfo = extractInfoSimple(userMessage, currentAction);
}
```

### 2. Duplicate Code Elimination
**Problem**: Correction logic duplicated in multiple places
**Solution**: Consolidated into single location at top of function

### 3. State Management Fix
**Problem**: `needs_confirmation` flag not properly reset during corrections
**Solution**: Explicit flag management:

```javascript
// When entering correction mode
session.needs_confirmation = false;
session.current_step = 'asking_correction';

// When correcting specific field
session.needs_confirmation = false;
session.current_step = 'asking_[field]';
```

## 📊 Testing Scenarios

### Test Case 1: Basic Correction Flow
```
1. Complete conversation to confirmation stage
2. User: "Ada yang perlu diperbaiki"
3. Verify: Bot asks what to correct with proper suggestions
4. User: "Channel salah"  
5. Verify: Bot re-asks channel with proper suggestions
6. User: "ATM"
7. Verify: Conversation continues normally
```

### Test Case 2: Multiple Corrections
```
1. Complete conversation to confirmation stage
2. User: "Ada yang perlu diperbaiki"
3. User: "Channel salah"
4. User: "Internet Banking"
5. Verify: Back to confirmation with updated data
6. User: "Ada yang perlu diperbaiki" (again)
7. User: "Kategori salah"
8. Verify: System handles multiple correction rounds
```

### Test Case 3: Description Correction with LM
```
1. Complete conversation to confirmation stage
2. User: "Ada yang perlu diperbaiki"
3. User: "Deskripsi salah"
4. User: "Masalah sebenarnya adalah transfer gagal karena limit"
5. Verify: LM Studio processes new description
6. Verify: Generated summary updates properly
```

## 🚨 Error Handling

### Invalid Correction Request
```javascript
if (!fieldToCorrect) {
  const genericMessage = "Mohon sebutkan secara spesifik bagian mana yang perlu diperbaiki. Apakah itu Channel, Kategori, atau Deskripsi?";
  
  return {
    message: genericMessage,
    action: 'asking_correction',
    suggestions: ['Channel salah', 'Kategori salah', 'Deskripsi salah']
  };
}
```

### Session State Validation
```javascript
function validateCorrectionState(session) {
  if (!session.current_step) {
    session.current_step = 'greeting';
  }
  
  if (session.needs_confirmation === undefined) {
    session.needs_confirmation = false;
  }
  
  return session;
}
```

## 🔍 Debugging

### Enable Debug Logging
```javascript
// Add at top of correction handling
console.log('🔧 Correction Debug:', {
  current_step: session.current_step,
  user_message: userMessage,
  needs_confirmation: session.needs_confirmation,
  collected_info: session.collected_info
});
```

### Monitor State Transitions
```javascript
function logStateTransition(from, to, reason) {
  console.log(`🔄 State: ${from} → ${to} (${reason})`);
}

// Usage
logStateTransition(session.current_step, 'asking_channel', 'Channel correction requested');
```

## 📈 Performance Considerations

### Session Memory Management
- Correction flow tidak menambah memory overhead
- Session state tetap menggunakan struktur yang sama
- No additional data structures required

### Response Time
- Correction responses menggunakan template (fast)
- Only description correction uses LM Studio (slower)
- Average response time: <100ms (except description)

## 🎯 Future Enhancements

### 1. Partial Corrections
```javascript
// Allow correcting multiple fields at once
User: "Channel dan kategori salah"
Bot: "Baik, mari perbaiki channel dan kategori..."
```

### 2. Correction History
```javascript
// Track what was corrected
session.correction_history = [
  { field: 'channel', old_value: 'MBANK', new_value: 'ATM', timestamp: Date }
];
```

### 3. Smart Suggestions
```javascript
// Suggest likely corrections based on context
if (previous_error_pattern) {
  suggestions = getSmartSuggestions(session.collected_info);
}
```

## 📞 Support

### Common Issues
1. **"Correction button tidak berfungsi"** → Check logic order in chat-processor.js line 219
2. **"Conversation end setelah correction"** → Verify `needs_confirmation` flag management
3. **"Description correction tidak pakai LM"** → Check `asking_description` action handling

### Debug Commands (Development)
```javascript
// Check session state
console.log('Debug session:', CHAT_SESSIONS.get(sessionId));

// Test correction detection  
console.log('Correction detected:', detectCorrectionRequest(userMessage));

// Verify suggestions
console.log('Suggestions:', generateSuggestions('asking_correction', {}));
```

---

**Last Updated**: August 2025  
**Version**: 1.0.0  
**Critical Fix**: Correction flow logic ordering (line 219, chat-processor.js)
