// ─── Settings Module ────────────────────────────────────────────────────────
// Full-page settings modal: docs folder + AI provider configuration.

import { initAI } from './ai.js';
import { refreshTree } from './tree.js';
import { showToast } from './utils.js';
import {
  setOpenTabs, setActiveTabPath, openTabs, getAILanguage, setAILanguage,
} from './state.js';
import { renderTabs } from './editor.js';

// ─── Provider display metadata ─────────────────────────────────────────────
const PROVIDER_META = {
  openai:     { label: 'OpenAI',      icon: 'fa-brain' },
  anthropic:  { label: 'Anthropic',   icon: 'fa-comment-dots' },
  google:     { label: 'Google AI',   icon: 'fa-flask' },
  ollama:     { label: 'Ollama',      icon: 'fa-server' },
  lmstudio:   { label: 'LM Studio',  icon: 'fa-laptop-code' },
  deepseek:   { label: 'DeepSeek',   icon: 'fa-water' },
  openrouter: { label: 'OpenRouter', icon: 'fa-route' },
  zhipu:      { label: 'Zhipu',      icon: 'fa-bolt' },
};

// Human-readable field labels
const FIELD_LABELS = {
  OPENAI_API_KEY: 'API Key',
  OPENAI_MODEL: 'Model',
  ANTHROPIC_API_KEY: 'API Key',
  ANTHROPIC_MODEL: 'Model',
  GOOGLE_API_KEY: 'API Key',
  GOOGLE_MODEL: 'Model',
  OLLAMA_BASE_URL: 'Base URL',
  OLLAMA_MODEL: 'Model',
  LMSTUDIO_BASE_URL: 'Base URL',
  LMSTUDIO_MODEL: 'Model',
  DEEPSEEK_API_KEY: 'API Key',
  DEEPSEEK_MODEL: 'Model',
  OPENROUTER_API_KEY: 'API Key',
  OPENROUTER_MODEL: 'Model',
  ZHIPU_API_KEY: 'API Key',
  ZHIPU_BASE_URL: 'Base URL',
  ZHIPU_MODEL: 'Model',
};

// ─── Language Options ───────────────────────────────────────────────────────
const AI_LANGUAGES = [
  { code: 'tr', label: 'Türkçe',    flag: '🇹🇷' },
  { code: 'en', label: 'English',   flag: '🇬🇧' },
  { code: 'de', label: 'Deutsch',   flag: '🇩🇪' },
  { code: 'fr', label: 'Français',  flag: '🇫🇷' },
  { code: 'es', label: 'Español',   flag: '🇪🇸' },
  { code: 'ja', label: '日本語',     flag: '🇯🇵' },
];

// ─── State ──────────────────────────────────────────────────────────────────
let settingsData = null;       // Loaded from GET /api/settings
let selectedProvider = '';     // Currently selected provider in the UI
let originalDocsRoot = '';     // To detect changes
let selectedLanguage = 'tr';   // Currently selected AI response language

// ─── Open / Close ───────────────────────────────────────────────────────────

export async function openSettings() {
  try {
    const res = await fetch('/api/settings');
    settingsData = await res.json();
  } catch (err) {
    showToast('Failed to load settings: ' + err.message, { type: 'error' });
    return;
  }

  originalDocsRoot = settingsData.docsRoot;
  selectedProvider = settingsData.activeProvider || '';
  selectedLanguage = getAILanguage();

  // Populate docs root
  document.getElementById('settings-docs-root').value = settingsData.docsRoot;

  // Render language grid
  renderLanguageGrid();

  // Render provider grid
  renderProviderGrid();

  // Render config fields for active provider
  renderProviderConfig();

  // Show modal
  document.getElementById('settings-overlay').style.display = 'flex';
}

export function closeSettings() {
  document.getElementById('settings-overlay').style.display = 'none';
  settingsData = null;
}

// ─── Language Grid ──────────────────────────────────────────────────────────

function renderLanguageGrid() {
  const grid = document.getElementById('settings-language-grid');
  if (!grid) return;
  grid.innerHTML = '';

  for (const lang of AI_LANGUAGES) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'settings-language-btn' + (selectedLanguage === lang.code ? ' active' : '');
    btn.innerHTML = `<span class="language-flag">${lang.flag}</span><span>${lang.label}</span>`;
    btn.addEventListener('click', () => {
      selectedLanguage = lang.code;
      renderLanguageGrid();
    });
    grid.appendChild(btn);
  }
}

// ─── Provider Grid ──────────────────────────────────────────────────────────

function renderProviderGrid() {
  const grid = document.getElementById('settings-provider-grid');
  grid.innerHTML = '';

  // "None" button
  const noneBtn = document.createElement('button');
  noneBtn.type = 'button';
  noneBtn.className = 'settings-provider-btn none-btn' + (selectedProvider === '' ? ' active' : '');
  noneBtn.innerHTML = `<span class="provider-icon"><i class="fas fa-ban"></i></span><span>None</span>`;
  noneBtn.addEventListener('click', () => {
    selectedProvider = '';
    renderProviderGrid();
    renderProviderConfig();
  });
  grid.appendChild(noneBtn);

  // Provider buttons
  for (const [key, meta] of Object.entries(PROVIDER_META)) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'settings-provider-btn' + (selectedProvider === key ? ' active' : '');
    btn.innerHTML = `<span class="provider-icon"><i class="fas ${meta.icon}"></i></span><span>${meta.label}</span>`;
    btn.addEventListener('click', () => {
      selectedProvider = key;
      renderProviderGrid();
      renderProviderConfig();
    });
    grid.appendChild(btn);
  }
}

