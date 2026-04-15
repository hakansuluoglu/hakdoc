// ─── AI Frontend Modulu ──────────────────────────────────────────────────────
// AI status kontrolu, SSE baglantisi, panel yonetimi ve localStorage cache

import { aiEnabled, setAiEnabled, setAiStatus, currentFilePath } from './state.js';

// ─── Cache Sabitleri ─────────────────────────────────────────────────────────

const CACHE_PREFIX = 'docwebapp:ai:summary:';
const CACHE_MAX_ENTRIES = 50; // Maksimum saklanacak ozet sayisi

// ─── Cache Yardimcilari ──────────────────────────────────────────────────────

/**
 * Bir dosya icin cache key olusturur.
 * @param {string} filePath
 * @returns {string}
 */
function cacheKey(filePath) {
  return CACHE_PREFIX + filePath;
}

/**
 * localStorage'dan bir dosyanin ozetini okur.
 * @param {string} filePath
 * @returns {{ text: string, savedAt: string, model: string } | null}
 */
function readCache(filePath) {
  try {
    const raw = localStorage.getItem(cacheKey(filePath));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

/**
 * Ozeti localStorage'a yazar. Eski kayitlari temizler.
 * @param {string} filePath
 * @param {string} text
 * @param {string} model
 */
function writeCache(filePath, text, model) {
  try {
    // Eski cache kayitlarini bul ve temizle (CACHE_MAX_ENTRIES siniri)
    const existingKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(CACHE_PREFIX)) existingKeys.push(k);
    }
    if (existingKeys.length >= CACHE_MAX_ENTRIES) {
      // En eskiyi bul ve sil
      let oldest = null;
      let oldestTime = Infinity;
      for (const k of existingKeys) {
        try {
          const entry = JSON.parse(localStorage.getItem(k));
          const t = entry?.ts || 0;
          if (t < oldestTime) { oldestTime = t; oldest = k; }
        } catch (_) {}
      }
      if (oldest) localStorage.removeItem(oldest);
    }

    const now = new Date();
    const entry = {
      text,
      model: model || '',
      ts: now.getTime(),
      savedAt: formatDateTime(now),
    };
    localStorage.setItem(cacheKey(filePath), JSON.stringify(entry));
  } catch (err) {
    console.warn('[AI Cache] Yazma hatasi:', err.message);
  }
}

/**
 * Bir dosyanin cache kaydini siler.
 * @param {string} filePath
 */
function clearCache(filePath) {
  try {
    localStorage.removeItem(cacheKey(filePath));
  } catch (_) {}
}

/**
 * Tarihi "GG.AA.YYYY SS:DD" formatinda dondurur.
 * @param {Date} date
 * @returns {string}
 */
function formatDateTime(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// ─── AI Status Kontrolu ──────────────────────────────────────────────────────

/**
 * Sunucudan AI durumunu sorgular ve state'i gunceller.
 * AI kapaliysa body'e 'ai-disabled' class'i eklenir.
 */
export async function initAI() {
  try {
    const res = await fetch('/api/ai/status');
    const data = await res.json();
    setAiEnabled(data.enabled);
    if (data.enabled) {
      setAiStatus(data.provider, data.model);
      document.body.classList.remove('ai-disabled');
      // Panel basligina model bilgisini ekle
      const modelInfo = document.getElementById('ai-panel-model-info');
      if (modelInfo) modelInfo.textContent = `${data.provider} / ${data.model}`;
    } else {
      document.body.classList.add('ai-disabled');
    }
  } catch (err) {
    console.warn('[AI] Status sorgulanamadi:', err.message);
    setAiEnabled(false);
    document.body.classList.add('ai-disabled');
  }
}

// ─── Summarize Panel ─────────────────────────────────────────────────────────

let currentEventSource = null;
let accumulatedText = '';
let activeFilePath = null;   // Panel icin hangi dosyanin ozeti gosteriliyor
let currentModel = '';       // Ozet icin kullanilan model adi

/**
 * AI ozet panelini acar. Once cache'e bakar, varsa gosterir.
 * Yoksa yeni istek yapar.
 */
export async function aiSummarize() {
  if (!currentFilePath) return;

  // PDF gibi binary dosyalari destekleme
  const ext = currentFilePath.split('.').pop().toLowerCase();
  if (['pdf', 'png', 'jpg', 'jpeg', 'gif', 'zip', 'tar', 'gz'].includes(ext)) {
    showAIPanel();
    setAIPanelError('Bu dosya türü ozet icin desteklenmiyor.');
    return;
  }

  activeFilePath = currentFilePath;
  showAIPanel();

  // Cache'de ozet var mi?
  const cached = readCache(activeFilePath);
  if (cached) {
    accumulatedText = cached.text;
    currentModel = cached.model;
    setAIPanelContent(accumulatedText);
    setCacheInfo(cached.savedAt, false);  // cache'den geldi, yenileme gorunur
    return;
  }

  // Cache yok → yeni istek
  await _fetchSummary(activeFilePath);
}

/**
 * "Yenile" butonuna basildiginda cache'i atlar, yeni istek yapar.
 */
export async function aiRefreshSummary() {
  if (!activeFilePath) return;
  clearCache(activeFilePath);
  setCacheInfo('', true);  // cache bilgisini gizle
  await _fetchSummary(activeFilePath);
}

/**
 * Gercek API isteğini yapar, SSE stream'i okur ve cache'e yazar.
 * @param {string} filePath
 */
async function _fetchSummary(filePath) {
  setAIPanelLoading(true);
  accumulatedText = '';

  // Onceki EventSource'u kapat
  if (currentEventSource) {
    currentEventSource.close();
    currentEventSource = null;
  }

  try {
    // SSE yerine fetch + ReadableStream kullan (POST destegi icin)
    const response = await fetch('/api/ai/summarize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Sunucu hatasi' }));
      setAIPanelLoading(false);
      setAIPanelError(err.error || 'Bilinmeyen hata');
      return;
    }

    setAIPanelLoading(false);
    setAIPanelContent('');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // SSE satirlarini isle
      const lines = buffer.split('\n');
      buffer = lines.pop(); // Son eksik satiri buffer'da birak

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const payload = JSON.parse(line.slice(6));
            if (payload.error) {
              setAIPanelError(payload.error);
              return;
            }
            if (payload.done) {
              // Stream tamamlandi — cache'e kaydet
              if (accumulatedText) {
                writeCache(filePath, accumulatedText, currentModel);
                const now = new Date();
                setCacheInfo(formatDateTime(now), false);
              }
              return;
            }
            if (payload.text) {
              accumulatedText += payload.text;
              setAIPanelContent(accumulatedText);
            }
          } catch (_) {
            // JSON parse hatasi - satiri atla
          }
        }
      }
    }

    // Stream bitti ama done paketi gelmediyse yine de cache'e yaz
    if (accumulatedText) {
      writeCache(filePath, accumulatedText, currentModel);
      const now = new Date();
      setCacheInfo(formatDateTime(now), false);
    }
  } catch (err) {
    setAIPanelLoading(false);
    setAIPanelError('Baglanti hatasi: ' + err.message);
  }
}

