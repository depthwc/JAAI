from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse
import uvicorn
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
import sqlite3
import pandas as pd
import json
import os
import requests
from duckduckgo_search import DDGS
import asyncio
from pipeline import update_database_from_files, run_predictions
import config

app = FastAPI()

is_updating = False
last_modified_times = {}
# Yo'llar config dan olinadi (loyiha papkasiga nisbatan dinamik)
CLEAN_DIR = config.CLEAN_DIR_STR
DB_PATH = config.DB_PATH_STR

# Temporary in-memory conversation history: { session_id: [messages] }
conversation_history: dict = {}
MAX_HISTORY = 20  # har session uchun max xabar soni

async def monitor_clean_data():
    global is_updating
    while True:
        try:
            if not is_updating and os.path.exists(CLEAN_DIR):
                changed = False
                files = [f for f in os.listdir(CLEAN_DIR) if f.endswith('.xlsx')]
                
                # Check for new or modified files
                for f in files:
                    filepath = os.path.join(CLEAN_DIR, f)
                    mtime = os.path.getmtime(filepath)
                    if f not in last_modified_times or last_modified_times[f] < mtime:
                        last_modified_times[f] = mtime
                        changed = True
                        
                if changed:
                    print("Changes detected in clean_data. Starting update pipeline...")
                    is_updating = True
                    loop = asyncio.get_event_loop()
                    try:
                        db_updated = await loop.run_in_executor(None, update_database_from_files, CLEAN_DIR, DB_PATH)
                    except Exception as e:
                        print(f"Monitor: DB update failed: {e}")
                        db_updated = False
                    if db_updated:
                        try:
                            await loop.run_in_executor(None, run_predictions, DB_PATH, api_key)
                        except Exception as e:
                            print(f"Monitor: predictions failed: {e}")
                    is_updating = False
                    print("Update pipeline finished.")
        except Exception as e:
            print(f"Error in monitor loop: {e}")
            is_updating = False
            
        await asyncio.sleep(60)

@app.on_event("startup")
async def startup_event():
    global is_updating
    # Initialize modified times
    if os.path.exists(CLEAN_DIR):
        for f in os.listdir(CLEAN_DIR):
            if f.endswith('.xlsx'):
                last_modified_times[f] = os.path.getmtime(os.path.join(CLEAN_DIR, f))

    # --- DB mavjud emas yoki bo'sh bo'lsa -birinchi marta pipeline ishga tushirish ---
    predictions_path = config.PREDICTIONS_PATH_STR
    backup_path = config.PREDICTIONS_BACKUP_PATH_STR
    db_missing = not os.path.exists(DB_PATH)
    predictions_missing = not os.path.exists(predictions_path)

    if db_missing or predictions_missing:
        print("[Startup] Database yoki predictions topilmadi. Pipeline ishga tushirilmoqda...")
        is_updating = True
        loop = asyncio.get_event_loop()
        try:
            db_updated = await loop.run_in_executor(None, update_database_from_files, CLEAN_DIR, DB_PATH)
        except Exception as e:
            print(f"[Startup] DB yangilashda xatolik: {e}")
            db_updated = False

        if db_updated and predictions_missing:
            print("[Startup] DB yaratildi. Predictions generatsiya qilinmoqda...")
            try:
                await loop.run_in_executor(None, run_predictions, DB_PATH, api_key)
            except Exception as e:
                print(f"[Startup] Predictions yaratishda xatolik: {e}")
                if os.path.exists(backup_path):
                    import shutil
                    shutil.copy(backup_path, predictions_path)
                    print(f"[Startup] Backup tiklandi: predictions_2026.json (eski ingliz reasoning)")
                else:
                    print("[Startup] Backup ham yo'q. /api/data 503 qaytaradi.")    
        elif not db_updated:
            print("[Startup] OGOHLANTIRISH: clean_data papkasida xlsx fayl topilmadi yoki DB yangilanmadi!")
        is_updating = False
    else:
        print("[Startup] Database va predictions mavjud. Monitor ishga tushirildi.")

    asyncio.create_task(monitor_clean_data())

