import os
import sqlite3
import json
import pandas as pd
import requests
from duckduckgo_search import DDGS

import config

REGION_CODES = [
    (1703, "Andijon viloyati"),
    (1706, "Buxoro viloyati"),
    (1708, "Jizzax viloyati"),
    (1710, "Qashqadaryo viloyati"),
    (1712, "Navoiy viloyati"),
    (1714, "Namangan viloyati"),
    (1718, "Samarqand viloyati"),
    (1722, "Surxondaryo viloyati"),
    (1724, "Sirdaryo viloyati"),
    (1726, "Toshkent shahri"),
    (1727, "Toshkent viloyati"),
    (1730, "Farg'ona viloyati"),
    (1733, "Xorazm viloyati"),
    (1735, "Qoraqalpog'iston Respublikasi"),
]
TOTAL_NAME = "O'zbekiston Respublikasi"


def normalize_name(s):
    """Normalize apostrophes and strip extra whitespace in region/crime names."""
    if not isinstance(s, str):
        return s
    return (
        s.replace('‘', "'")
         .replace('’', "'")
         .replace('ʼ', "'")
         .replace('  ', ' ')
         .strip()
    )


def detect_data_defects(crime_data):
    """Bir xil yillik totallarga ega jinoyat turlarini aniqlaydi (ehtimoliy ma'lumot xatoligi)."""
    defects = []
    seen = {}
    for crime_name, df in crime_data.items():
        year_cols = [c for c in df.columns if str(c).isdigit()]
        if not year_cols:
            continue
        total_row = df[df['Hudud_lotin'] == TOTAL_NAME]
        if total_row.empty:
            continue
        sig = tuple(int(total_row.iloc[0][c]) for c in sorted(year_cols))
        if sig in seen:
            defects.append(
                f"NUXSON: '{crime_name}' yillik totallari '{seen[sig]}' bilan AYNI bir xil -manba ma'lumot xato kiritilgan bo'lishi mumkin"
            )
        else:
            seen[sig] = crime_name
    return defects


def compute_regional_shares(crime_data):
    """To'liq mintaqaviy ma'lumotga ega jinoyat turlaridan o'rtacha mintaqaviy ulushlarni hisoblaydi."""
    region_share_sum = {region: 0.0 for _, region in REGION_CODES}
    sample_count = 0

    for crime_name, df in crime_data.items():
        if len(df) < len(REGION_CODES):
            continue
        year_cols = [c for c in df.columns if str(c).isdigit()]
        for year in year_cols:
            total_rows = df[df['Hudud_lotin'] == TOTAL_NAME]
            if total_rows.empty:
                continue
            total = float(total_rows.iloc[0][year])
            if total <= 0:
                continue
            for _, row in df.iterrows():
                rname = row['Hudud_lotin']
                if rname in region_share_sum:
                    region_share_sum[rname] += float(row[year]) / total
            sample_count += 1

    if sample_count == 0:
        return {region: 1.0 / len(REGION_CODES) for _, region in REGION_CODES}

    avg = {r: s / sample_count for r, s in region_share_sum.items()}
    total = sum(avg.values()) or 1.0
    return {r: v / total for r, v in avg.items()}


def expand_to_regions(df, regional_shares, crime_name):
    """Faqat TOTAL satr bo'lgan dataframe ni 14 viloyatga taqsimlaydi."""
    if len(df) >= len(REGION_CODES):
        return df
    year_cols = [c for c in df.columns if str(c).isdigit()]
    total_rows = df[df['Hudud_lotin'] == TOTAL_NAME]
    if total_rows.empty:
        return df
    total_row = total_rows.iloc[0]

    new_rows = [{
        'Code': int(total_row.get('Code', 1700)),
        'Hudud_lotin': TOTAL_NAME,
        **{c: int(total_row[c]) for c in year_cols}
    }]
    for code, region in REGION_CODES:
        share = regional_shares.get(region, 1.0 / len(REGION_CODES))
        row = {'Code': code, 'Hudud_lotin': region}
        for year in year_cols:
            row[year] = int(round(float(total_row[year]) * share))
        new_rows.append(row)
    print(f"  '{crime_name}' kengaytirildi: 1 -> {len(new_rows)} qator (mintaqaviy ulushlar bo'yicha)")
    return pd.DataFrame(new_rows)


