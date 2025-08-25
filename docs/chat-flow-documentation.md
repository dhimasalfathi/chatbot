# Chat Service Flow Documentation

## Overview
Dokumentasi ini menjelaskan alur kerja (flow) sistem chat service untuk pengumpulan data keluhan nasabah BNI B-Care dengan fokus pada proses perbaikan dan koreksi data.

## Chat Flow Struktur

### 1. Tahapan Utama Chat Flow

```
greeting → asking_channel → asking_category → asking_description → ready_for_confirmation → submission
```

### 2. Data Collection Schema

#### Required Fields (Wajib)
- `channel`: Platform yang digunakan nasabah
- `category`: Jenis keluhan 
- `description`: Deskripsi detail masalah

#### Optional Fields (Opsional)
- `full_name`: Nama lengkap nasabah (di-skip dalam flow saat ini)
- `account_number`: Nomor rekening (di-skip dalam flow saat ini)
- `preferred_contact`: Preferensi kontak ('chat' default)
- `priority`: Prioritas keluhan ('Medium' default)
- `standby_call_window`: Waktu siap dihubungi

## Flow Perbaikan Data (Data Correction Flow)

### 1. Trigger Kondisi Perbaikan

Sistem akan meminta konfirmasi dan perbaikan ketika:
- Semua required fields telah terisi
- Action berubah menjadi `ready_for_confirmation`
- User diminta untuk memverifikasi data

### 2. Proses Konfirmasi Data

```javascript
// Ketika action = 'ready_for_confirmation'
const action = determineChatAction(collected_info, messageCount);

if (action === 'ready_for_confirmation') {
  // Tampilkan ringkasan data untuk konfirmasi
  displayDataSummary(collected_info);
  // Berikan opsi: "Ya, data sudah benar" atau "Ada yang perlu diperbaiki"
}
```

### 3. Handling Perbaikan Data

#### Step 1: User Request Correction
```javascript
// Suggestions untuk konfirmasi
generateSuggestions('ready_for_confirmation');
// Returns: ['Ya, data sudah benar', 'Ada yang perlu diperbaiki']
```

#### Step 2: Identify Field to Correct
```javascript
// Jika user pilih "Ada yang perlu diperbaiki"
// Action berubah menjadi 'asking_correction'
generateSuggestions('asking_correction');
// Returns: ['Channel salah', 'Kategori salah', 'Deskripsi salah']
```

#### Step 3: Reset Specific Field
```javascript
// Berdasarkan pilihan user, reset field yang sesuai
if (userMessage.includes('Channel salah')) {
  collected_info.channel = null;
  current_step = 'asking_channel';
} else if (userMessage.includes('Kategori salah')) {
  collected_info.category = null;
  current_step = 'asking_category';
} else if (userMessage.includes('Deskripsi salah')) {
  collected_info.description = null;
  current_step = 'asking_description';
}
```

## Data Validation System

### 1. Field Validation Rules

#### Channel Validation
```javascript
const validChannels = [
  'ATM', 'IBANK', 'MBANK', 'CRM', 
  'MTUNAI ALFAMART', 'DISPUTE DEBIT', 'QRIS DEBIT'
];
```

#### Category Validation
```javascript
const validCategories = [
  'PEMBAYARAN', 'TOP UP', 'TRANSFER', 'TARIK TUNAI',
  'SETOR TUNAI', 'MOBILE TUNAI', 'BI FAST', 'DISPUTE', 'LAINNYA'
];
```

#### Description Validation
```javascript
// Description harus:
// - Tidak kosong
// - Minimal 10 karakter
// - Berisi penjelasan detail masalah
```

### 2. Confidence Scoring

```javascript
function computeConfidence(extracted) {
  const requiredFields = ['channel', 'category', 'description'];
  const filled = requiredFields.filter(field => {
    const value = extracted[field];
    return value !== null && value !== '' && value !== undefined;
  }).length;
  
  // Base confidence: 90% dari completion ratio
  let base = (filled / requiredFields.length) * 0.9;
  
  // Bonus 10% jika semua field required terisi
  if (filled === requiredFields.length) base += 0.1;
  
  return Math.max(0, Math.min(1, base));
}
```

## Information Extraction Methods

### 1. Context-Aware Extraction

