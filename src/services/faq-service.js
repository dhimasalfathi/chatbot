// -----------------------------
// FAQ Service
// -----------------------------

const FAQS = [
  {
    q: ['cara blokir kartu debit', 'debit hilang', 'kartu debit hilang', 'blokir debit'],
    a: 'Untuk blokir kartu debit: buka aplikasi mobile banking → menu Kartu → Blokir Kartu, atau hubungi call center resmi. Siapkan data verifikasi (nama, tanggal lahir, 4 digit akhir rekening).'
  },
  {
    q: ['limit kartu kredit', 'cek limit kredit', 'sisa limit cc'],
    a: 'Cek limit kartu kredit melalui aplikasi mobile banking/website resmi pada menu Kartu Kredit → Informasi Limit, atau hubungi call center untuk informasi terbaru.'
  },
  {
    q: ['biaya admin tabungan', 'biaya bulanan tabungan'],
    a: 'Biaya admin tabungan bervariasi per jenis produk. Silakan cek brosur/website resmi produk tabungan atau tanyakan ke cabang terdekat.'
  },
  {
    q: ['chargeback', 'refund transaksi kartu kredit', 'transaksi tidak dikenali kartu kredit'],
    a: 'Untuk dispute/chargeback transaksi kartu kredit: laporkan maksimal 2×24 jam sejak mengetahui transaksi, isi formulir dispute, dan lampirkan bukti pendukung. Proses investigasi mengikuti ketentuan penerbit.'
  },
  {
    q: ['reset pin', 'lupa pin atm', 'pin terblokir'],
    a: 'PIN terblokir/lupa: lakukan reset via ATM (Jika tersedia), aplikasi, atau ke cabang dengan membawa identitas dan buku tabungan/kartu terkait.'
  }
];

function faqSearch(query) {
  const q = (query || '').toLowerCase();
  // Skor sederhana: jumlah kata kunci yang match
  let best = null;
  let bestScore = 0;
  for (const item of FAQS) {
    const score = item.q.reduce((acc, kw) => acc + (q.includes(kw) ? 1 : 0), 0);
    if (score > bestScore) { best = item; bestScore = score; }
  }
  if (best) return { answer: best.a, matched: best.q };
  return { answer: null, matched: [] };
}

module.exports = {
  faqSearch
};
