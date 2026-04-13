// ─── Editor Module ──────────────────────────────────────────────────
import {
  currentFilePath, isEditing, setActiveTabPath, setIsEditing,
  saveDraft, loadDraft, clearDraft, hasDraft, openTabs, activeTabPath, setOpenTabs
} from './state.js';
import { escapeHtml, debounce, showToast } from './utils.js';
import { refreshTree, highlightFileInTree } from './tree.js';

// ─── Tabs Management ────────────────────────────────────────────────
export function renderTabs() {
  const container = document.getElementById('tabs-container');
  const tabsList = container.querySelector('.tabs-list');
  if (!tabsList) return;

  if (openTabs.length === 0) {
    container.style.display = 'none';
    document.getElementById('editor-view').style.display = 'none';
    document.getElementById('empty-state').style.display = 'flex';
    setActiveTabPath(null);
    return;
  }

  container.style.display = 'flex';
  tabsList.innerHTML = '';
  
  openTabs.forEach(tab => {
    const isUnsaved = hasDraft(tab.path);
    const div = document.createElement('div');
    div.className = 'tab-item' + (tab.path === activeTabPath ? ' active' : '');
    
    const nameSpan = document.createElement('span');
    nameSpan.textContent = tab.name;
    div.appendChild(nameSpan);

    if (isUnsaved) {
      const dot = document.createElement('span');
      dot.className = 'tab-unsaved';
      div.appendChild(dot);
    }

    const closeBtn = document.createElement('i');
    closeBtn.className = 'fas fa-times tab-close';
    closeBtn.title = 'Kapat';
    closeBtn.onclick = (e) => {
      e.stopPropagation();
      closeTab(tab.path);
    };
    div.appendChild(closeBtn);

    div.onclick = () => {
      if (tab.path !== activeTabPath) loadFile(tab.path);
    };
    
    tabsList.appendChild(div);
  });
}

globalThis.closeTab = function(path) {
  let tabs = [...openTabs];
  const idx = tabs.findIndex(t => t.path === path);
  if (idx === -1) return;
  
  tabs.splice(idx, 1);
  setOpenTabs(tabs);
  
  if (path === activeTabPath) {
    if (tabs.length > 0) {
      const nextTab = tabs[Math.min(idx, tabs.length - 1)];
      loadFile(nextTab.path);
    } else {
      renderTabs();
    }
  } else {
    renderTabs();
  }
};


// ─── Marked.js Configuration ────────────────────────────────────────
const highlightExtension = {
  name: 'highlight',
  level: 'inline',
  start(src) { return src.indexOf('=='); },
  tokenizer(src) {
    const match = src.match(/^==([^=]+)==/);
    if (match) {
      return {
        type: 'highlight',
        raw: match[0],
        text: match[1]
      };
    }
  },
  renderer(token) {
    return `<mark>${token.text}</mark>`;
  }
};

export function initMarked() {
  marked.use({ extensions: [highlightExtension] });

  marked.setOptions({
    highlight: function (code, lang) {
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(code, { language: lang }).value;
      }
      return hljs.highlightAuto(code).value;
    },
    breaks: true,
    gfm: true
  });

  const renderer = new marked.Renderer();
  const originalCodeRenderer = renderer.code.bind(renderer);

  renderer.code = function (code, language) {
    if (language === 'mermaid') {
      const id = 'mermaid-' + Math.random().toString(36).substring(2, 11);
      return `<div class="mermaid-container"><div class="mermaid" id="${id}">${code}</div></div>`;
    }
    return originalCodeRenderer(code, language);
  };

  // GitHub-style callout/alert rendering in blockquotes
  const originalBlockquote = renderer.blockquote.bind(renderer);
  renderer.blockquote = function (quote) {
    // Match [!TYPE] pattern at start of blockquote
    const alertMatch = quote.match(/^\s*<p>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*<br>?\s*/i);
    if (alertMatch) {
      const type = alertMatch[1].toUpperCase();
      const iconMap = {
        NOTE: 'fa-info-circle',
        TIP: 'fa-lightbulb',
        IMPORTANT: 'fa-exclamation-circle',
        WARNING: 'fa-exclamation-triangle',
        CAUTION: 'fa-radiation'
      };
      const content = quote.replace(alertMatch[0], '<p>');
      return `<div class="gh-alert gh-alert-${type.toLowerCase()}">
        <div class="gh-alert-title"><i class="fas ${iconMap[type]}"></i> ${type}</div>
        <div class="gh-alert-content">${content}</div>
      </div>`;
    }
    return originalBlockquote(quote);
  };

  marked.setOptions({ renderer });
}