```javascript
function extractInfoSimple(userMessage, currentAction) {
  // Ekstraksi berdasarkan step saat ini
  switch (currentAction) {
    case 'asking_channel':
      // Logic untuk extract channel dari user input
      break;
    case 'asking_category':
      // Logic untuk extract category dari user input
      break;
    case 'asking_description':
      // Logic untuk extract description dari user input
      break;
  }
}
```

### 2. AI-Generated Description Summary

```javascript
async function generateDescriptionSummary(messages, collected_info) {
  // Menggunakan LLM untuk membuat ringkasan profesional
  // Format: "Nasabah mengalami [masalah] saat [aktivitas] melalui [channel]"
  
  const summaryPrompt = `
  Berdasarkan percakapan customer service berikut, buatlah ringkasan singkat dan profesional...
  `;
}
```

## Template Responses

### 1. Step-by-Step Templates

```javascript
function getTemplateResponse(action, collected_info, userMessage) {
  switch (action) {
    case 'asking_channel':
      return "Terima kasih sudah menghubungi B-Care! Untuk membantu menyelesaikan masalah Anda, bisa Anda beri tahu saya channel atau platform yang Anda gunakan saat mengalami masalah ini?";
    
    case 'asking_category':
      return "Terima kasih sudah memberikan informasinya. Sekarang, untuk membantu kita mengatasi masalah Anda dengan cepat dan tepat, bisa Anda beri tahu saya jenis keluhan yang Anda alami?";
    
    case 'asking_description':
      return "Terima kasih sudah memberikan informasinya. Kategori keluhan telah dipilih. Sekarang, silakan beri saya deskripsi detail masalah yang Anda alami...";
  }
}
```

## Session Management

### 1. Chat Session Structure

```javascript
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
      ai_generated_description: null,
      preferred_contact: 'chat',
      standby_call_window: null,
      priority: 'Medium'
    },
    current_step: 'greeting',
    is_complete: false,
    needs_confirmation: false
  };
}
```

### 2. State Management

```javascript
// In-memory storage untuk conversation states
const STATES = new Map(); // sessionId -> conversation state
const CHAT_SESSIONS = new Map(); // sessionId -> chat session data
```

## Error Handling & Fallbacks

### 1. Validation Errors

```javascript
function validatePayload(data) {
  // Validasi semua field sebelum submission
  // Return [isValid, errorMessage]
  
  if (!validChannels.includes(data.channel)) {
    return [false, 'Channel tidak valid. Pilihan: ATM/IBANK/MBANK/...'];
  }
  
  if (!data.description || data.description.trim() === '') {
    return [false, 'Deskripsi keluhan wajib diisi.'];
  }
  
  return [true, 'ok'];
}
```

### 2. Fallback Mechanisms

```javascript
// Jika ekstraksi gagal, gunakan template response
// Jika AI summary gagal, buat summary sederhana
// Jika validation gagal, minta input ulang dengan guidance
```

## API Integration Points

### 1. Chat Processor Integration

```javascript
// File: chat-processor.js
// Menggunakan functions dari chat-service.js untuk:
// - createChatSession()
// - determineChatAction()
// - extractInfoSimple()
// - validatePayload()
// - generateSuggestions()
```

### 2. Socket.IO Integration

```javascript
// Real-time communication dengan frontend
// Mengirim suggestions, validasi errors, dan status updates
```

## Best Practices

### 1. User Experience
- Berikan feedback jelas pada setiap step
- Tampilkan pilihan yang tersedia (suggestions)
- Konfirmasi data sebelum submission
- Berikan opsi untuk memperbaiki data

### 2. Data Quality
- Validasi input pada setiap step
- Gunakan confidence scoring
- Generate professional summary dengan AI
- Maintain data consistency

### 3. Error Recovery
- Berikan pesan error yang informatif
- Guidance untuk input yang benar
- Fallback ke template jika AI gagal
- Reset field specific untuk koreksi

---

## Implementation Notes

- System skip asking untuk `full_name` dan `account_number` (dapat ditambahkan kembali jika diperlukan)
- Focus pada required fields: `channel`, `category`, `description`
- AI-generated summary sebagai backup untuk description
- Confidence threshold dapat disesuaikan sesuai kebutuhan
- Template responses dapat di-customize untuk brand voice yang sesuai
