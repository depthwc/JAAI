let globalData = [];
let regionSelect = null;
let crimeSelect = null;

// Session ID -suhbat xotirasini boshqarish uchun
function getSessionId() {
    let sid = localStorage.getItem('jaai_session_id');
    if (!sid) {
        sid = 'session_' + Math.random().toString(36).slice(2) + Date.now();
        localStorage.setItem('jaai_session_id', sid);
    }
    return sid;
}

document.addEventListener('DOMContentLoaded', async () => {
    initCustomSelects();
    setupTooltip();
    await loadData();
    setupEventListeners();
});

/* ============================================================
 * CUSTOM SELECT (theme-matched dropdown)
 * ============================================================ */
function CustomSelect(rootEl, onChange) {
    let options = [];
    let value = null;

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'cs-trigger';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.innerHTML = `
        <span class="cs-value"></span>
        <svg class="cs-arrow" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
    `;

    const menu = document.createElement('div');
    menu.className = 'cs-menu';
    menu.setAttribute('role', 'listbox');

    rootEl.classList.add('cs-mount');
    rootEl.appendChild(trigger);
    rootEl.appendChild(menu);

    function render() {
        const valueEl = trigger.querySelector('.cs-value');
        const cur = options.find(o => o.value === value);
        valueEl.textContent = cur ? cur.label : '';

        menu.innerHTML = '';
        options.forEach(o => {
            const item = document.createElement('div');
            item.className = 'cs-option' + (o.value === value ? ' selected' : '');
            item.dataset.value = o.value;
            item.setAttribute('role', 'option');
            item.setAttribute('aria-selected', o.value === value ? 'true' : 'false');
            item.textContent = o.label;
            item.addEventListener('click', () => {
                value = o.value;
                close();
                render();
                onChange && onChange(value);
            });
            menu.appendChild(item);
        });
    }

    function open() {
        rootEl.classList.add('open');
        trigger.setAttribute('aria-expanded', 'true');
        document.addEventListener('mousedown', onOutside);
        document.addEventListener('keydown', onKey);
    }
    function close() {
        rootEl.classList.remove('open');
        trigger.setAttribute('aria-expanded', 'false');
        document.removeEventListener('mousedown', onOutside);
        document.removeEventListener('keydown', onKey);
    }
    function onOutside(e) {
        if (!rootEl.contains(e.target)) close();
    }
    function onKey(e) {
        if (e.key === 'Escape') close();
    }

    trigger.addEventListener('click', () => {
        rootEl.classList.contains('open') ? close() : open();
    });

    return {
        setOptions(opts, defaultValue) {
            options = opts;
            if (defaultValue !== undefined) value = defaultValue;
            else if (value === null && opts.length) value = opts[0].value;
            render();
        },
        setValue(v) { value = v; render(); },
        getValue() { return value; },
    };
}

function initCustomSelects() {
    regionSelect = CustomSelect(document.getElementById('regionSelect'), () => renderTable());
    crimeSelect  = CustomSelect(document.getElementById('crimeSelect'),  () => renderTable());

    // Boshlang'ich qiymatlar (data yuklanmagunga qadar)
    regionSelect.setOptions([{ value: 'All', label: "Barchasi (O'zbekiston)" }], 'All');
    crimeSelect.setOptions([{ value: 'All', label: 'Barchasi' }], 'All');
}

/* ============================================================
 * CUSTOM TOOLTIP (theme-matched, follows cursor)
 * ============================================================ */
let tooltipEl = null;
function setupTooltip() {
    tooltipEl = document.createElement('div');
    tooltipEl.className = 'jaai-tooltip';
    document.body.appendChild(tooltipEl);
}
function showTooltip(e, title, body) {
    if (!tooltipEl) setupTooltip();
    tooltipEl.innerHTML = `<div class="jaai-tooltip-title">${escapeHtml(title)}</div>${escapeHtml(body)}`;
    tooltipEl.classList.add('visible');
    positionTooltip(e);
}
function positionTooltip(e) {
    if (!tooltipEl) return;
    const offsetX = 16, offsetY = 18;
    const tw = tooltipEl.offsetWidth, th = tooltipEl.offsetHeight;
    let x = e.clientX + offsetX;
    let y = e.clientY + offsetY;
    if (x + tw + 8 > window.innerWidth)  x = e.clientX - tw - offsetX;
    if (y + th + 8 > window.innerHeight) y = e.clientY - th - offsetY;
    tooltipEl.style.left = Math.max(8, x) + 'px';
    tooltipEl.style.top  = Math.max(8, y) + 'px';
}
function hideTooltip() {
    if (tooltipEl) tooltipEl.classList.remove('visible');
}
function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

/* ============================================================
 * DATA + TABLE
 * ============================================================ */
async function loadData() {
    try {
        const response = await fetch('/api/data');
        const json = await response.json();
        globalData = json.data;

        populateFilters();
        renderTable();
    } catch (e) {
        console.error("Error loading data:", e);
        document.getElementById('tableSummary').innerText = "Ma'lumotlarni yuklashda xatolik yuz berdi.";
    }
}

