# 🤖 Panduan Lengkap Chatbot Customer Service Bank

## 📍 Akses Chatbot
- **URL**: http://localhost:5000/chatbot
- **API**: http://localhost:5000/chat (untuk integrasi)

## 💬 Apa yang Bisa Dilakukan di Chatbot?

### 1. 🏦 **Keluhan Banking Umum**
```
Contoh pesan yang bisa dikirim:
• "Halo, saya ada masalah dengan ATM"
• "Kartu debit saya tertelan di mesin ATM"
• "Transfer saya gagal tapi uang sudah kepotong"
• "Tagihan kartu kredit tidak sesuai"
• "BG saya ditolak"
```

### 2. 🔍 **Informasi Otomatis yang Didapat**
Chatbot akan mengumpulkan:
- ✅ **Nama lengkap** nasabah
- ✅ **Kategori masalah** (Tabungan/Kartu Kredit/Giro/Lainnya)
- ✅ **Detail keluhan** yang spesifik
- ✅ **Nomor rekening** (untuk masalah tabungan/giro)
- ✅ **Preferensi kontak** (telepon/chat)
- ✅ **Waktu standby** (jika pilih telepon)

### 3. 📊 **Informasi SLA Otomatis**
Chatbot akan memberikan:
- ⏰ **Target waktu penyelesaian** (1-7 hari kerja)
- 🏢 **Unit yang menangani** (BCC, DGO, TBS)
- 📋 **Proses penanganan**
- 📝 **Deskripsi masalah yang relevan**

## 🎭 Contoh Percakapan Lengkap

### Scenario 1: Masalah ATM Transfer 💳

**User**: "Halo, saya ada masalah transfer ATM"

**Bot**: "Selamat datang di layanan customer service bank. Untuk membantu Anda lebih baik, mohon berikan nama lengkap terlebih dahulu."

**User**: "Nama saya Ahmad Rizki"

**Bot**: "Terima kasih Pak Ahmad. Mohon jelaskan detail masalah transfer ATM yang Anda alami?"

**User**: "Transfer saya ke rekening BNI lain gagal, tapi uang sudah kepotong dari rekening saya"

**Bot**: "Saya memahami situasi yang Anda alami. Untuk masalah Transfer Antar Rekening BNI, target penyelesaian adalah **1 hari kerja** dan akan ditangani oleh tim **BCC - Customer Care**.

Mohon berikan nomor rekening yang bermasalah?"

**User**: "Rekening saya 1234567890123"

**Bot**: "Terima kasih. Bagaimana preferensi kontak untuk follow-up? Apakah melalui telepon atau chat?"

**User**: "Telepon saja"

**Bot**: "Baik, kapan waktu yang tepat untuk menghubungi Anda? (format: HH:mm-HH:mm)"

**User**: "09:00-17:00"

**Bot**: "Terima kasih atas informasi lengkapnya. Keluhan Anda telah tercatat dengan detail:
- Nama: Ahmad Rizki  
- Masalah: Transfer gagal tapi rekening terdebet
- Rekening: 1234567890123
- Target penyelesaian: 1 hari kerja
- Tim penanganan: BCC - Customer Care
- Kontak: Telepon (09:00-17:00)"

### Scenario 2: Masalah Kartu Kredit 💳

**User**: "Hai, ada transaksi kartu kredit yang tidak saya kenali"

**Bot**: "Selamat datang di layanan customer service. Untuk masalah kartu kredit yang tidak dikenali, ini termasuk prioritas tinggi. Mohon berikan nama lengkap Anda?"

**User**: "Siti Aminah"

**Bot**: "Terima kasih Bu Siti. Untuk masalah Transaksi Tidak Dikenali Kartu Kredit, target penyelesaian adalah **1 hari kerja** dan akan ditangani oleh tim **BCC - Customer Care**.

Mohon jelaskan detail transaksi yang tidak dikenali tersebut?"

**User**: "Ada transaksi Rp 2.5 juta di merchant online yang tidak pernah saya lakukan"

**Bot**: "Saya memahami kekhawatiran Anda. Bagaimana preferensi kontak untuk follow-up investigasi ini?"

**User**: "Chat saja"

**Bot**: "Baik, keluhan Anda telah tercatat:
- Nama: Siti Aminah
- Masalah: Transaksi tidak dikenali Rp 2.5 juta
- Kategori: Kartu Kredit (Prioritas Tinggi)
- Target penyelesaian: 1 hari kerja  
- Tim: BCC - Customer Care
- Kontak: Chat

Tim kami akan segera menindaklanjuti untuk investigasi chargeback."

### Scenario 3: Top Up E-Wallet Gagal 📱

**User**: "Top up Gopay saya gagal tapi uang kepotong"

**Bot**: "Selamat datang. Mohon berikan nama lengkap untuk memproses keluhan top up Gopay?"

**User**: "Budi Santoso"

**Bot**: "Terima kasih Pak Budi. Untuk masalah Top Up Gopay, target penyelesaian adalah **5 hari kerja** dan akan ditangani oleh **DGO USER 1 (UIC6)**.

Mohon berikan nomor rekening yang terdebet?"

**User**: "1234567890"

**Bot**: "Bagaimana preferensi kontak untuk follow-up?"

**User**: "Telepon, siang hari antara 12-15"

**Bot**: "Keluhan tercatat:
- Nama: Budi Santoso
- Masalah: Top up Gopay gagal, rekening terdebet
- Rekening: 1234567890
- Target: 5 hari kerja
- Tim: DGO USER 1 (UIC6)
- Kontak: Telepon (12:00-15:00)"

## 🎯 Fitur Khusus Chatbot

### 1. **Smart Category Detection** 🧠
- Otomatis mendeteksi kategori dari keluhan
- ATM/Debit → Tabungan
- Kartu Kredit → Kartu Kredit  
- BG/Cek → Giro

### 2. **Priority Assessment** ⚠️
- Fraud/Hilang/Dicuri → High Priority
- Lainnya → Medium Priority

### 3. **SLA Integration** 📊
- Memberikan info waktu penyelesaian real-time
- Menunjukkan unit yang bertanggung jawab
- Berbasis data CSV yang akurat

### 4. **Conversation Memory** 🧠
- Mengingat context percakapan
- Tidak perlu mengulang informasi
- Session-based tracking

## 🛠️ Tips Penggunaan

### ✅ **Yang Sebaiknya Dilakukan:**
- Berikan informasi sejelas mungkin
- Sebutkan nomor rekening jika ada
- Jelaskan kronologi masalah
- Berikan waktu yang tepat untuk dihubungi

### ❌ **Yang Sebaiknya Dihindari:**
- Informasi yang terlalu singkat
- Data sensitif seperti PIN/password
- Keluhan di luar banking (non-relevan)

## 📱 Akses & Kompatibilitas
- ✅ Desktop browser (Chrome, Firefox, Edge)
- ✅ Mobile browser
- ✅ API integration ready
- ✅ Real-time response

---

## 🚀 Mulai Chatbot Sekarang!
Buka: **http://localhost:5000/chatbot**

Coba kirim pesan: *"Halo, saya ada masalah dengan ATM"*