# Mount static folder
os.makedirs(config.STATIC_DIR_STR, exist_ok=True)
app.mount("/static", StaticFiles(directory=config.STATIC_DIR_STR), name="static")

# === LLM API kalitini config orqali yuklash ===
api_key = config.load_api_key()
if not api_key:
    print("[!] OGOHLANTIRISH: .env fayldan API kalit topilmadi. LLM chaqiruvlari ishlamaydi.")

@app.get("/api/data")
async def get_data():
    # 1. Load historical data
    conn = sqlite3.connect(DB_PATH)
    df = pd.read_sql('SELECT * FROM jinoyatlar_statistikasi', conn)
    conn.close()

    # Format historical
    history_dict = {}
    for (region, crime_type), group in df.groupby(['Hudud_lotin', 'Jinoyat_turi']):
        key = f"{region}_{crime_type}"
        history_dict[key] = {row['Yil']: row['Jinoyatlar_soni'] for _, row in group.iterrows()}

    # 2. Load predictions
    predictions_path = config.PREDICTIONS_PATH_STR
    if not os.path.exists(predictions_path):
        return JSONResponse(content={"error": "Predictions fayli hali yaratilmagan. Biroz kutib qaytadan urinib ko'ring."}, status_code=503)
    with open(predictions_path, 'r', encoding='utf-8') as f:
        predictions = json.load(f)['predictions']
        
    # 3. Merge
    merged_data = []
    for p in predictions:
        key = f"{p['region']}_{p['crime_type']}"
        hist = history_dict.get(key, {})
        merged_data.append({
            "region": p['region'],
            "crime_type": p['crime_type'],
            "history": hist,
            "prediction": {
                "expected_count_2026": p['expected_count_2026'],
                "probability_trend": p['probability_trend'],
                "reasoning": p['reasoning']
            }
        })
        
    return JSONResponse(content={"data": merged_data})

