# One-Shot Extraction Feature

## Overview
Fitur One-Shot Extraction memungkinkan user untuk memberikan informasi keluhan yang lengkap dalam satu pesan, dan sistem akan secara otomatis mengekstrak semua informasi yang diperlukan menggunakan LM model.

## Cara Kerja

### 1. Endpoint `/chat/extract`
Endpoint khusus untuk ekstraksi informasi lengkap dari satu pesan.

**Request:**
```json
{
  "text": "Saya mau komplain kartu kredit, nama saya Ahmad Rizki, nomor rekening 1234567890123456, masalahnya limit kartu kredit tidak sesuai"
}
```

**Response:**
```json
{
  "valid": true,
  "message": "Informasi berhasil diekstrak",
  "confidence": 0.85,
  "extracted": {
    "full_name": "Ahmad Rizki",
    "account_number": "1234567890123456",
    "channel": null,
    "category": "Kartu Kredit",
    "description": "Masalahnya limit kartu kredit tidak sesuai",
    "priority": "Medium",
    "preferred_contact": null
  },
  "summary": {
    "nama": "Ahmad Rizki",
    "no_rekening": "1234567890123456",
    "channel": null,
    "kategori": "Kartu Kredit",
    "deskripsi": "Masalahnya limit kartu kredit tidak sesuai"
  },
  "extraction_method": "one_shot"
}
```

### 2. Auto-Detection dalam Chat Flow
Ketika user mengirim pesan pertama yang mengandung informasi lengkap, sistem akan secara otomatis mendeteksi dan melakukan ekstraksi one-shot.

**Kriteria Detection:**
- Mengandung kata kunci keluhan (komplain, masalah, error, dll)
- Mengandung informasi personal (nama, rekening, dll)
- Mengandung nomor rekening (8+ digit)
- Panjang pesan > 50 karakter
- Mengandung kata kunci layanan (kartu kredit, mobile banking, dll)

**Contoh Chat Flow:**

**Input pertama:**
```json
{
  "message": "Selamat pagi, nama saya Siti Nurhaliza, nomor rekening 0020001234567890. Saya mengalami masalah saat melakukan transfer antar bank melalui mobile banking BNI. Setiap kali saya coba transfer ke bank lain, transaksi gagal dengan pesan error 'sistem sedang maintenance'. Sudah 3 hari ini masalahnya berlangsung."
}
```

**Response:**
```json
{
  "session_id": "uuid-here",
  "message": "🎯 Terima kasih! Saya telah memahami keluhan Anda. Berikut informasi yang berhasil saya catat:\n\n📋 **RINGKASAN KELUHAN ANDA**\n\n👤 **Nama**: Siti Nurhaliza\n💳 **No. Rekening**: 0020001234567890\n📱 **Channel**: Mobile Banking\n📂 **Kategori**: Transfer Antar Bank\n📝 **Deskripsi**: Saya mengalami masalah saat melakukan transfer antar bank melalui mobile banking BNI...\n\n✅ Informasi sudah lengkap!\n\nApakah data di atas sudah benar?",
  "action": "ready_for_confirmation",
  "suggestions": ["Ya, data sudah benar", "Ada yang perlu diperbaiki"],
  "collected_info": { /* extracted data */ },
  "is_complete": false,
  "confidence": 0.92,
  "extraction_method": "one_shot"
}
```

## Features

### 1. Smart Detection
- Deteksi otomatis pesan yang mengandung informasi lengkap
- Analisis tingkat kelengkapan informasi
- Fallback ke flow normal jika deteksi gagal

### 2. Comprehensive Extraction
- Ekstraksi nama lengkap
- Ekstraksi nomor rekening (format fleksibel)
- Deteksi channel/layanan
- Klasifikasi kategori keluhan
- Ekstraksi deskripsi masalah

### 3. Intelligent Responses
- Response yang disesuaikan dengan tingkat kelengkapan data
- Automatic summary formatting
- Suggestions yang relevan berdasarkan data yang tersedia

### 4. Visual Indicators
- Status indicator dengan emoji 🚀 untuk one-shot extraction
- Confidence meter yang akurat
- Clear formatting untuk summary data

## Testing

Gunakan file `test-one-shot-extraction.js` untuk menguji fitur:

```bash
node test-one-shot-extraction.js
```

## API Usage Examples

### Contoh 1: Informasi Lengkap
```bash
curl -X POST http://localhost:3000/chat/extract \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Saya Ahmad Budi, rekening 1234567890123456, masalah transfer mobile banking selalu gagal"
  }'
```

### Contoh 2: Informasi Parsial
```bash
curl -X POST http://localhost:3000/chat/extract \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Halo, saya Siti, ada masalah ATM tidak bisa withdraw"
  }'
```

### Contoh 3: Chat Flow dengan Auto-Detection
```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Selamat siang, nama saya John Doe, nomor rekening 0020001234567890. Saya mengalami masalah kartu kredit limit tidak sesuai yang dijanjikan saat pembukaan rekening"
  }'
```

## Benefits

1. **User Experience**: User dapat langsung menyampaikan keluhan lengkap tanpa harus melalui multiple steps
2. **Efficiency**: Mengurangi jumlah interaksi yang diperlukan untuk mengumpulkan informasi
3. **Accuracy**: Menggunakan LM model untuk ekstraksi yang lebih akurat
4. **Flexibility**: Tetap support flow normal untuk user yang prefer step-by-step
5. **Smart Fallback**: Jika deteksi gagal, sistem akan fallback ke flow normal

## Configuration

Konfigurasi detection sensitivity bisa disesuaikan di function `detectCompleteInformation()` dalam `chat-processor.js`:

```javascript
// Adjust minimum info score for detection
const infoScore = infoIndicators.filter(Boolean).length;
return infoScore >= 3; // Adjust threshold as needed
```
