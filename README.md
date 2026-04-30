# JAAI — O'zbekiston Jinoyatchilik Tahlili AI

O'zbekiston Respublikasi bo'yicha 2021–2025 yillar jinoyatchilik statistikasini tahlil qiluvchi va 2026-yilga LLM yordamida bashorat beruvchi premium veb-dashboard. Foydalanuvchi UI orqali hudud va jinoyat turini filtrlash, tarixiy dinamikani ko'rish va AI yordamchi bilan o'zbek tilida suhbatlashish imkoniga ega.

## Loyiha tuzilishi

```
JAAI/
├── app.py                       # FastAPI server (REST + SSE chat)
├── pipeline.py                  # Ma'lumot to'planishi, kengaytirish, prediction
├── config.py                    # Markaziy konfiguratsiya (yo'llar + AI)
├── requirements.txt
├── .env                         # API kalit (qo'lda yaratiladi)
├── crime_data.db                # SQLite DB (avtomatik yaratiladi)
├── predictions_2026.json        # AI bashoratlari (avtomatik yaratiladi)
├── clean_data/                  # Manba xlsx fayllari
│   ├── bosqinchilik.xlsx
│   ├── firibgarlik.xlsx
│   └── ...
└── static/
    ├── index.html
    ├── styles.css
    └── app.js
```

## O'rnatish

### 1. O'rnatish

- **Python 3.10+**

```bash
pip install -r requirements.txt
```

### 3. .env

- .env yaratilishi kerak

```
api=YOUR_API_KEY_HERE
```

### 4. Manba ma'lumotlarni joylashtirish

`clean_data/` papkasiga `.xlsx` fayllar qo'shing. Har bir fayl quyidagi tuzilishda bo'lishi kerak:

| Code | Hudud_lotin | 2021 | 2022 | 2023 | 2024 | 2025 |
|------|-------------|------|------|------|------|------|
| 1700 | O'zbekiston Respublikasi | 1344 | 913 | 762 | 680 | 540 |
| 1703 | Andijon viloyati | 84 | 63 | 55 | 45 | 38 |
| ... | ... | ... | ... | ... | ... | ... |

Fayl nomi jinoyat turi sifatida olinadi (masalan `bosqinchilik.xlsx` -> `Jinoyat_turi = "bosqinchilik"`).

## Ishga tushirish

```bash
python -u app.py
```

Brauzerda ochish: **<http://localhost:8000>**

## Boshqa LLM modelga o'tish

Barcha AI sozlamalari `config.py` ichidagi `# === AI AGENT CONFIG ===` banner orasida joylashgan. Shu blokni o'zgartirish kifoya:

```python
LLM_API_URL = "https://api.openai.com/v1/chat/completions"  # yangi endpoint
LLM_MODEL = "gpt-4o-mini"
LLM_API_KEY_PREFIX = "openai_key"   # .env dagi qator nomi
LLM_CHAT_TEMPERATURE = 0.5
LLM_PREDICT_TEMPERATURE = 0.3
```

## API endpointlari

| Method | Path | Vazifa |
|--------|------|--------|
| `GET` | `/` | UI (index.html) |
| `GET` | `/static/*` | Static fayllar |
| `GET` | `/api/data` | Tarixiy + bashorat ma'lumotlari (JSON) |
| `POST` | `/api/chat` | AI chat (Server-Sent Events streaming) |
| `DELETE` | `/api/chat/history/{session_id}` | Suhbat tarixini tozalash |


## Yangi ma'lumot qo'shish

`clean_data/` papkasiga yangi xlsx qo'ying yoki mavjudini o'zgartiring. Server ichidagi monitor har 60 soniyada papkani tekshiradi va o'zgarish bo'lsa pipelineni qayta ishga tushiradi (DB yangilanadi va predictions ham qayta yaratiladi).

Qo'lda majburiy yangilash uchun: `predictions_2026.json` faylini o'chirib serverni qayta ishga tushiring.

## Texnologiyalar

- **Backend:** FastAPI + uvicorn, SQLite, pandas, requests
- **AI:** 1pro.uz API (OpenAI-uyg'un, qwen3.6-35b model), DuckDuckGo web search
- **Frontend:** Vanilla JS (build step yo'q), CSS custom properties, SSE streaming
- **Storage:** SQLite (lokal fayl)