def create_aggregate_tables(conn):
    """Agregat tahlil uchun ko'rinishlar (views) yaratish."""
    cur = conn.cursor()
    for view_name in [
        'region_yearly_totals',
        'crime_type_yearly_totals',
        'region_total_5yr',
        'region_rankings_2025',
        'crime_type_growth',
    ]:
        cur.execute(f"DROP VIEW IF EXISTS {view_name}")

    cur.execute("""
        CREATE VIEW region_yearly_totals AS
        SELECT Hudud_lotin, Yil, SUM(Jinoyatlar_soni) AS Jami_jinoyatlar
        FROM jinoyatlar_statistikasi
        WHERE Hudud_lotin != 'O''zbekiston Respublikasi'
        GROUP BY Hudud_lotin, Yil
    """)

    cur.execute("""
        CREATE VIEW crime_type_yearly_totals AS
        SELECT Jinoyat_turi, Yil, SUM(Jinoyatlar_soni) AS Jami_soni
        FROM jinoyatlar_statistikasi
        WHERE Hudud_lotin != 'O''zbekiston Respublikasi'
        GROUP BY Jinoyat_turi, Yil
    """)

    cur.execute("""
        CREATE VIEW region_total_5yr AS
        SELECT Hudud_lotin, SUM(Jinoyatlar_soni) AS Jami_5_yillik
        FROM jinoyatlar_statistikasi
        WHERE Hudud_lotin != 'O''zbekiston Respublikasi'
        GROUP BY Hudud_lotin
    """)

    cur.execute("""
        CREATE VIEW region_rankings_2025 AS
        SELECT
            Hudud_lotin,
            SUM(Jinoyatlar_soni) AS Jami_2025,
            RANK() OVER (ORDER BY SUM(Jinoyatlar_soni) DESC) AS Reyting
        FROM jinoyatlar_statistikasi
        WHERE Yil = '2025' AND Hudud_lotin != 'O''zbekiston Respublikasi'
        GROUP BY Hudud_lotin
    """)

    cur.execute("""
        CREATE VIEW crime_type_growth AS
        SELECT
            t1.Jinoyat_turi,
            t1.Jami_soni AS Y2021,
            t2.Jami_soni AS Y2025,
            ROUND((CAST(t2.Jami_soni AS REAL) - t1.Jami_soni) * 100.0 / t1.Jami_soni, 1) AS Osish_foizi
        FROM crime_type_yearly_totals t1
        JOIN crime_type_yearly_totals t2
          ON t1.Jinoyat_turi = t2.Jinoyat_turi
        WHERE t1.Yil = '2021' AND t2.Yil = '2025'
    """)
    conn.commit()
    print("  Agregat ko'rinishlar yaratildi: region_yearly_totals, crime_type_yearly_totals, region_total_5yr, region_rankings_2025, crime_type_growth")


def update_database_from_files(clean_dir, db_path):
    print("Updating database from files...")

    if not os.path.exists(clean_dir):
        print(f"Directory {clean_dir} does not exist.")
        return False

    files = [f for f in os.listdir(clean_dir) if f.endswith('.xlsx')]
    if not files:
        print("No Excel files found.")
        return False

    crime_data = {}
    for f in files:
        crime_name = f.replace('.xlsx', '')
        df = pd.read_excel(os.path.join(clean_dir, f))
        if 'Hudud_lotin' in df.columns:
            df['Hudud_lotin'] = df['Hudud_lotin'].apply(normalize_name)
        crime_data[crime_name] = df

    defects = detect_data_defects(crime_data)
    for d in defects:
        print(f"  [!] {d}")

    shares = compute_regional_shares(crime_data)
    full_count = sum(1 for df in crime_data.values() if len(df) >= len(REGION_CODES))
    print(f"  Mintaqaviy ulushlar {full_count} ta to'liq fayl asosida hisoblandi")

    all_rows = []
    for crime_name, df in crime_data.items():
        if len(df) < len(REGION_CODES):
            df = expand_to_regions(df, shares, crime_name)

        id_vars = [c for c in df.columns if c in ('Code', 'Hudud_lotin')]
        value_vars = [c for c in df.columns if c not in id_vars]
        df_melted = df.melt(
            id_vars=id_vars, value_vars=value_vars,
            var_name='Yil', value_name='Jinoyatlar_soni'
        )
        df_melted['Jinoyat_turi'] = crime_name
        all_rows.append(df_melted)

    final_df = pd.concat(all_rows, ignore_index=True)
    final_df['Yil'] = final_df['Yil'].astype(str)
    final_df['Jinoyatlar_soni'] = pd.to_numeric(final_df['Jinoyatlar_soni'], errors='coerce').fillna(0).astype(int)

    conn = sqlite3.connect(db_path)
    final_df.to_sql('jinoyatlar_statistikasi', conn, if_exists='replace', index=False)
    create_aggregate_tables(conn)
    conn.close()
    print("Database updated successfully.")
    return True


