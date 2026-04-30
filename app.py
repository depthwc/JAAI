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

CLEAN_DIR = config.CLEAN_DIR_STR
DB_PATH = config.DB_PATH_STR


conversation_history: dict = {}
MAX_HISTORY = 20  

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

    if os.path.exists(CLEAN_DIR):
        for f in os.listdir(CLEAN_DIR):
            if f.endswith('.xlsx'):
                last_modified_times[f] = os.path.getmtime(os.path.join(CLEAN_DIR, f))


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


os.makedirs(config.STATIC_DIR_STR, exist_ok=True)
app.mount("/static", StaticFiles(directory=config.STATIC_DIR_STR), name="static")


api_key = config.load_api_key()
if not api_key:
    print("[!] OGOHLANTIRISH: .env fayldan API kalit topilmadi. LLM chaqiruvlari ishlamaydi.")

@app.get("/api/data")
async def get_data():
    conn = sqlite3.connect(DB_PATH)
    df = pd.read_sql('SELECT * FROM jinoyatlar_statistikasi', conn)
    conn.close()


    history_dict = {}
    for (region, crime_type), group in df.groupby(['Hudud_lotin', 'Jinoyat_turi']):
        key = f"{region}_{crime_type}"
        history_dict[key] = {row['Yil']: row['Jinoyatlar_soni'] for _, row in group.iterrows()}


    predictions_path = config.PREDICTIONS_PATH_STR
    if not os.path.exists(predictions_path):
        return JSONResponse(content={"error": "Predictions fayli hali yaratilmagan. Biroz kutib qaytadan urinib ko'ring."}, status_code=503)
    with open(predictions_path, 'r', encoding='utf-8') as f:
        predictions = json.load(f)['predictions']
        

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


    if session_id not in conversation_history:
        conversation_history[session_id] = []
    history = conversation_history[session_id]

    loop = asyncio.get_running_loop()


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

    def fetch_db_context():
        try:
            conn = sqlite3.connect(DB_PATH)
            cur = conn.cursor()
            sel_region = ui_context.get('region') if ui_context.get('region') and ui_context.get('region') != 'All' else None
            sel_crime = ui_context.get('crime_type') if ui_context.get('crime_type') and ui_context.get('crime_type') != 'All' else None

            rows = cur.execute("""
                SELECT Hudud_lotin, Jinoyat_turi, Yil, Jinoyatlar_soni
                FROM jinoyatlar_statistikasi
                ORDER BY Hudud_lotin, Jinoyat_turi, Yil
            """).fetchall()
            conn.close()

            from collections import defaultdict
            by_rc = defaultdict(dict)            # {(region, crime): {year: count}}
            by_region_year = defaultdict(int)    # {(region, year): total}
            by_crime_year = defaultdict(int)     # {(crime, year): total}
            by_year = defaultdict(int)           # {year: total}
            regions, crimes, years = set(), set(), set()
            for region, crime, year, count in rows:
                by_rc[(region, crime)][year] = count
                regions.add(region)
                crimes.add(crime)
                years.add(year)
                # "O'zbekiston Respublikasi" allaqachon agregat — ikki marta qo'shmaymiz
                if region != "O'zbekiston Respublikasi":
                    by_region_year[(region, year)] += count
                    by_crime_year[(crime, year)] += count
                    by_year[year] += count

            years_sorted = sorted(years)
            regions_sorted = sorted(regions)
            crimes_sorted = sorted(crimes)

            parts = []

            # 1) To'liq xom statistika — har bir hudud × jinoyat turi × yil
            parts.append("==== TO'LIQ XOM STATISTIKA (har bir hudud / jinoyat turi / yil) ====")
            parts.append("Format: Hudud | Jinoyat turi | " + " | ".join(years_sorted))
            for region in regions_sorted:
                for crime in crimes_sorted:
                    yc = by_rc.get((region, crime), {})
                    if not yc:
                        continue
                    vals = " | ".join(str(yc.get(y, '-')) for y in years_sorted)
                    parts.append(f"{region} | {crime} | {vals}")

            # 2) Mamlakat bo'ylab yillik jami (O'zR agregati chiqarilmagan)
            parts.append("\n==== MAMLAKAT BO'YICHA YILLIK JAMI (viloyatlar yig'indisi) ====")
            for y in years_sorted:
                parts.append(f"  {y}: {by_year[y]} ta")

            # 3) Hudud reytingi — har bir yil bo'yicha
            parts.append("\n==== HUDUDLAR REYTINGI (jami jinoyatlar, barcha turlar) ====")
            for y in years_sorted:
                ranked = sorted(
                    [(r, by_region_year[(r, y)]) for r in regions_sorted if r != "O'zbekiston Respublikasi"],
                    key=lambda x: x[1], reverse=True
                )
                parts.append(f"  {y}-yil:")
                for i, (r, n) in enumerate(ranked, 1):
                    parts.append(f"    {i}. {r}: {n} ta")

            # 4) Jinoyat turlari bo'yicha yillik dinamika va 2021->2025 o'sishi
            parts.append("\n==== JINOYAT TURLARI BO'YICHA YILLIK DINAMIKA (mamlakat bo'yicha) ====")
            for crime in crimes_sorted:
                yearly_vals = [(y, by_crime_year[(crime, y)]) for y in years_sorted]
                line = f"  {crime}: " + ", ".join(f"{y}={n}" for y, n in yearly_vals)
                if len(years_sorted) >= 2:
                    first = by_crime_year[(crime, years_sorted[0])]
                    last = by_crime_year[(crime, years_sorted[-1])]
                    if first > 0:
                        growth = (last - first) / first * 100
                        line += f"  ({years_sorted[0]}->{years_sorted[-1]}: {growth:+.1f}%)"
                parts.append(line)

            # 5) 2026 bashoratlari — to'liq ro'yxat
            try:
                with open(config.PREDICTIONS_PATH_STR, 'r', encoding='utf-8') as f:
                    preds = json.load(f).get('predictions', [])
                if preds:
                    parts.append("\n==== 2026-YIL UCHUN BASHORATLAR (har bir hudud × jinoyat turi) ====")
                    parts.append("Format: Hudud | Jinoyat turi | Kutilgan | Trend | Asoslash")
                    for p in preds:
                        parts.append(
                            f"{p.get('region','')} | {p.get('crime_type','')} | "
                            f"{p.get('expected_count_2026','')} | {p.get('probability_trend','')} | "
                            f"{p.get('reasoning','')}"
                        )
            except Exception as e:
                print("Predictions load error:", e)

            # 6) UI tanlovi bo'yicha qisqa fokus blok
            if sel_region or sel_crime:
                parts.append("\n==== JORIY UI TANLOVI BO'YICHA FOKUS ====")
                if sel_region and sel_crime:
                    yc = by_rc.get((sel_region, sel_crime), {})
                    if yc:
                        parts.append(f"'{sel_region}' / '{sel_crime}' yillik dinamikasi:")
                        for y in years_sorted:
                            if y in yc:
                                parts.append(f"  {y}: {yc[y]} ta")
                elif sel_region:
                    parts.append(f"'{sel_region}' bo'yicha yillik jami:")
                    for y in years_sorted:
                        parts.append(f"  {y}: {by_region_year[(sel_region, y)]} ta")
                elif sel_crime:
                    parts.append(f"'{sel_crime}' bo'yicha mamlakat yillik jami:")
                    for y in years_sorted:
                        parts.append(f"  {y}: {by_crime_year[(sel_crime, y)]} ta")

            return "\n".join(parts)
        except Exception as e:
            print("DB context error:", e)
            return ""

    db_context = await loop.run_in_executor(None, fetch_db_context)

    system_prompt = config.build_chat_system_prompt(
        region=ui_context.get('region', ''),
        crime_type=ui_context.get('crime_type', ''),
        db_context=db_context,
        web_context=web_context,
    )

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
                    words = data.split(' ')
                    for i, word in enumerate(words):
                        token = word if i == 0 else ' ' + word
                        full_reply_parts.append(token)
                        yield f"data: {json.dumps({'token': token})}\n\n"
                        await asyncio.sleep(0.02)

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



from fastapi.responses import FileResponse
@app.get("/")
async def read_index():
    return FileResponse(config.INDEX_HTML_STR)

if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=False)
