// classification.js
// ------------------------------------------------------------
// Heuristics and Classification Rules
// ------------------------------------------------------------

const KEYS = {
  tabungan: [
    /\bkartu\s*debit\b/i, /\bdebit\b/i, /\batm\b/i,
    /\brekening(?!\s*kredit)\b/i, /\btarik\b/i, /\bsetor\b/i,
    /\bbuku\s*tabungan\b/i, /\bsaldo\b/i
  ],
  kredit: [
    /\bkartu\s*kredit\b/i, /\bcc\b/i, /\blimit\b/i,
    /\bcicilan\b/i, /\bcharge\s*back\b/i, /\bchargeback\b/i,
    /\brefund\s*merchant\b/i, /\btagihan\b/i
  ],
  giro: [
    /\bgiro\b/i, /\bbilyet\s*giro\b/i, /\bbg\b/i,
    /\bcek\b/i, /\binkaso\b/i, /\bkliring\b/i
  ]
};

const PRIO_HIGH = [
  /\bhilang\b/i, /\bdicuri\b/i, /\bfraud\b/i,
  /\btidak\s*kenal(i)?\b/i, /\btidak\s*dikenal(i)?\b/i,
  /\bakses\s*(tidak\s*sah|ilegal)\b/i
];

function matchAny(text, regexList) {
  return regexList.some((re) => re.test(text));
}

function inferCategorySubcategory(text) {
  const t = text.toLowerCase();
  if (matchAny(t, KEYS.kredit)) return { category: 'Kartu Kredit', subcategory: null };
  if (matchAny(t, KEYS.giro))   return { category: 'Giro', subcategory: null };
  if (matchAny(t, KEYS.tabungan)) {
    if (/tertelan/i.test(t)) return { category: 'Tabungan', subcategory: 'Kartu debit tertelan' };
    if (/hilang/i.test(t))   return { category: 'Tabungan', subcategory: 'Kartu debit hilang' };
    if (/tarik.*gagal|gagal.*tarik/i.test(t)) return { category: 'Tabungan', subcategory: 'Tarik tunai gagal' };
    if (/pin.*blok|blok.*pin/i.test(t)) return { category: 'Tabungan', subcategory: 'PIN terblokir' };
    return { category: 'Tabungan', subcategory: null };
  }
  return { category: null, subcategory: null };
}

function inferPriority(text, current) {
  if (matchAny(text, PRIO_HIGH)) return 'High';
  return ['Low', 'Medium', 'High'].includes(current) ? current : 'Medium';
}

function normalizeTimeWindow(s) {
  if (!s) return null;
  let v = String(s).trim();
  v = v.replace(/\s+/g, '');
  v = v.replace(/\./g, ':').replace(/[–—]/g, '-');
  const m = v.match(/^(\d{1,2})(?::?(\d{2}))?-(\d{1,2})(?::?(\d{2}))?$/);
  if (!m) return v;
  let [_, h1, m1, h2, m2] = m;
  h1 = parseInt(h1, 10); h2 = parseInt(h2, 10);
  m1 = m1 ? parseInt(m1, 10) : 0;
  m2 = m2 ? parseInt(m2, 10) : 0;
  if (![h1,h2,m1,m2].every(Number.isFinite)) return v;
  if (h1<0||h1>23||h2<0||h2>23||m1<0||m1>59||m2<0||m2>59) return v;
  return `${String(h1).padStart(2,'0')}:${String(m1).padStart(2,'0')}-${String(h2).padStart(2,'0')}:${String(m2).padStart(2,'0')}`;
}

function semanticAutocorrect(payload, originalText) {
  const { category, subcategory } = inferCategorySubcategory(originalText);
  const out = { ...payload };

  if (category && out.category !== category) out.category = category;
  if (!out.subcategory && subcategory) out.subcategory = subcategory;

  out.priority = inferPriority(originalText, out.priority);
  out.standby_call_window = normalizeTimeWindow(out.standby_call_window);

  return out;
}

module.exports = {
  KEYS,
  PRIO_HIGH,
  matchAny,
  inferCategorySubcategory,
  inferPriority,
  normalizeTimeWindow,
  semanticAutocorrect
};