@app.post("/api/chat")
async def chat(request: Request):
    body = await request.json()
    user_message = body.get('message', '')
    ui_context = body.get('context', {})
    session_id = body.get('session_id', 'default')

    # --- Memory: suhbat tarixini yuklash ---
    if session_id not in conversation_history:
        conversation_history[session_id] = []
    history = conversation_history[session_id]

    loop = asyncio.get_running_loop()

    # 1. Web search — sinxron DDGS, event loopni bloklamasligi uchun executorda
    def do_web_search():
        try:
            with DDGS() as ddgs:
                results = ddgs.text(
                    f"Uzbekistan {ui_context.get('region', '')} {ui_context.get('crime_type', '')} {user_message}",
                    max_results=2
                )
                return "\n".join([f"- {r['title']}: {r['body']}" for r in results])
        except Exception as e:
            print("DuckDuckGo error:", e)
            return ""

    web_context = await loop.run_in_executor(None, do_web_search)

    # 2. DB ma'lumotlari — agentga jonli statistikani uzatamiz
    def fetch_db_context():
        try:
            conn = sqlite3.connect(DB_PATH)
            cur = conn.cursor()
            sel_region = ui_context.get('region') if ui_context.get('region') and ui_context.get('region') != 'All' else None
            sel_crime = ui_context.get('crime_type') if ui_context.get('crime_type') and ui_context.get('crime_type') != 'All' else None

            parts = []
            # 2025-yil eng yuqori 5 hudud
            top5 = cur.execute("""
                SELECT Hudud_lotin, Jami_2025, Reyting FROM region_rankings_2025 LIMIT 5
            """).fetchall()
            parts.append("2025-yilda eng ko'p jinoyat sodir bo'lgan 5 ta hudud (jami, barcha turlar):")
            for r, n, rk in top5:
                parts.append(f"  {rk}. {r}: {n} ta")

            # Jinoyat turlari bo'yicha 2021->2025 o'sish
            growth = cur.execute("SELECT Jinoyat_turi, Y2021, Y2025, Osish_foizi FROM crime_type_growth ORDER BY Osish_foizi DESC").fetchall()
            parts.append("\nJinoyat turlari bo'yicha 2021-2025 yillik o'sish:")
            for ct, y21, y25, gr in growth:
                parts.append(f"  - {ct}: 2021-y. {y21} -> 2025-y. {y25} ({gr:+.1f}%)")

            # Yillik umumiy
            yearly = cur.execute("""
                SELECT Yil, SUM(Jami_jinoyatlar) FROM region_yearly_totals GROUP BY Yil ORDER BY Yil
            """).fetchall()
            parts.append("\nMamlakat bo'ylab yillik umumiy jinoyatlar (TOTAL):")
            for y, n in yearly:
                parts.append(f"  - {y}: {n} ta")

            # Tanlangan hudud bo'yicha batafsil
            if sel_region:
                rows = cur.execute("""
                    SELECT Yil, Jami_jinoyatlar FROM region_yearly_totals
                    WHERE Hudud_lotin = ? ORDER BY Yil
                """, (sel_region,)).fetchall()
                if rows:
                    parts.append(f"\n'{sel_region}' bo'yicha yillik dinamika:")
                    for y, n in rows:
                        parts.append(f"  - {y}: {n} ta")

                if sel_crime:
                    rows = cur.execute("""
                        SELECT Yil, Jinoyatlar_soni FROM jinoyatlar_statistikasi
                        WHERE Hudud_lotin = ? AND Jinoyat_turi = ? ORDER BY Yil
                    """, (sel_region, sel_crime)).fetchall()
                    if rows:
                        parts.append(f"\n'{sel_region}' / '{sel_crime}' yillik dinamikasi:")
                        for y, n in rows:
                            parts.append(f"  - {y}: {n} ta")

            conn.close()
            return "\n".join(parts)
        except Exception as e:
            print("DB context error:", e)
            return ""

    db_context = await loop.run_in_executor(None, fetch_db_context)

    # 3. System prompt -config dan keladi (boshqa tilga/uslubga o'tish uchun config.py ni tahrirlang)
    system_prompt = config.build_chat_system_prompt(
        region=ui_context.get('region', ''),
        crime_type=ui_context.get('crime_type', ''),
        db_context=db_context,
        web_context=web_context,
    )

    # 4. Build messages with history
    messages = [{"role": "system", "content": system_prompt}]
    messages.extend(history)
    messages.append({"role": "user", "content": user_message})

    # ============================================================
    # === LLM CALL === (boshqa modelga o'tishda shu blokni o'zgartiring)
    # API URL, model, temperatura -hammasi config.py dan keladi.
    # OpenAI-uyg'un API bilan ishlaydi. Agar boshqa SDK kerak bo'lsa
    # (masalan Anthropic), shu producer() funksiyasini SDK chaqiruvi
    # bilan almashtiring (yield format saqlansin).
    # ============================================================
    req_headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "Accept": "text/event-stream"
    }
    payload = {
        "model": config.LLM_MODEL,
        "messages": messages,
        "temperature": config.LLM_CHAT_TEMPERATURE,
        "stream": True
    }

    async def char_stream():
        queue: asyncio.Queue = asyncio.Queue()
        SENTINEL = object()
        full_reply_parts: list = []

        def producer():
            """Boshqa thread da ishlaydi: LLM dan SSE chunklarni yoki butun JSON ni queuega tashlaydi."""
            try:
                with requests.post(
                    config.LLM_API_URL,
                    headers=req_headers,
                    json=payload,
                    timeout=config.LLM_REQUEST_TIMEOUT,
                    stream=True
                ) as r:
                    if r.status_code != 200:
                        body_preview = r.text[:500]
                        print(f"[chat] LLM API status={r.status_code} body={body_preview}")
                        loop.call_soon_threadsafe(
                            queue.put_nowait,
                            ('error', f'LLM API {r.status_code}: {body_preview[:200]}')
                        )
                        return

                    content_type = (r.headers.get('Content-Type') or '').lower()
                    is_sse = 'text/event-stream' in content_type

                    if is_sse:
                        for raw_line in r.iter_lines(decode_unicode=True):
                            if not raw_line or not raw_line.startswith('data:'):
                                continue
                            data = raw_line[5:].lstrip()
                            if data == '[DONE]':
                                break
                            loop.call_soon_threadsafe(queue.put_nowait, ('sse', data))
                    else:
                        # API stream=True ni qo'llab-quvvatlamadi — to'liq JSON keldi
                        full = r.content.decode('utf-8', errors='replace')
                        try:
                            text = json.loads(full)['choices'][0]['message']['content']
                        except (json.JSONDecodeError, KeyError, IndexError, TypeError) as e:
                            print(f"[chat] Non-SSE response parse failed: {e}; body={full[:500]}")
                            text = ''
                        if text:
                            loop.call_soon_threadsafe(queue.put_nowait, ('full', text))

                loop.call_soon_threadsafe(queue.put_nowait, SENTINEL)
            except Exception as e:
                print(f"[chat] producer exception: {e}")
                loop.call_soon_threadsafe(queue.put_nowait, ('error', str(e)))
                loop.call_soon_threadsafe(queue.put_nowait, SENTINEL)

        loop.run_in_executor(None, producer)

        # Proxy/browser bufferini darhol ochish uchun SSE comment yuboramiz
        yield ": stream-open\n\n"

        try:
            while True:
                item = await queue.get()
                if item is SENTINEL:
                    break
                kind, data = item
                if kind == 'error':
                    yield f"data: {json.dumps({'token': f'Xatolik: {data}'})}\n\n"
                    continue
                if kind == 'sse':
                    try:
                        parsed = json.loads(data)
                        choices = parsed.get('choices') or []
                        if not choices:
                            continue
                        delta = choices[0].get('delta') or {}
                        token = delta.get('content') or ''
                        if token:
                            full_reply_parts.append(token)
                            yield f"data: {json.dumps({'token': token})}\n\n"
                    except (json.JSONDecodeError, KeyError, IndexError, TypeError):
                        continue
                elif kind == 'full':
                    # Fallback: word-by-word fake stream
                    words = data.split(' ')
                    for i, word in enumerate(words):
                        token = word if i == 0 else ' ' + word
                        full_reply_parts.append(token)
                        yield f"data: {json.dumps({'token': token})}\n\n"
                        await asyncio.sleep(0.02)

            # --- Memory: faqat muvaffaqiyatli javob bo'lsa tarixga qo'shamiz ---
            full_reply = ''.join(full_reply_parts)
            if full_reply:
                history.append({"role": "user", "content": user_message})
                history.append({"role": "assistant", "content": full_reply})
                if len(history) > MAX_HISTORY:
                    conversation_history[session_id] = history[-MAX_HISTORY:]

            yield "data: [DONE]\n\n"

        except Exception as e:
            print(f"Chat error: {e}")
            yield f"data: {json.dumps({'token': f'Xatolik: {str(e)}'})}\n\n"
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        char_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive"
        }
    )

@app.delete("/api/chat/history/{session_id}")
async def clear_history(session_id: str):
    """Session tarixini tozalash"""
    if session_id in conversation_history:
        del conversation_history[session_id]
    return JSONResponse(content={"status": "cleared"})



# Serve index.html at root
from fastapi.responses import FileResponse
@app.get("/")
async def read_index():
    return FileResponse(config.INDEX_HTML_STR)

if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=False)
