const fs = require('fs');
const { parse: csvParse } = require('csv-parse/sync');

// -----------------------------
// SLA Data Management
// -----------------------------
let SLA_DATA = [];

function loadSLAData() {
  try {
    const csvPath = require('path').join(__dirname, '../../data/data_sheet_sla_extracted.csv');
    if (!fs.existsSync(csvPath)) {
      console.warn(`ℹ️ SLA CSV not found at ${csvPath} - skipping`);
      return;
    }
    
    const raw = fs.readFileSync(csvPath, 'utf8');
    const records = csvParse(raw, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });
    
    // Normalize and clean data
    SLA_DATA = records.map(r => ({
      no: r.No || r.NO || r.no || null,
      service: (r.Service || '').trim(),
      channel: (r.Channel || '').trim(),
      category: (r.Category || '').trim(),
      sla: (r.SLA || '').toString().trim(),
      uic: (r.UIC || '').replace(/\s+$/,'').trim(),
      keterangan: (r.Keterangan || '').replace(/\s+/g,' ').trim()
    }));
    
    console.log(`📚 Loaded ${SLA_DATA.length} SLA entries from CSV`);
    console.log(`📊 Sample entry:`, SLA_DATA[0] ? {
      service: SLA_DATA[0].service,
      channel: SLA_DATA[0].channel,
      sla: SLA_DATA[0].sla + ' hari'
    } : 'No data');
  } catch (e) {
    console.error('Failed to load SLA CSV:', e.message);
  }
}

function scoreSLARecord(rec, queryTokens, preferredCategory) {
  const haystack = `${rec.service} ${rec.channel} ${rec.category} ${rec.keterangan}`.toLowerCase();
  let score = 0;
  
  for (const token of queryTokens) {
    if (!token || token.length < 2) continue;
    if (haystack.includes(token)) score += 2;
  }
  
  // Boost score if category matches
  if (preferredCategory && rec.category.toLowerCase().includes(preferredCategory.toLowerCase())) {
    score += 3;
  }
  
  return score;
}

function searchSLA(query, preferredCategory = null, limit = 3) {
  if (!SLA_DATA || SLA_DATA.length === 0) return [];
  
  const q = String(query || '').toLowerCase();
  const tokens = q.split(/[^a-z0-9]+/).filter(w => w && w.length > 2);
  
  const scored = SLA_DATA
    .map(rec => ({ 
      rec, 
      score: scoreSLARecord(rec, tokens, preferredCategory) 
    }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(x => x.rec);
    
  return scored;
}

function formatSLAHints(records) {
  if (!records || records.length === 0) return null;
  
  const lines = records.map(r => 
    `- ${r.service} (${r.channel}) | ${r.category} | SLA: ${r.sla} hari | ${r.uic} | ${r.keterangan}`
  );
  
  return `Informasi SLA terkait:\n${lines.join('\n')}\n\nCatatan: SLA adalah target waktu penyelesaian complaint dalam hari kerja.`;
}

module.exports = {
  loadSLAData,
  searchSLA,
  formatSLAHints
};