// ─── Panel UI Yardimcilari ───────────────────────────────────────────────────

function showAIPanel() {
  const panel = document.getElementById('ai-panel');
  if (panel) panel.classList.remove('ai-panel-collapsed');
}

export function closeAIPanel() {
  const panel = document.getElementById('ai-panel');
  if (panel) panel.classList.add('ai-panel-collapsed');
  if (currentEventSource) {
    currentEventSource.close();
    currentEventSource = null;
  }
}

function setAIPanelLoading(isLoading) {
  const loading = document.getElementById('ai-panel-loading');
  const content = document.getElementById('ai-panel-content');
  const error = document.getElementById('ai-panel-error');
  const cacheBar = document.getElementById('ai-panel-cache-bar');
  if (loading) loading.style.display = isLoading ? 'flex' : 'none';
  if (content) { content.style.display = isLoading ? 'none' : 'block'; content.innerHTML = ''; }
  if (error) error.style.display = 'none';
  if (cacheBar) cacheBar.style.display = 'none';
}

function setAIPanelError(msg) {
  const loading = document.getElementById('ai-panel-loading');
  const content = document.getElementById('ai-panel-content');
  const error = document.getElementById('ai-panel-error');
  if (loading) loading.style.display = 'none';
  if (content) content.style.display = 'none';
  if (error) { error.style.display = 'block'; error.textContent = msg; }
}

function setAIPanelContent(text) {
  const content = document.getElementById('ai-panel-content');
  if (!content) return;
  content.style.display = 'block';
  // marked.js global olarak yuklu
  if (typeof marked !== 'undefined') {
    content.innerHTML = marked.parse(text);
  } else {
    content.textContent = text;
  }
}

/**
 * Cache bilgi barini gosterir/gizler.
 * @param {string} savedAt - "GG.AA.YYYY SS:DD" formatinda tarih ya da bos string
 * @param {boolean} hide - true ise bari gizle
 */
function setCacheInfo(savedAt, hide) {
  const bar = document.getElementById('ai-panel-cache-bar');
  const dateEl = document.getElementById('ai-panel-cache-date');
  if (!bar) return;
  if (hide || !savedAt) {
    bar.style.display = 'none';
    return;
  }
  bar.style.display = 'flex';
  if (dateEl) dateEl.textContent = savedAt;
}

/**
 * Ozet icerigini panoya kopyalar.
 */
export function copyAISummary() {
  if (!accumulatedText) return;
  navigator.clipboard.writeText(accumulatedText).then(() => {
    const btn = document.getElementById('ai-panel-copy-btn');
    if (btn) {
      const orig = btn.innerHTML;
      btn.innerHTML = '<i class="fas fa-check"></i>';
      setTimeout(() => { btn.innerHTML = orig; }, 1500);
    }
  }).catch(() => {});
}