// ─── Mermaid Configuration ──────────────────────────────────────────
export function initMermaid() {
  mermaid.initialize({
    startOnLoad: false,
    theme: 'dark',
    themeVariables: {
      background: '#161b22',
      primaryColor: '#58a6ff',
      primaryTextColor: '#e6edf3',
      primaryBorderColor: '#30363d',
      lineColor: '#8b949e',
      secondaryColor: '#1c2128',
      tertiaryColor: '#0d1117'
    }
  });
}

async function renderMermaidDiagrams() {
  const mermaidEls = document.querySelectorAll('.mermaid');
  for (const el of mermaidEls) {
    const code = el.textContent;
    const id = el.id;
    try {
      const { svg } = await mermaid.render(id + '-svg', code);
      el.innerHTML = svg;
    } catch (err) {
      el.innerHTML = '<p style="color:var(--red);font-size:12px;">Mermaid render hatası: ' + escapeHtml(err.message || String(err)) + '</p>';
    }
  }
}

// ─── Auto-save (debounced) ──────────────────────────────────────────
const debouncedDraftSave = debounce((filePath, content) => {
  saveDraft(filePath, content);
  updateUnsavedIndicator(true);
}, 500);

export function setupEditorAutoSave() {
  const editor = document.getElementById('markdown-editor');
  editor.addEventListener('input', () => {
    if (currentFilePath && isEditing) {
      debouncedDraftSave(currentFilePath, editor.value);
    }
  });
}

function updateUnsavedIndicator(hasUnsaved) {
  const dot = document.getElementById('unsaved-dot');
  if (dot) {
    dot.style.display = hasUnsaved ? 'inline-block' : 'none';
  }
}

// ─── File Loading ───────────────────────────────────────────────────
export async function loadFile(filePath) {
  try {
    const ext = filePath.split('.').pop().toLowerCase();
    const isPDF = ext === 'pdf';
    const fileName = filePath.split('/').pop('');

    // update tabs
    let tabs = [...openTabs];
    if (!tabs.find(t => t.path === filePath)) {
      tabs.push({ path: filePath, name: fileName });
      setOpenTabs(tabs);
    }
    setActiveTabPath(filePath);
    renderTabs();

    setIsEditing(false);

    document.getElementById('empty-state').style.display = 'none';
    document.getElementById('editor-view').style.display = 'flex';
    document.getElementById('markdown-editor').style.display = 'none';
    document.getElementById('format-toolbar').style.display = 'none';
    const btnEdit = document.getElementById('btn-edit');
    if (btnEdit) {
        btnEdit.classList.remove('active');
        btnEdit.style.display = 'none';
    }
    document.getElementById('btn-save').style.display = 'none';
    
    document.getElementById('file-name').textContent = fileName;
    document.getElementById('file-path-display').textContent = filePath;
    updateUnsavedIndicator(false);
    
    document.getElementById('markdown-preview').style.display = 'none';
    document.getElementById('pdf-viewer').style.display = 'none';

    if (isPDF) {
      const pdfViewer = document.getElementById('pdf-viewer');
      pdfViewer.style.display = 'block';
      let rawUrl = '/raw/' + filePath.split('/').map(encodeURIComponent).join('/');
      pdfViewer.src = rawUrl;
      highlightFileInTree(filePath);
      return;
    }
    
    document.getElementById('markdown-preview').style.display = 'block';

    const res = await fetch('/api/file?path=' + encodeURIComponent(filePath));
    if (!res.ok) throw new Error('File not found');
    const data = await res.json();

    const isMarkdown = ['md', 'markdown'].includes(ext);

    document.getElementById('file-name').textContent = data.name;
    document.getElementById('file-path-display').textContent = filePath;
    updateUnsavedIndicator(false);

    if (isMarkdown) {
      document.getElementById('btn-edit').style.display = '';
      document.getElementById('markdown-preview').innerHTML = marked.parse(data.content);
      renderMermaidDiagrams();
    } else {
      document.getElementById('btn-edit').style.display = '';
      document.getElementById('markdown-preview').innerHTML =
        '<pre style="background:var(--bg-tertiary);border:1px solid var(--border);border-radius:8px;padding:16px;overflow-x:auto;"><code>' +
        escapeHtml(data.content) + '</code></pre>';
    }

    document.getElementById('markdown-editor').value = data.content;

    // Check for unsaved draft
    const draft = loadDraft(filePath);
    if (draft && draft.content !== data.content) {
      const timeAgo = getRelativeTime(draft.timestamp);
      showToast(`Kaydedilmemiş değişiklik bulundu (${timeAgo})`, {
        type: 'warning',
        actions: [
          {
            label: 'Geri Yükle',
            onClick: () => {
              document.getElementById('markdown-editor').value = draft.content;
              if (!isEditing) toggleEdit();
              updateUnsavedIndicator(true);
              showToast('Draft geri yüklendi', { type: 'success', duration: 2000 });
            }
          },
          {
            label: 'Yok Say',
            onClick: () => {
              clearDraft(filePath);
            }
          }
        ]
      });
    } else if (draft && draft.content === data.content) {
      // Draft matches saved content, clean it up
      clearDraft(filePath);
    }

    // Highlight in tree
    highlightFileInTree(filePath);
  } catch (err) {
    console.error('Load error:', err);
  }
}

