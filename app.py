# app.py
# ------------------------------------------------------------
# Chat-to-Form (MVP) with LM Studio (OpenAI-compatible server)
# ------------------------------------------------------------
# Requirements:
#   pip install "openai>=1.30,<2" flask pydantic flask-cors
#
# Env vars (opsional, punya default):
#   LM_BASE_URL=http://localhost:1234/v1
#   LM_API_KEY=lm-studio
#   LM_MODEL=qwen2.5-7b-instruct-q4_k_m
#
# Run:
#   export FLASK_APP=app.py
#   flask run --host=0.0.0.0 --port=5000
# ------------------------------------------------------------

import os
import re
import json
from typing import Optional, List, Tuple
from flask import Flask, request, jsonify
from flask_cors import CORS
from pydantic import BaseModel, Field
from openai import OpenAI

# -----------------------------
# Flask init & CORS
# -----------------------------
app = Flask(__name__)
CORS(app)

# -----------------------------
# LM Studio (OpenAI-compatible)
# -----------------------------
LM_BASE_URL = os.getenv("LM_BASE_URL", "http://localhost:1234/v1")
LM_API_KEY  = os.getenv("LM_API_KEY", "lm-studio")
LM_MODEL    = os.getenv("LM_MODEL", "qwen2.5-7b-instruct-1m")

client = OpenAI(base_url=LM_BASE_URL, api_key=LM_API_KEY)

# -----------------------------
# Pydantic schema (validator)
# -----------------------------
class ComplaintPayload(BaseModel):
    full_name: Optional[str] = None
    account_number: Optional[str] = None
    category: Optional[str] = Field(None, description="Tabungan|Giro|Kartu Kredit|Lainnya")
    subcategory: Optional[str] = None
    description: str
    priority: str = Field("Medium", description="Low|Medium|High")
    preferred_contact: Optional[str] = Field(None, description="call|chat|null")
    standby_call_window: Optional[str] = None
    attachments: List[str] = []

# -----------------------------
# Prompt (system + user template)
# -----------------------------
EXTRACTION_SYSTEM = (
    "You are a bank customer-care assistant for Indonesia. Extract a structured JSON from the user's complaint.\n\n"
    "Hard rules:\n"
    "- Output VALID JSON only (no prose).\n"
    "- Unknown fields = null.\n"
    "- category ∈ {Tabungan, Giro, Kartu Kredit, Lainnya}.\n"
    "- Use bahasa Indonesia for subcategory & description.\n"
    "- preferred_contact ∈ {call, chat, null}.\n"
    "- standby_call_window format: HH:mm-HH:mm (Asia/Jakarta).\n\n"
    "Classification rules (very important):\n"
    "- Jika menyebut: kartu debit / debit / ATM / rekening tabungan / tarik-setor tunai → category = Tabungan.\n"
    "- Jika menyebut: kartu kredit / CC / tagihan/limit/cicilan/chargeback/refund merchant → category = Kartu Kredit.\n"
    "- Jika menyebut: giro / bilyet giro (BG) / cek / inkaso / kliring → category = Giro.\n"
    "- Jika tidak yakin dengan kategori → category = null (jangan tebak).\n\n"
    "Subcategory hints:\n"
    "- Tabungan: “Kartu debit tertelan”, “Tarik tunai gagal”, “Saldo tidak sesuai”, “Kartu debit hilang”, “PIN terblokir”.\n"
    "- Kartu Kredit: “Transaksi tidak dikenali”, “Tagihan tidak sesuai”, “Kartu kredit hilang”, “Kena biaya tahunan”, “Limit tidak cukup”.\n"
    "- Giro: “BG tolak”, “Setoran cek pending”, “Inkaso terlambat”.\n\n"
    "Priority rules:\n"
    "- High jika ada kata kunci: “hilang”, “dicuri”, “fraud”, “transaksi tidak dikenal/tidak dikenali”, “akses tidak sah/ilegal”.\n"
    "- Selain itu default Medium (kecuali jelas Low).\n\n"
    "Time window:\n"
    "- Contoh masukan “13-15” → “13:00-15:00”; “13.30-15.45” → “13:30-15:45”.\n"
)

