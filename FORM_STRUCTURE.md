# Struktur Form Complain Baru

## Perubahan yang Dilakukan

Sistem chatbot telah diperbarui untuk menggunakan struktur form yang lebih lengkap dan sesuai dengan kebutuhan bank.

## Struktur Form Baru

### Field yang Dikumpulkan:
1. **Nama** - Nama lengkap nasabah
2. **No Rekening** - Nomor rekening (format: 002-000123-77099 atau 10-16 digit)
3. **Channel** - Channel yang digunakan saat terjadi masalah
4. **Category** - Kategori masalah yang dialami
5. **Deskripsi** - Penjelasan detail masalah

### Pilihan Channel:
- Mobile Banking
- Internet Banking
- ATM
- Kantor Cabang
- Call Center
- SMS Banking

### Pilihan Category:
- Top Up Gopay
- Transfer Antar Bank
- Pembayaran Tagihan
- Biometric/Login Error
- Saldo/Mutasi
- Tabungan
- Kartu Kredit
- Giro
- Lainnya

## Alur Percakapan

1. **Greeting** - Sapaan dan perkenalan
2. **Asking Name** - Menanyakan nama lengkap
3. **Asking Account** - Menanyakan nomor rekening
4. **Asking Channel** - Menanyakan channel yang digunakan
5. **Asking Category** - Menanyakan kategori masalah
6. **Asking Description** - Menanyakan deskripsi detail
7. **Ready for Confirmation** - Menampilkan summary dan meminta konfirmasi
8. **Completed** - Keluhan berhasil dicatat

## Fitur Summary Konfirmasi

Setelah semua informasi terkumpul, sistem akan menampilkan summary seperti:

```
📋 RINGKASAN KELUHAN ANDA

👤 Nama: Monica Butarbutar
💳 No. Rekening: 002-000123-77099
📱 Channel: Mobile Banking
📂 Kategori: Top Up Gopay
📝 Deskripsi: 011000

Apakah data di atas sudah benar? 
```

User dapat mengkonfirmasi atau meminta perbaikan sebelum keluhan benar-benar dicatat.

## Contoh Penggunaan

1. User: "Halo, saya mau complaint"
2. Bot: "Selamat pagi! Bisa saya tahu nama lengkap Anda?"
3. User: "Monica Butarbutar"
4. Bot: "Terima kasih. Bisa saya tahu nomor rekening Anda?"
5. User: "002-000123-77099"
6. Bot: "Baik. Channel mana yang Anda gunakan saat mengalami masalah?"
7. User: "Mobile Banking"
8. Bot: "Masalah apa yang Anda alami?"
9. User: "Top Up Gopay"
10. Bot: "Bisa jelaskan masalahnya lebih detail?"
11. User: "011000"
12. Bot: [Menampilkan summary konfirmasi]
13. User: "Ya, sudah benar"
14. Bot: "✅ Keluhan berhasil dicatat!"

## Validasi

- Nomor rekening harus dalam format yang benar
- Semua field wajib diisi
- Channel dan Category harus sesuai dengan pilihan yang tersedia
- Sistem menghitung kelengkapan data secara real-time
