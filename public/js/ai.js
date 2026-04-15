// ─── AI Frontend Module ───────────────────────────────────────────────────────
// Handles AI status checks, SSE streaming, panel UI, and localStorage cache.

import { aiEnabled, setAiEnabled, setAiStatus, currentFilePath, getAILanguage } from './state.js';

// ─── Cache Constants ──────────────────────────────────────────────────────────

const CACHE_PREFIX = 'docwebapp:ai:summary:';
const CACHE_MAX_ENTRIES = 50; // Maximum number of cached summaries

// ─── Cache Helpers ────────────────────────────────────────────────────────────

/**
 * Build the localStorage key for a given file path and language.
 * @param {string} filePath
 * @returns {string}
 */
function cacheKey(filePath) {
  return CACHE_PREFIX + getAILanguage() + ':' + filePath;
}

/**
 * Read a cached summary from localStorage.
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
 * Write a summary to localStorage, evicting the oldest entry when over the limit.
 * @param {string} filePath
 * @param {string} text
 * @param {string} model
 */
function writeCache(filePath, text, model) {
  try {
    // Evict oldest entry when at capacity
    const existingKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(CACHE_PREFIX)) existingKeys.push(k);
    }
    if (existingKeys.length >= CACHE_MAX_ENTRIES) {
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
    console.warn('[AI Cache] Write error:', err.message);
  }
}

/**
 * Remove the cached summary for a file.
 * @param {string} filePath
 */
function clearCache(filePath) {
  try {
    localStorage.removeItem(cacheKey(filePath));
  } catch (_) {}
}

/**
 * Format a Date as "DD.MM.YYYY HH:MM".
 * @param {Date} date
 * @returns {string}
 */
function formatDateTime(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// ─── AI Status ────────────────────────────────────────────────────────────────

/**
 * Query the server for AI status and update app state.
 * Adds 'ai-disabled' class to body when AI is not configured.
 */
export async function initAI() {
  try {
    const res = await fetch('/api/ai/status');
    const data = await res.json();
    setAiEnabled(data.enabled);
    if (data.enabled) {
      setAiStatus(data.provider, data.model);
      document.body.classList.remove('ai-disabled');
      // Show model info in panel header
      const modelInfo = document.getElementById('ai-panel-model-info');
      if (modelInfo) modelInfo.textContent = `${data.provider} / ${data.model}`;
    } else {
      document.body.classList.add('ai-disabled');
    }
  } catch (err) {
    console.warn('[AI] Status check failed:', err.message);
    setAiEnabled(false);
    document.body.classList.add('ai-disabled');
  }
}

// ─── Summary Panel ────────────────────────────────────────────────────────────

let currentEventSource = null;
let accumulatedText = '';
let activeFilePath = null;   // Which file's summary is currently shown in the panel
let currentModel = '';       // Model used for the current summary

/**
 * Open the AI summary panel. Serves from cache if available, otherwise fetches.
 */
export async function aiSummarize() {
  if (!currentFilePath) return;

  // Binary file types are not supported
  const ext = currentFilePath.split('.').pop().toLowerCase();
  if (['pdf', 'png', 'jpg', 'jpeg', 'gif', 'zip', 'tar', 'gz'].includes(ext)) {
    showAIPanel();
    setAIPanelError('This file type is not supported for summarization.');
    return;
  }

  activeFilePath = currentFilePath;
  showAIPanel();

  // Serve from cache if available
  const cached = readCache(activeFilePath);
  if (cached) {
    accumulatedText = cached.text;
    currentModel = cached.model;
    setAIPanelContent(accumulatedText);
    setCacheInfo(cached.savedAt, false);
    return;
  }

  // No cache — fetch a new summary
  await _fetchSummary(activeFilePath);
}

/**
 * Bypass the cache and fetch a fresh summary.
 */
export async function aiRefreshSummary() {
  if (!activeFilePath) return;
  clearCache(activeFilePath);
  setCacheInfo('', true);
  await _fetchSummary(activeFilePath);
}

/**
 * Send the summarize request, read the SSE stream, and write to cache.
 * @param {string} filePath
 */
async function _fetchSummary(filePath) {
  setAIPanelLoading(true);
  accumulatedText = '';

  // Close any previous stream
  if (currentEventSource) {
    currentEventSource.close();
    currentEventSource = null;
  }

  try {
    // Use fetch + ReadableStream instead of EventSource (POST support required)
    const response = await fetch('/api/ai/summarize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath, language: getAILanguage() }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Server error' }));
      setAIPanelLoading(false);
      setAIPanelError(err.error || 'Unknown error');
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

      // Process complete SSE lines
      const lines = buffer.split('\n');
      buffer = lines.pop(); // Keep incomplete last line in buffer

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const payload = JSON.parse(line.slice(6));
            if (payload.error) {
              setAIPanelError(payload.error);
              return;
            }
            if (payload.done) {
              // Stream complete — write to cache
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
            // Skip malformed SSE lines
          }
        }
      }
    }

    // Stream ended without a done packet — save what we have
    if (accumulatedText) {
      writeCache(filePath, accumulatedText, currentModel);
      const now = new Date();
      setCacheInfo(formatDateTime(now), false);
    }
  } catch (err) {
    setAIPanelLoading(false);
    setAIPanelError('Connection error: ' + err.message);
  }
}

// ─── Panel UI Helpers ─────────────────────────────────────────────────────────

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
  // marked.js is loaded globally
  if (typeof marked !== 'undefined') {
    content.innerHTML = marked.parse(text);
  } else {
    content.textContent = text;
  }
}

/**
 * Show or hide the cache info bar.
 * @param {string} savedAt - Formatted date string, or empty string
 * @param {boolean} hide   - If true, hide the bar
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
 * Copy the current summary text to the clipboard.
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
