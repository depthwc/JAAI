"""
Markaziy konfiguratsiya moduli.

PATHS — barcha fayl yo'llari __file__ ga nisbatan dinamik aniqlanadi.
Loyihani boshqa joyga ko'chirsangiz hech narsa o'zgartirish shart emas.

AI AGENT CONFIG — boshqa LLM modelga (OpenAI, Anthropic, Gemini va h.k.)
o'tish uchun faqat shu fayldagi "AI AGENT CONFIG" blokini o'zgartiring.
"""

import os
from pathlib import Path


# ============================================================
# ===================== PATHS (dinamik) ======================
# ============================================================
# Hammasi loyiha papkasi (config.py joylashgan papka) ga nisbatan.

BASE_DIR = Path(__file__).resolve().parent

CLEAN_DIR = BASE_DIR / 'clean_data'
RAW_DIR = BASE_DIR / 'raw_data'
STATIC_DIR = BASE_DIR / 'static'

DB_PATH = BASE_DIR / 'crime_data.db'
PREDICTIONS_PATH = BASE_DIR / 'predictions_2026.json'
PREDICTIONS_BACKUP_PATH = BASE_DIR / 'predictions_2026.json.backup'
INDEX_HTML = STATIC_DIR / 'index.html'
ENV_PATH = BASE_DIR / '.env'
RAW_OUTPUT_PATH = BASE_DIR / 'raw_output.txt'


# ============================================================
# ============================================================
# ============== AI AGENT CONFIG -SHU YERNI O'ZGARTIRING =====
# ============================================================
# Boshqa modelga o'tmoqchi bo'lsangiz quyidagilarni o'zgartiring:
#   1) LLM_API_URL          -yangi API endpoint
#   2) LLM_MODEL            -model nomi
#   3) LLM_API_KEY_ENV      -.env dagi kalit nomi
#   4) LLM_*_TEMPERATURE    -ijodiylik darajasi
#   5) build_chat_system_prompt() -chat agent xulqi va tili
#   6) PREDICT_SYSTEM_PROMPT      -bashorat agentining xulqi
#   7) build_predict_user_prompt() -bashorat uchun foydalanuvchi prompti
#
# AGAR API formati boshqacha bo'lsa (masalan Anthropic SDK), unda
# `app.py` va `pipeline.py` dagi `# === LLM CALL ===` bilan belgilangan
# bloklarni ham mos ravishda o'zgartirish kerak bo'ladi.
# ============================================================

# --- API endpoint va model ---
LLM_API_URL = "https://1pro.uz/v1/chat/completions"
LLM_MODEL = "qwen3.6-35b-a3b-fp8"

# .env faylida shu prefiks bilan boshlanuvchi qator izlanadi: "api=..."
LLM_API_KEY_PREFIX = "api"

# Soniya. Streaming bo'lgani uchun yuqori qo'yish mumkin.
LLM_REQUEST_TIMEOUT = 600

# Ijodiylik darajalari (0.0 = aniq/deterministik, 1.0 = ijodiy)
LLM_CHAT_TEMPERATURE = 0.5
LLM_PREDICT_TEMPERATURE = 0.3


def build_chat_system_prompt(region: str, crime_type: str, db_context: str, web_context: str) -> str:
    """Chat agent uchun system prompt. Boshqa tilga yoki uslubga o'tish uchun shu funksiyani o'zgartiring."""
    region_label = region if region and region != 'All' else 'Barchasi'
    crime_label = crime_type if crime_type and crime_type != 'All' else 'Barchasi'
    return f"""Siz 'JAAI'siz - O'zbekiston jinoyatchilik tahlili bo'yicha ilg'or AI yordamchisi.
Siz premium veb-dashboard ichida joylashgansiz va to'liq ma'lumotlar bazasiga kirish imkoningiz bor.

JORIY UI KONTEKSTI:
  Tanlangan hudud: '{region_label}'
  Tanlangan jinoyat turi: '{crime_label}'
Foydalanuvchi "shu yerda", "bu hudud" yoki "bu jinoyat" desa, yuqoridagi tanlovni nazarda tutadi.

==================== TO'LIQ MA'LUMOTLAR BAZASI (jonli) ====================
Quyida 2021-2025 yillar uchun BARCHA hudud × BARCHA jinoyat turlari bo'yicha
to'liq xom statistika, hudud reytinglari, jinoyat turlari dinamikasi va 2026-yil
bashoratlari berilgan. Foydalanuvchi savoliga javob berish uchun shu ma'lumotlardan
to'liq foydalaning - hech qanday ma'lumot yashirilmagan.
{db_context}
==========================================================================

WEB QIDIRUV NATIJALARI:
{web_context}

QAT'IY QOIDALAR:
- HAR DOIM faqat O'ZBEK TILIDA javob bering. Ingliz yoki rus tilida javob bermang.
- Aniq raqamlarga asoslangan, qisqa va aniq javob bering.
- Yuqoridagi to'liq DB dan kerakli raqamlarni topib, real statistikalar bilan asoslang.
- Bashorat haqida savol bo'lsa, "2026-YIL UCHUN BASHORATLAR" blokidan foydalaning.
- Foydalanuvchi savoliga to'g'ridan-to'g'ri javob bering, ortiqcha kirish so'zlarisiz.
- Suhbat tarixini eslab qoling va kontekstga mos javob bering.
- Agar ma'lumot DB da haqiqatan yo'q bo'lsa, "Bu haqda aniq ma'lumotim yo'q" deb ayting -taxminlardan saqlaning."""


