# One-Shot Extraction Feature - Quick Start

## 🚀 What's New

Chatbot sekarang mendukung **One-Shot Extraction** - fitur yang memungkinkan user memberikan informasi keluhan lengkap dalam satu pesan, dan sistem akan otomatis mengekstrak semua data yang diperlukan menggunakan AI.

## 🎯 Contoh Penggunaan

### Input
```
Saya mau komplain kartu kredit, nama saya Ahmad Rizki, nomor rekening 1234567890123456, masalahnya limit kartu kredit tidak sesuai
```

### Output
```json
{
  "summary": {
    "nama": "Ahmad Rizki",
    "no_rekening": "1234567890123456",
    "channel": null,
    "kategori": "Kartu Kredit",
    "deskripsi": "Masalahnya limit kartu kredit tidak sesuai"
  }
}
```

## 🛠️ Cara Menggunakan

### 1. Endpoint Khusus
```bash
POST /chat/extract
Content-Type: application/json

{
  "text": "pesan lengkap dari user..."
}
```

### 2. Chat Flow Otomatis
Kirim pesan lengkap sebagai pesan pertama di `/chat` - sistem akan otomatis mendeteksi dan mengekstrak informasi.

## 🎨 Visual Indicator

Di web interface, sistem akan menampilkan indikator 🚀 ketika menggunakan one-shot extraction.

## 📁 Files yang Dimodifikasi

- `src/services/chat-processor.js` - Logika deteksi dan ekstraksi
- `src/routes/routes.js` - Endpoint `/chat/extract` baru
- `public/chatbot.html` - Visual indicator untuk one-shot extraction

## 🧪 Testing

```bash
# Demo tanpa server
node demo-one-shot-extraction.js

# Test dengan server running
node test-one-shot-extraction.js
```

## 📚 Dokumentasi Lengkap

Lihat `ONE_SHOT_EXTRACTION_GUIDE.md` untuk dokumentasi detail.