function getRelativeTime(timestamp) {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'az önce';
  if (minutes < 60) return `${minutes} dk önce`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} saat önce`;
  const days = Math.floor(hours / 24);
  return `${days} gün önce`;
}

// ─── Edit Toggle ────────────────────────────────────────────────────
export function toggleEdit() {
  setIsEditing(!isEditing);
  const editor = document.getElementById('markdown-editor');
  const preview = document.getElementById('markdown-preview');
  const toolbar = document.getElementById('format-toolbar');
  const btnEdit = document.getElementById('btn-edit');
  const btnSave = document.getElementById('btn-save');

  if (isEditing) {
    editor.style.display = 'block';
    preview.style.display = 'none';
    toolbar.style.display = 'flex';
    btnEdit.classList.add('active');
    btnSave.style.display = '';
    editor.focus();
  } else {
    editor.style.display = 'none';
    preview.style.display = 'block';
    toolbar.style.display = 'none';
    btnEdit.classList.remove('active');
    btnSave.style.display = 'none';

    const content = editor.value;
    const ext = currentFilePath.split('.').pop().toLowerCase();
    const isMarkdown = ['md', 'markdown'].includes(ext);
    if (isMarkdown) {
      preview.innerHTML = marked.parse(content);
      renderMermaidDiagrams();
    } else {
      preview.innerHTML =
        '<pre style="background:var(--bg-tertiary);border:1px solid var(--border);border-radius:8px;padding:16px;overflow-x:auto;"><code>' +
        escapeHtml(content) + '</code></pre>';
    }
  }
}

// ─── Save File ──────────────────────────────────────────────────────
export async function saveFile() {
  if (!currentFilePath) return;
  const content = document.getElementById('markdown-editor').value;

  try {
    const res = await fetch('/api/file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath: currentFilePath, content })
    });
    const data = await res.json();
    if (data.success) {
      clearDraft(currentFilePath);
      updateUnsavedIndicator(false);
      showToast('Dosya kaydedildi', { type: 'success', duration: 2000 });
      toggleEdit();
    }
  } catch (err) {
    console.error('Save error:', err);
    showToast('Kaydetme hatası!', { type: 'error', duration: 3000 });
  }
}

export function deleteCurrent() {
  if (!currentFilePath) return;
  if (!confirm('Bu dosyayı silmek istediğinize emin misiniz?')) return;
  fetch('/api/file?path=' + encodeURIComponent(currentFilePath), { method: 'DELETE' })
    .then(() => {
      clearDraft(currentFilePath);
      let tabs = [...openTabs];
      tabs = tabs.filter(t => t.path !== currentFilePath);
      setOpenTabs(tabs);
      
      if (tabs.length > 0) {
        loadFile(tabs[0].path);
      } else {
        setActiveTabPath(null);
        document.getElementById('editor-view').style.display = 'none';
        document.getElementById('empty-state').style.display = 'flex';
      }
      refreshTree();
    });
}

// ─── Drag & Drop Upload ─────────────────────────────────────────────
export function setupDragAndDrop() {
  const overlay = document.getElementById('drop-overlay');
  
  // Prevent default behavior for whole window
  window.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes('Files')) {
      overlay.style.display = 'flex';
    }
  });

  window.addEventListener('dragleave', (e) => {
    e.preventDefault();
    if (e.target === overlay) {
      overlay.style.display = 'none';
      overlay.classList.remove('drag-over');
    }
  });

  overlay.addEventListener('dragover', (e) => {
    e.preventDefault();
    overlay.classList.add('drag-over');
  });

  overlay.addEventListener('drop', async (e) => {
    e.preventDefault();
    overlay.style.display = 'none';
    overlay.classList.remove('drag-over');
    
    const files = e.dataTransfer.files;
    if (!files.length) return;

    // Use current active directory or root
    let targetFolder = '';
    if (currentFilePath) {
      targetFolder = currentFilePath.split('/').slice(0, -1).join('/');
    }

    const formData = new FormData();
    formData.append('targetFolder', targetFolder);
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        showToast(`${files.length} dosya yüklendi`, { type: 'success', duration: 3000 });
        await refreshTree();
        // Load the last uploaded file to preview it
        const lastFileName = files[files.length - 1].name;
        const uploadPath = targetFolder ? targetFolder + '/' + lastFileName : lastFileName;
        loadFile(uploadPath);
      } else {
        showToast('Yükleme hatası: ' + data.error, { type: 'error', duration: 4000 });
      }
    } catch(err) {
      showToast('Yükleme sırasında hata oluştu', { type: 'error', duration: 4000 });
    }
  });
}

// ─── Format Toolbar ─────────────────────────────────────────────────
export function insertFormat(type) {
  const editor = document.getElementById('markdown-editor');
  const start = editor.selectionStart;
  const end = editor.selectionEnd;
  const text = editor.value;
  const selected = text.substring(start, end);

  let before = '', after = '', newCursorPos = start;

  // Get current line for heading cycling
  if (type === 'heading') {
    const lineStart = text.lastIndexOf('\n', start - 1) + 1;
    const lineEnd = text.indexOf('\n', start);
    const currentLine = text.substring(lineStart, lineEnd === -1 ? text.length : lineEnd);

    const headingMatch = currentLine.match(/^(#{1,6})\s/);
    let newLine;
    if (!headingMatch) {
      newLine = '# ' + currentLine;
    } else if (headingMatch[1].length >= 4) {
      // Remove heading — cycle back to plain text
      newLine = currentLine.replace(/^#{1,6}\s/, '');
    } else {
      newLine = '#' + currentLine;
    }

    editor.value = text.substring(0, lineStart) + newLine + text.substring(lineEnd === -1 ? text.length : lineEnd);
    const newPos = lineStart + newLine.length;
    editor.focus();
    editor.setSelectionRange(newPos, newPos);
    return;
  }

  switch (type) {
    case 'bold':
      before = '**'; after = '**'; newCursorPos = start + 2;
      break;
    case 'italic':
      before = '*'; after = '*'; newCursorPos = start + 1;
      break;
    case 'strikethrough':
      before = '~~'; after = '~~'; newCursorPos = start + 2;
      break;
    case 'code':
      before = '`'; after = '`'; newCursorPos = start + 1;
      break;
    case 'codeblock':
      before = '```\n'; after = '\n```'; newCursorPos = start + 4;
      break;
    case 'link':
      before = '['; after = '](url)'; newCursorPos = start + 1;
      break;
    case 'image':
      before = '!['; after = '](url)'; newCursorPos = start + 2;
      break;
    case 'ul':
      before = '- '; after = ''; newCursorPos = start + 2;
      break;
    case 'ol':
      before = '1. '; after = ''; newCursorPos = start + 3;
      break;
    case 'checklist':
      before = '- [ ] '; after = ''; newCursorPos = start + 6;
      break;
    case 'quote':
      before = '> '; after = ''; newCursorPos = start + 2;
      break;
    case 'table':
      before = '| Header 1 | Header 2 | Header 3 |\n| --- | --- | --- |\n| ';
      after = ' |  |  |';
      newCursorPos = start + before.length;
      break;
    case 'mermaid':
      before = '```mermaid\n';
      after = '\n```';
      newCursorPos = start + before.length;
      if (!selected) {
        const template = 'graph TD\n    A[Başlangıç] --> B[Bitiş]';
        editor.value = text.substring(0, start) + before + template + after + text.substring(end);
        newCursorPos = start + before.length + template.length;
        editor.focus();
        editor.setSelectionRange(newCursorPos, newCursorPos);
        return;
      }
      break;
    case 'hr':
      before = '\n---\n'; after = ''; newCursorPos = start + 5;
      break;

    // ── New Formats ───────────────────────────────────────
    case 'highlight':
      before = '=='; after = '=='; newCursorPos = start + 2;
      break;
    case 'footnote': {
      const fnAfter = '[^1]';
      editor.value = text.substring(0, start) + selected + fnAfter + text.substring(end) + '\n\n[^1]: ';
      editor.focus();
      const footnotePos = editor.value.length;
      editor.setSelectionRange(footnotePos, footnotePos);
      return;
    }
    case 'callout':
      before = '> [!NOTE]\n> ';
      newCursorPos = start + before.length;
      break;
    case 'superscript':
      before = '<sup>'; after = '</sup>'; newCursorPos = start + 5;
      break;
    case 'subscript':
      before = '<sub>'; after = '</sub>'; newCursorPos = start + 5;
      break;
  }

  editor.value = text.substring(0, start) + before + selected + after + text.substring(end);
  editor.focus();

  if (selected) {
    editor.setSelectionRange(start + before.length, start + before.length + selected.length);
  } else {
    editor.setSelectionRange(newCursorPos, newCursorPos);
  }
}