PREDICT_SYSTEM_PROMPT = """Siz O'zbekiston bo'yicha jinoyatchilik statistikasi tahlilchisi va data-scientist siz.
Vazifangiz - tarixiy ma'lumotlar va joriy ijtimoiy-iqtisodiy kontekst asosida 2026-yil uchun har bir hudud va jinoyat turi bo'yicha bashorat berish.

JAVOB FORMATI: Faqat sof JSON, hech qanday markdown yoki ```kod``` bloki ishlatmang. Javob to'g'ridan-to'g'ri json.loads() orqali parse qilinishi kerak.

JSON struktura:
{
    "predictions": [
        {
            "region": "Hudud nomi (manba ma'lumotidagi kabi aynan)",
            "crime_type": "Jinoyat turi (manba ma'lumotidagi kabi aynan)",
            "expected_count_2026": 123,
            "probability_trend": "increase",
            "reasoning": "O'ZBEK TILIDA 1-2 jumla tushuntirish"
        }
    ]
}

QAT'IY QOIDALAR:
- "reasoning" maydoni HAR DOIM O'ZBEK TILIDA bo'lishi shart (ingliz tili emas).
- "probability_trend" faqat shu uchta qiymatdan biri: "increase", "decrease", "stable".
- "expected_count_2026" musbat butun son.
- Tahlil tarixiy trend, mintaqaviy o'ziga xosliklar va ijtimoiy omillarga asoslansin.
- Reasoning aniq raqamlarga murojaat qilsin (masalan: "2021-yildagi 84 tadan 2025-yilda 38 ga kamaygan trend...")."""


def build_predict_user_prompt(data_context: str, web_context: str) -> str:
    """Predictions uchun user prompt. Mavzu o'zgarsa shu yerni tahrirlang."""
    return f"""### Tarixiy jinoyatchilik ma'lumotlari (2021-2025):
{data_context}

### So'nggi web kontekst:
{web_context}

Tarixiy ma'lumotlardagi HAR BIR hudud va HAR BIR jinoyat turi uchun 2026-yil bashoratini yarating.
Eslatma: reasoning maydonini O'ZBEK TILIDA yozing, raqamlarga asoslangan tushuntirish bering."""


# ============================================================
# ============== AI AGENT CONFIG TUGADI ======================
# ============================================================


def load_api_key() -> str | None:
    """`.env` fayldan API kalitni o'qiydi. Topilmasa None qaytaradi."""
    if not ENV_PATH.exists():
        return None
    with open(ENV_PATH, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            if line.startswith(LLM_API_KEY_PREFIX) and '=' in line:
                return line.split('=', 1)[1].strip()
    return None


# String yo'llar -ba'zi kutubxonalar Path obyektini qabul qilmaydi
DB_PATH_STR = str(DB_PATH)
CLEAN_DIR_STR = str(CLEAN_DIR)
STATIC_DIR_STR = str(STATIC_DIR)
INDEX_HTML_STR = str(INDEX_HTML)
PREDICTIONS_PATH_STR = str(PREDICTIONS_PATH)
PREDICTIONS_BACKUP_PATH_STR = str(PREDICTIONS_BACKUP_PATH)
RAW_OUTPUT_PATH_STR = str(RAW_OUTPUT_PATH)