function populateFilters() {
    const regions = new Set();
    const crimes = new Set();
    globalData.forEach(item => {
        regions.add(item.region);
        crimes.add(item.crime_type);
    });

    const regionOpts = [{ value: 'All', label: "Barchasi (O'zbekiston)" }];
    [...regions].sort().forEach(r => {
        if (r !== "O'zbekiston Respublikasi" && r !== "O‘zbekiston Respublikasi") {
            regionOpts.push({ value: r, label: r });
        }
    });
    regionSelect.setOptions(regionOpts, 'All');

    const crimeOpts = [{ value: 'All', label: 'Barchasi' }];
    [...crimes].sort().forEach(c => crimeOpts.push({ value: c, label: c }));
    crimeSelect.setOptions(crimeOpts, 'All');
}

function getSelectedFilters() {
    return {
        region: regionSelect ? regionSelect.getValue() : 'All',
        crime_type: crimeSelect ? crimeSelect.getValue() : 'All',
    };
}

function renderTable() {
    const { region, crime_type } = getSelectedFilters();
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';

    let filteredData = globalData;
    if (region !== 'All')     filteredData = filteredData.filter(d => d.region === region);
    if (crime_type !== 'All') filteredData = filteredData.filter(d => d.crime_type === crime_type);

    document.getElementById('tableSummary').innerText = `Jami topilgan natijalar: ${filteredData.length} ta`;

    const fmt = (num) => (num || num === 0) ? Number(num).toLocaleString() : '-';

    filteredData.forEach(item => {
        const tr = document.createElement('tr');

        const hist = item.history;
        const trend = item.prediction.probability_trend;
        let trendClass = 'trend-stable';
        let trendText = 'Barqaror';
        if (trend === 'increase')      { trendClass = 'trend-increase'; trendText = "O'sish ↗"; }
        else if (trend === 'decrease') { trendClass = 'trend-decrease'; trendText = 'Kamayish ↘'; }

        tr.innerHTML = `
            <td>${escapeHtml(item.region)}</td>
            <td>${escapeHtml(item.crime_type)}</td>
            <td>${fmt(hist['2021'])}</td>
            <td>${fmt(hist['2022'])}</td>
            <td>${fmt(hist['2023'])}</td>
            <td>${fmt(hist['2024'])}</td>
            <td>${fmt(hist['2025'])}</td>
            <td class="highlight-col">${fmt(item.prediction.expected_count_2026)}</td>
            <td><span class="trend-badge ${trendClass}">${trendText}</span></td>
        `;

        // Custom theme tooltip (native title o'rnida)
        const reasoning = item.prediction.reasoning || '';
        if (reasoning) {
            tr.addEventListener('mouseenter', (e) => showTooltip(e, 'Prognoz asosi', reasoning));
            tr.addEventListener('mousemove', positionTooltip);
            tr.addEventListener('mouseleave', hideTooltip);
        }

        tbody.appendChild(tr);
    });
}

/* ============================================================
 * CHAT
 * ============================================================ */
function setupEventListeners() {
    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');

    const sendMessage = async () => {
        const msg = chatInput.value.trim();
        if (!msg) return;

        appendMessage('user', msg);
        chatInput.value = '';
        setAIState(true);

        const aiDiv = createStreamingBubble();

        try {
            const context = getSelectedFilters();
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: msg, context, session_id: getSessionId() })
            });

            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let buffer = '';
            let fullText = '';
            let done = false;

            while (!done) {
                const r = await reader.read();
                if (r.done) break;

                buffer += decoder.decode(r.value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop();

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const data = line.slice(6).trim();
                    if (data === '[DONE]') { done = true; break; }
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.error) {
                            aiDiv.innerText = `Xatolik: ${parsed.error}`;
                        } else if (parsed.token) {
                            fullText += parsed.token;
                            aiDiv.innerText = fullText;
                            const container = document.getElementById('chatContainer');
                            container.scrollTop = container.scrollHeight;
                        }
                    } catch(e) { /* ignore parse errors */ }
                }
            }
            aiDiv.classList.remove('streaming');
        } catch (e) {
            aiDiv.innerText = 'Kechirasiz, aloqada xatolik yuz berdi.';
        } finally {
            setAIState(false);
        }
    };

    sendBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    document.getElementById('clearChatBtn').addEventListener('click', async () => {
        const sid = getSessionId();
        await fetch(`/api/chat/history/${sid}`, { method: 'DELETE' });
        localStorage.removeItem('jaai_session_id');
        const container = document.getElementById('chatContainer');
        container.innerHTML = `
            <div class="message ai">
                <p>Salom! Yangi suhbat boshlandi. Savollaringiz bormi?</p>
            </div>`;
    });
}

function appendMessage(role, text) {
    const container = document.getElementById('chatContainer');
    const div = document.createElement('div');
    div.className = `message ${role}`;
    div.innerText = text;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function createStreamingBubble() {
    const container = document.getElementById('chatContainer');
    const div = document.createElement('div');
    div.className = 'message ai streaming';
    div.innerText = '';
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    return div;
}

function setAIState(isThinking) {
    const orb = document.getElementById('aiOrb');
    const statusText = document.querySelector('.ai-status');
    const sendBtn = document.getElementById('sendBtn');
    const chatInput = document.getElementById('chatInput');

    if (isThinking) {
        orb && orb.classList.add('thinking');
        statusText.innerText = "O'ylamoqda...";
        statusText.style.color = 'var(--trend-stable)';
        sendBtn.disabled = true;
        chatInput.disabled = true;
    } else {
        orb && orb.classList.remove('thinking');
        statusText.innerText = 'Online';
        statusText.style.color = 'var(--trend-down)';
        sendBtn.disabled = false;
        chatInput.disabled = false;
        chatInput.focus();
    }
}