def run_predictions(db_path, api_key, output_file=None):
    """LLM yordamida 2026-yil bashoratini yaratadi va JSON ga saqlaydi."""
    if output_file is None:
        output_file = config.PREDICTIONS_PATH_STR

    print("Running AI predictions...")

    conn = sqlite3.connect(db_path)
    df = pd.read_sql('SELECT * FROM jinoyatlar_statistikasi', conn)
    conn.close()
    data_summary = []
    for (region, crime_type), group in df.groupby(['Hudud_lotin', 'Jinoyat_turi']):
        years = group[['Yil', 'Jinoyatlar_soni']].sort_values('Yil')
        trend = ", ".join([f"{row['Yil']}: {row['Jinoyatlar_soni']}" for _, row in years.iterrows()])
        data_summary.append(f"Hudud: {region} | Jinoyat turi: {crime_type} | Trend: {trend}")

    data_context = "\n".join(data_summary)

    print("Searching the web for context...")
    search_queries = [
        "Uzbekistan socio-economic situation 2025",
        "Uzbekistan crime prevention policies 2025"
    ]
    web_context = []
    try:
        with DDGS() as ddgs:
            for query in search_queries:
                results = ddgs.text(query, max_results=2)
                for r in results:
                    web_context.append(f"Manba: {r.get('title')} - {r.get('body')}")
    except Exception as e:
        print("DuckDuckGo search failed:", e)

    web_context_str = "\n".join(web_context)

    system_prompt = config.PREDICT_SYSTEM_PROMPT
    user_prompt = config.build_predict_user_prompt(data_context, web_context_str)

    print(f"Sending request to {config.LLM_API_URL} (streaming)...")
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "Accept": "text/event-stream"
    }
    payload = {
        "model": config.LLM_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        "temperature": config.LLM_PREDICT_TEMPERATURE,
        "stream": True
    }

    full_text_parts = []
    with requests.post(
        config.LLM_API_URL,
        headers=headers, json=payload,
        stream=True, timeout=config.LLM_REQUEST_TIMEOUT
    ) as response:
        if response.status_code != 200:
            body_preview = response.text[:500]
            raise requests.HTTPError(f"LLM API {response.status_code}: {body_preview}", response=response)

        content_type = (response.headers.get('Content-Type') or '').lower()
        is_sse = 'text/event-stream' in content_type

        if is_sse:
            print_progress_every = 50
            chunk_count = 0
            for raw_line in response.iter_lines(decode_unicode=True):
                if not raw_line or not raw_line.startswith('data:'):
                    continue
                data = raw_line[5:].lstrip()
                if data == '[DONE]':
                    break
                try:
                    parsed = json.loads(data)
                    delta = (parsed.get('choices') or [{}])[0].get('delta') or {}
                    tok = delta.get('content') or ''
                    if tok:
                        full_text_parts.append(tok)
                        chunk_count += 1
                        if chunk_count % print_progress_every == 0:
                            print(f"  ...streaming, {chunk_count} chunks, {sum(len(p) for p in full_text_parts)} chars")
                except (json.JSONDecodeError, KeyError, IndexError, TypeError):
                    continue
        else:
            body = response.content.decode('utf-8', errors='replace')
            try:
                full_text_parts.append(json.loads(body)['choices'][0]['message']['content'])
            except (json.JSONDecodeError, KeyError, IndexError, TypeError) as e:
                raise RuntimeError(f"Non-SSE response parse failed: {e}; body={body[:300]}")


    output_text = ''.join(full_text_parts).strip()
    print(f"  Total response: {len(output_text)} chars")
    if output_text.startswith("```json"):
        output_text = output_text[7:]
    if output_text.startswith("```"):
        output_text = output_text[3:]
    if output_text.endswith("```"):
        output_text = output_text[:-3]

    output_text = output_text.strip()

    # 5. Save JSON
    try:
        parsed_json = json.loads(output_text)
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(parsed_json, f, indent=4, ensure_ascii=False)
        print(f"Predictions saved successfully to {output_file}")
        return True
    except json.JSONDecodeError:
        print("Failed to parse JSON.")
        with open(config.RAW_OUTPUT_PATH_STR, 'w', encoding='utf-8') as f:
            f.write(output_text)
        return False