// ─── Provider Config Fields ─────────────────────────────────────────────────

function renderProviderConfig() {
  const container = document.getElementById('settings-provider-config');

  if (!selectedProvider) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'block';
  container.innerHTML = '';

  const meta = PROVIDER_META[selectedProvider];
  const def = settingsData.providerDefs[selectedProvider];
  const savedConfig = settingsData.providers[selectedProvider] || {};

  // Header
  const h4 = document.createElement('h4');
  h4.innerHTML = `<i class="fas ${meta.icon}"></i> ${meta.label} <span class="provider-config-badge">Active</span>`;
  container.appendChild(h4);

  // Fields
  for (const field of def.fields) {
    const fieldDiv = document.createElement('div');
    fieldDiv.className = 'settings-field';

    const label = document.createElement('label');
    label.textContent = FIELD_LABELS[field] || field;
    fieldDiv.appendChild(label);

    const isKey = field.toLowerCase().includes('api_key');

    if (isKey) {
      // API key with show/hide toggle
      const row = document.createElement('div');
      row.className = 'settings-key-row';

      const input = document.createElement('input');
      input.type = 'password';
      input.id = 'settings-field-' + field;
      input.value = savedConfig[field] || '';
      input.placeholder = def.defaults[field] || '';
      input.autocomplete = 'off';
      input.spellcheck = false;

      const toggleBtn = document.createElement('button');
      toggleBtn.type = 'button';
      toggleBtn.className = 'settings-key-toggle';
      toggleBtn.innerHTML = '<i class="fas fa-eye"></i>';
      toggleBtn.addEventListener('click', () => {
        if (input.type === 'password') {
          input.type = 'text';
          toggleBtn.innerHTML = '<i class="fas fa-eye-slash"></i>';
        } else {
          input.type = 'password';
          toggleBtn.innerHTML = '<i class="fas fa-eye"></i>';
        }
      });

      row.appendChild(input);
      row.appendChild(toggleBtn);
      fieldDiv.appendChild(row);
    } else {
      const input = document.createElement('input');
      input.type = 'text';
      input.id = 'settings-field-' + field;
      input.value = savedConfig[field] || '';
      input.placeholder = def.defaults[field] || '';
      input.autocomplete = 'off';
      input.spellcheck = false;
      fieldDiv.appendChild(input);
    }

    container.appendChild(fieldDiv);
  }
}

// ─── Browse Folder ──────────────────────────────────────────────────────────

export async function settingsBrowse() {
  if (window.__TAURI__?.core) {
    try {
      const chosen = await window.__TAURI__.core.invoke('pick_folder');
      if (chosen) document.getElementById('settings-docs-root').value = chosen;
      return;
    } catch (_) {}
  }
  // Fallback — make input editable for manual entry
  const input = document.getElementById('settings-docs-root');
  input.removeAttribute('readonly');
  input.focus();
}

// ─── Save Settings ──────────────────────────────────────────────────────────

export async function saveSettings() {
  const newDocsRoot = document.getElementById('settings-docs-root').value.trim();
  const docsRootChanged = newDocsRoot !== originalDocsRoot;

  // Collect provider config from form fields
  const providerConfigs = {};
  if (selectedProvider && settingsData.providerDefs[selectedProvider]) {
    const def = settingsData.providerDefs[selectedProvider];
    const config = {};
    for (const field of def.fields) {
      const input = document.getElementById('settings-field-' + field);
      if (input) config[field] = input.value.trim();
    }
    providerConfigs[selectedProvider] = config;
  }

  const payload = {
    activeProvider: selectedProvider,
    providerConfigs,
  };

  if (docsRootChanged) {
    payload.docsRoot = newDocsRoot;
  }

  try {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (!data.success) {
      showToast(data.error || 'Failed to save settings', { type: 'error' });
      return;
    }

    // If docs folder changed, clear stale localStorage data
    if (docsRootChanged) {
      _clearFolderSpecificCache();
      showToast('Documents folder changed. Cached data cleared.', { type: 'info' });
    }

    // Refresh AI status
    await initAI();

    // Save language preference
    setAILanguage(selectedLanguage);

    // Refresh tree
    await refreshTree();

    closeSettings();
    showToast('Settings saved.', { type: 'success' });
  } catch (err) {
    showToast('Error saving settings: ' + err.message, { type: 'error' });
  }
}

// ─── Clear folder-specific localStorage ─────────────────────────────────────

function _clearFolderSpecificCache() {
  // Clear open tabs
  setOpenTabs([]);
  setActiveTabPath(null);
  renderTabs();

  // Hide editor, show empty state
  const editorView = document.getElementById('editor-view');
  const emptyState = document.getElementById('empty-state');
  if (editorView) editorView.style.display = 'none';
  if (emptyState) emptyState.style.display = 'flex';

  // Clear drafts and AI summaries from localStorage
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (
      key.startsWith('docwebapp:draft:') ||
      key.startsWith('docwebapp:ai:summary:')
    )) {
      keysToRemove.push(key);
    }
  }
  for (const key of keysToRemove) {
    localStorage.removeItem(key);
  }

  // Clear expanded folders and last file
  localStorage.removeItem('docwebapp:expandedFolders');
  localStorage.removeItem('docwebapp:lastFile');
  localStorage.removeItem('docwebapp:openTabs');
}