EXTRACTION_USER_TMPL = """Schema:
{{
  "full_name": "string|null",
  "account_number": "string|null",
  "category": "Tabungan|Giro|Kartu Kredit|Lainnya|null",
  "subcategory": "string|null",
  "description": "string",
  "priority": "Low|Medium|High",
  "preferred_contact": "call|chat|null",
  "standby_call_window": "string|null",
  "attachments": []
}}

Examples:
Input:
"Halo, kartu debit saya tertelan di ATM BNI Semarang semalam. Rekening 123456789012. Saya standby telepon 13-15."
Output:
{{
  "full_name": null,
  "account_number": "123456789012",
  "category": "Tabungan",
  "subcategory": "Kartu debit tertelan",
  "description": "Kartu debit tertelan di ATM BNI Semarang semalam.",
  "priority": "Medium",
  "preferred_contact": "call",
  "standby_call_window": "13:00-15:00",
  "attachments": []
}}

Input:
"Saya keberatan tagihan kartu kredit bulan ini, ada transaksi tidak saya kenal."
Output:
{{
  "full_name": null,
  "account_number": null,
  "category": "Kartu Kredit",
  "subcategory": "Transaksi tidak dikenali",
  "description": "Keberatan tagihan kartu kredit, ada transaksi tidak dikenali.",
  "priority": "High",
  "preferred_contact": null,
  "standby_call_window": null,
  "attachments": []
}}

Input:
"BG saya ditolak, tolong cek statusnya."
Output:
{{
  "full_name": null,
  "account_number": null,
  "category": "Giro",
  "subcategory": "BG tolak",
  "description": "Bilyet giro ditolak dan perlu pengecekan status.",
  "priority": "Medium",
  "preferred_contact": null,
  "standby_call_window": null,
  "attachments": []
}}

User complaint (free text):
\"\"\"{text}\"\"\"

Output only the JSON object, nothing else.
"""

# -----------------------------
# Heuristics & semantic autocorrect
# -----------------------------
KEYS = {
    "tabungan": [
        r"\bkartu\s*debit\b", r"\bdebit\b", r"\batm\b",
        r"\brekening(?!\s*kredit)\b", r"\btarik\b", r"\bsetor\b",
        r"\bbuku\s*tabungan\b", r"\bsaldo\b"
    ],
    "kredit": [
        r"\bkartu\s*kredit\b", r"\bcc\b", r"\blimit\b",
        r"\bcicilan\b", r"\bcharge\s*back\b", r"\bchargeback\b",
        r"\brefund\s*merchant\b", r"\btagihan\b"
    ],
    "giro": [
        r"\bgiro\b", r"\bbilyet\s*giro\b", r"\bbg\b",
        r"\bcek\b", r"\binkaso\b", r"\bkliring\b"
    ]
}
PRIO_HIGH = [
    r"\bhilang\b", r"\bdicuri\b", r"\bfraud\b",
    r"\btidak\s*kenal(i)?\b", r"\btidak\s*dikenal(i)?\b",
    r"\bakses\s*(tidak\s*sah|ilegal)\b"
]

def _match_any(text: str, patterns: List[str]) -> bool:
    return any(re.search(p, text, flags=re.I) for p in patterns)

def infer_category_subcategory_from_text(text: str) -> Tuple[Optional[str], Optional[str]]:
    t = text.lower()
    if _match_any(t, KEYS["kredit"]):
        return "Kartu Kredit", None
    if _match_any(t, KEYS["giro"]):
        return "Giro", None
    if _match_any(t, KEYS["tabungan"]):
        if re.search(r"tertelan", t): return "Tabungan", "Kartu debit tertelan"
        if re.search(r"hilang", t): return "Tabungan", "Kartu debit hilang"
        if re.search(r"tarik.*gagal|gagal.*tarik", t): return "Tabungan", "Tarik tunai gagal"
        if re.search(r"pin.*blok|blok.*pin", t): return "Tabungan", "PIN terblokir"
        return "Tabungan", None
    return None, None

def infer_priority(text: str, current: Optional[str]) -> str:
    if _match_any(text, PRIO_HIGH):
        return "High"
    return current if current in {"Low", "Medium", "High"} else "Medium"

def normalize_time_window(s: Optional[str]) -> Optional[str]:
    if not s:
        return None
    s = s.strip()
    s = s.replace(" ", "")
    s = s.replace(".", ":").replace("–", "-").replace("—", "-")
    m = re.fullmatch(r"(\d{1,2})(?::?(\d{2}))?-(\d{1,2})(?::?(\d{2}))?", s)
    if not m:
        return s  # biarkan apa adanya kalau pattern lain
    h1, m1, h2, m2 = m.group(1), m.group(2), m.group(3), m.group(4)
    h1 = int(h1); h2 = int(h2)
    m1 = int(m1) if m1 else 0
    m2 = int(m2) if m2 else 0
    if not (0 <= h1 <= 23 and 0 <= h2 <= 23 and 0 <= m1 <= 59 and 0 <= m2 <= 59):
        return s
    return f"{h1:02d}:{m1:02d}-{h2:02d}:{m2:02d}"

def semantic_autocorrect(payload: dict, original_text: str) -> dict:
    """Perbaiki category/subcategory/priority/time window bila meleset."""
    cat_hint, sub_hint = infer_category_subcategory_from_text(original_text)
    corrected = payload.copy()

    # Category & Subcategory
    if cat_hint and corrected.get("category") != cat_hint:
        corrected["category"] = cat_hint
    if not corrected.get("subcategory") and sub_hint:
        corrected["subcategory"] = sub_hint

    # Priority
    corrected["priority"] = infer_priority(original_text, corrected.get("priority"))

    # Time window normalization
    corrected["standby_call_window"] = normalize_time_window(corrected.get("standby_call_window"))

    return corrected

# -----------------------------
# LLM call helpers
# -----------------------------
def extract_json_with_lm(text: str) -> dict:
    """Panggil LM Studio untuk ekstraksi JSON. Ada JSON-mode + fallback regex."""
    messages = [
        {"role": "system", "content": EXTRACTION_SYSTEM},
        {"role": "user", "content": EXTRACTION_USER_TMPL.format(text=text)}
    ]
    # Coba JSON mode (jika model mendukung)
    try:
        resp = client.chat.completions.create(
            model=LM_MODEL,
            messages=messages,
            temperature=0.2,
            response_format={"type": "json_object"}
        )
        content = resp.choices[0].message.content
        return json.loads(content)
    except Exception:
        # Fallback tanpa response_format
        resp = client.chat.completions.create(
            model=LM_MODEL,
            messages=messages,
            temperature=0.2
        )
        raw = resp.choices[0].message.content.strip()
        # Ambil blok JSON jika ada teks di luar
        m = re.search(r"\{.*\}", raw, flags=re.S)
        return json.loads(m.group(0) if m else raw)

# -----------------------------
# Business validation
# -----------------------------
def validate_payload(d: dict) -> Tuple[bool, str]:
    ok_cat = {None, "Tabungan", "Giro", "Kartu Kredit", "Lainnya"}
    if d.get("category") not in ok_cat:
        return False, "Kategori tidak valid. Pilihan: Tabungan/Giro/Kartu Kredit/Lainnya."
    acc = d.get("account_number")
    if acc and not re.fullmatch(r"\d{10,16}", acc):
        return False, "Format nomor rekening tidak valid (10–16 digit)."
    if not d.get("description"):
        return False, "Deskripsi keluhan wajib diisi."
    ok_prio = {"Low", "Medium", "High"}
    if d.get("priority") not in ok_prio:
        return False, "Priority harus salah satu: Low/Medium/High."
    pref = d.get("preferred_contact")
    if pref not in {None, "call", "chat"}:
        return False, "preferred_contact harus call/chat/null."
    return True, "ok"

def compute_confidence(extracted: dict) -> float:
    filled = sum(1 for _, v in extracted.items() if v not in [None, "", []])
    base = 0.45 + 0.06 * filled
    # bonus kecil jika kategori & deskripsi terisi
    if extracted.get("category") and extracted.get("description"):
        base += 0.05
    return max(0.0, min(1.0, base))

# -----------------------------
# Routes
# -----------------------------
@app.get("/healthz")
def healthz():
    return jsonify({"status": "ok", "model": LM_MODEL})

@app.post("/chat")
def chat():
    body = request.get_json(force=True, silent=True) or {}
    text = (body.get("text") or "").strip()
    if not text:
        return jsonify({"error": "text kosong"}), 400

    # 1) Extract with LLM
    extracted = extract_json_with_lm(text)

    # 2) Semantic autocorrect (debit vs kredit, waktu, prioritas)
    extracted = semantic_autocorrect(extracted, text)

    # 3) Validate
    valid, msg = validate_payload(extracted)

    # 4) Confidence & summary
    confidence = round(compute_confidence(extracted), 2)
    summary = {
        "nama": extracted.get("full_name"),
        "kategori": extracted.get("category"),
        "subkategori": extracted.get("subcategory"),
        "ringkasan": extracted.get("description"),
        "kontak": extracted.get("preferred_contact"),
        "waktu_standby": extracted.get("standby_call_window"),
    }

    return jsonify({
        "valid": valid,
        "message": msg if valid else "Data belum lengkap/valid.",
        "confidence": confidence,
        "extracted": extracted,
        "summary": summary,
        "next_hint": None if valid else "Mohon lengkapi data yang kurang (mis. kategori/nomor rekening)."
    }), 200

# -----------------------------
# Main
# -----------------------------
if __name__ == "__main__":
    # Dev server. Untuk prod: pakai gunicorn/uvicorn + reverse proxy.
    app.run(host="0.0.0.0", port=5000, debug=False)
