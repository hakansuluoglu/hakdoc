let currentFilePath = null;
let isEditing = false;
let modalCallback = null;
let ctxTargetPath = null;
let ctxTargetType = null;
let moveSourcePath = null;
let moveSelectedFolder = null;
let moveTreeData = null;

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
    const id = 'mermaid-' + Math.random().toString(36).substr(2, 9);
    return `<div class="mermaid-container"><div class="mermaid" id="${id}">${code}</div></div>`;
  }
  return originalCodeRenderer(code, language);
};

marked.setOptions({ renderer });

document.addEventListener('DOMContentLoaded', () => {
  refreshTree();
  setupKeyboardShortcuts();
  setupAutoRefresh();
  setupContextMenuClose();
});

function setupContextMenuClose() {
  document.addEventListener('click', () => {
    document.getElementById('context-menu').style.display = 'none';
  });
  document.addEventListener('contextmenu', (e) => {
    if (!e.target.closest('#file-tree')) {
      document.getElementById('context-menu').style.display = 'none';
    }
  });
}

function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      if (isEditing) saveFile();
    }
    if (e.key === 'Escape') {
      if (document.getElementById('modal-overlay').style.display !== 'none') {
        modalCancel();
      } else if (isEditing) {
        toggleEdit();
      }
    }
  });
}

let refreshTimer = null;
function setupAutoRefresh() {
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && currentFilePath && !isEditing) {
      loadFile(currentFilePath);
    }
  });
}

let expandedFolders = new Set();

async function refreshTree() {
  try {
    document.querySelectorAll('.tree-children.open').forEach(el => {
      const row = el.previousElementSibling;
      if (row && row.dataset.path) {
        expandedFolders.add(row.dataset.path);
      }
    });

    const res = await fetch('/api/tree');
    const data = await res.json();
    const container = document.getElementById('file-tree');
    container.innerHTML = '';
    renderTree(data.tree, container, 0);

    container.querySelectorAll('.tree-children').forEach(children => {
      const row = children.previousElementSibling;
      if (row && row.dataset.path && expandedFolders.has(row.dataset.path)) {
        const chevron = row.querySelector('.chevron');
        const icon = row.querySelector('.folder-icon');
        if (chevron) chevron.classList.add('open');
        children.classList.add('open');
        if (icon) icon.innerHTML = '<i class="fas fa-folder-open"></i>';
      }
    });
  } catch (err) {
    console.error('Tree refresh error:', err);
  }
}

function renderTree(items, container, depth) {
  for (const item of items) {
    const wrapper = document.createElement('div');

    const row = document.createElement('div');
    row.className = 'tree-item';
    row.style.paddingLeft = (12 + depth * 16) + 'px';

    if (item.type === 'folder') {
      const chevron = document.createElement('span');
      chevron.className = 'chevron';
      chevron.innerHTML = '<i class="fas fa-chevron-right"></i>';
      row.appendChild(chevron);

      const icon = document.createElement('span');
      icon.className = 'icon folder-icon';
      icon.innerHTML = '<i class="fas fa-folder"></i>';
      row.appendChild(icon);

      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = item.name;
      row.appendChild(name);

      row.dataset.path = item.path;
      row.dataset.type = 'folder';
      row.draggable = false;

      row.addEventListener('click', () => {
        const children = wrapper.querySelector('.tree-children');
        const isOpen = children.classList.contains('open');
        chevron.classList.toggle('open', !isOpen);
        children.classList.toggle('open', !isOpen);
        icon.innerHTML = isOpen ? '<i class="fas fa-folder"></i>' : '<i class="fas fa-folder-open"></i>';
        if (isOpen) {
          expandedFolders.delete(item.path);
        } else {
          expandedFolders.add(item.path);
        }
      });

      row.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showContextMenu(e, item.path, 'folder');
      });

      row.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        row.classList.add('drag-over');
      });

      row.addEventListener('dragleave', () => {
        row.classList.remove('drag-over');
      });

      row.addEventListener('drop', (e) => {
        e.preventDefault();
        row.classList.remove('drag-over');
        const srcPath = e.dataTransfer.getData('text/plain');
        if (srcPath && srcPath !== item.path) {
          moveFileTo(srcPath, item.path);
        }
      });

      wrapper.appendChild(row);

      const children = document.createElement('div');
      children.className = 'tree-children';
      renderTree(item.children, children, depth + 1);
      wrapper.appendChild(children);
    } else {
      const chevron = document.createElement('span');
      chevron.className = 'chevron hidden';
      chevron.innerHTML = '<i class="fas fa-chevron-right"></i>';
      row.appendChild(chevron);

      const icon = document.createElement('span');
      icon.className = 'icon file-icon';
      const ext = item.name.split('.').pop().toLowerCase();
      if (['md', 'markdown'].includes(ext)) {
        icon.innerHTML = '<i class="fab fa-markdown" style="color:#519aba"></i>';
      } else if (['js', 'ts', 'jsx', 'tsx'].includes(ext)) {
        icon.innerHTML = '<i class="fab fa-js" style="color:#f7df1e"></i>';
      } else if (['py'].includes(ext)) {
        icon.innerHTML = '<i class="fab fa-python" style="color:#3776ab"></i>';
      } else if (['json'].includes(ext)) {
        icon.innerHTML = '<i class="fas fa-cog" style="color:#8b949e"></i>';
      } else if (['html', 'htm'].includes(ext)) {
        icon.innerHTML = '<i class="fab fa-html5" style="color:#e34c26"></i>';
      } else if (['css'].includes(ext)) {
        icon.innerHTML = '<i class="fab fa-css3-alt" style="color:#1572b6"></i>';
      } else if (['txt'].includes(ext)) {
        icon.innerHTML = '<i class="fas fa-file-alt"></i>';
      } else if (['pdf'].includes(ext)) {
        icon.innerHTML = '<i class="fas fa-file-pdf" style="color:#f85149"></i>';
      } else {
        icon.innerHTML = '<i class="fas fa-file"></i>';
      }
      row.appendChild(icon);

      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = item.name;
      row.appendChild(name);

      row.dataset.path = item.path;
      row.dataset.type = 'file';
      row.draggable = true;

      row.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', item.path);
        e.dataTransfer.effectAllowed = 'move';
        row.classList.add('dragging');
      });

      row.addEventListener('dragend', () => {
        row.classList.remove('dragging');
        document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
      });

      row.addEventListener('click', () => {
        loadFile(item.path);
        highlightActive(row);
      });

      row.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showContextMenu(e, item.path, 'file');
      });

      wrapper.appendChild(row);
    }

    container.appendChild(wrapper);
  }
}

function highlightActive(row) {
  document.querySelectorAll('.tree-item.active').forEach(el => el.classList.remove('active'));
  row.classList.add('active');
}

async function loadFile(filePath) {
  try {
    const res = await fetch('/api/file?path=' + encodeURIComponent(filePath));
    if (!res.ok) throw new Error('File not found');
    const data = await res.json();

    currentFilePath = filePath;
    isEditing = false;

    document.getElementById('empty-state').style.display = 'none';
    document.getElementById('editor-view').style.display = 'flex';
    document.getElementById('markdown-editor').style.display = 'none';
    document.getElementById('format-toolbar').style.display = 'none';
    document.getElementById('markdown-preview').style.display = 'block';
    document.getElementById('btn-edit').classList.remove('active');
    document.getElementById('btn-save').style.display = 'none';

    const ext = filePath.split('.').pop().toLowerCase();
    const isMarkdown = ['md', 'markdown'].includes(ext);

    document.getElementById('file-name').textContent = data.name;
    document.getElementById('file-path-display').textContent = filePath;

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
  } catch (err) {
    console.error('Load error:', err);
  }
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

function toggleEdit() {
  isEditing = !isEditing;
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

async function saveFile() {
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
      toggleEdit();
    }
  } catch (err) {
    console.error('Save error:', err);
  }
}

function createFolder(parentPath) {
  showModal('Yeni Klasör', 'Klasör adı', '', (name) => {
    if (!name) return;
    const folderPath = parentPath ? parentPath + '/' + name : name;
    fetch('/api/folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderPath })
    }).then(() => refreshTree());
  });
}

function createFile(parentPath) {
  showModal('Yeni Dosya', 'Dosya adı', '', (name) => {
    if (!name) return;
    if (!name.includes('.')) name += '.md';
    const filePath = parentPath ? parentPath + '/' + name : name;
    fetch('/api/file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath, content: '' })
    }).then(async () => {
      await refreshTree();
      await loadFile(filePath);
      if (!isEditing) toggleEdit();
    });
  });
}

function deleteCurrent() {
  if (!currentFilePath) return;
  if (!confirm('Bu dosyayı silmek istediğinize emin misiniz?')) return;
  fetch('/api/file?path=' + encodeURIComponent(currentFilePath), { method: 'DELETE' })
    .then(() => {
      currentFilePath = null;
      document.getElementById('editor-view').style.display = 'none';
      document.getElementById('empty-state').style.display = 'flex';
      refreshTree();
    });
}

function insertFormat(type) {
  const editor = document.getElementById('markdown-editor');
  const start = editor.selectionStart;
  const end = editor.selectionEnd;
  const text = editor.value;
  const selected = text.substring(start, end);

  let before = '', after = '', newCursorPos = start;

  switch (type) {
    case 'heading':
      before = '## ';
      after = '';
      newCursorPos = start + 3;
      break;
    case 'bold':
      before = '**';
      after = '**';
      newCursorPos = start + 2;
      break;
    case 'italic':
      before = '*';
      after = '*';
      newCursorPos = start + 1;
      break;
    case 'strikethrough':
      before = '~~';
      after = '~~';
      newCursorPos = start + 2;
      break;
    case 'code':
      before = '`';
      after = '`';
      newCursorPos = start + 1;
      break;
    case 'codeblock':
      before = '```\n';
      after = '\n```';
      newCursorPos = start + 4;
      break;
    case 'link':
      before = '[';
      after = '](url)';
      newCursorPos = start + 1;
      break;
    case 'image':
      before = '![';
      after = '](url)';
      newCursorPos = start + 2;
      break;
    case 'ul':
      before = '- ';
      after = '';
      newCursorPos = start + 2;
      break;
    case 'ol':
      before = '1. ';
      after = '';
      newCursorPos = start + 3;
      break;
    case 'checklist':
      before = '- [ ] ';
      after = '';
      newCursorPos = start + 6;
      break;
    case 'quote':
      before = '> ';
      after = '';
      newCursorPos = start + 2;
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
      before = '\n---\n';
      after = '';
      newCursorPos = start + 5;
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

function showModal(title, placeholder, value, callback) {
  document.getElementById('modal-title').textContent = title;
  const input = document.getElementById('modal-input');
  input.placeholder = placeholder;
  input.value = value || '';
  document.getElementById('modal-overlay').style.display = 'flex';
  modalCallback = callback;
  setTimeout(() => input.focus(), 50);

  input.onkeydown = (e) => {
    if (e.key === 'Enter') modalOk();
    if (e.key === 'Escape') modalCancel();
  };
}

function modalOk() {
  const value = document.getElementById('modal-input').value.trim();
  document.getElementById('modal-overlay').style.display = 'none';
  if (modalCallback) modalCallback(value);
  modalCallback = null;
}

function modalCancel() {
  document.getElementById('modal-overlay').style.display = 'none';
  modalCallback = null;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showContextMenu(e, itemPath, itemType) {
  ctxTargetPath = itemPath;
  ctxTargetType = itemType;

  const menu = document.getElementById('context-menu');
  const ctxNewFile = document.getElementById('ctx-new-file');
  const ctxNewFolder = document.getElementById('ctx-new-folder');
  const ctxRename = document.getElementById('ctx-rename');
  const ctxMove = document.getElementById('ctx-move');

  if (itemType === 'folder') {
    ctxNewFile.style.display = '';
    ctxNewFolder.style.display = '';
    ctxRename.style.display = '';
    ctxMove.style.display = '';
  } else {
    ctxNewFile.style.display = 'none';
    ctxNewFolder.style.display = 'none';
    ctxRename.style.display = '';
    ctxMove.style.display = '';
  }

  menu.style.display = 'block';

  const menuRect = menu.getBoundingClientRect();
  let x = e.clientX;
  let y = e.clientY;
  if (x + menuRect.width > window.innerWidth) x = window.innerWidth - menuRect.width - 4;
  if (y + menuRect.height > window.innerHeight) y = window.innerHeight - menuRect.height - 4;
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
}

function ctxNewFile() {
  document.getElementById('context-menu').style.display = 'none';
  createFile(ctxTargetPath);
}

function ctxNewFolder() {
  document.getElementById('context-menu').style.display = 'none';
  createFolder(ctxTargetPath);
}

function ctxRename() {
  document.getElementById('context-menu').style.display = 'none';
  const oldName = ctxTargetPath.includes('/') ? ctxTargetPath.split('/').pop() : ctxTargetPath;
  showModal('Yeniden Adlandır', 'Yeni ad', oldName, async (newName) => {
    if (!newName || newName === oldName) return;
    try {
      const res = await fetch('/api/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPath: ctxTargetPath, newName })
      });
      const data = await res.json();
      if (data.success) {
        if (currentFilePath === ctxTargetPath) {
          currentFilePath = data.newPath;
          document.getElementById('file-path-display').textContent = data.newPath;
          document.getElementById('file-name').textContent = newName;
        }
        refreshTree();
      }
    } catch (err) {
      console.error('Rename error:', err);
    }
  });
}

function ctxMove() {
  document.getElementById('context-menu').style.display = 'none';
  moveSourcePath = ctxTargetPath;
  showMoveModal();
}

function ctxDelete() {
  document.getElementById('context-menu').style.display = 'none';
  const isFolder = ctxTargetType === 'folder';
  const msg = isFolder
    ? 'Bu klasörü ve içindeki her şeyi silmek istediğinize emin misiniz?'
    : 'Bu dosyayı silmek istediğinize emin misiniz?';
  if (!confirm(msg)) return;
  fetch('/api/file?path=' + encodeURIComponent(ctxTargetPath), { method: 'DELETE' })
    .then(() => {
      if (currentFilePath === ctxTargetPath || (isFolder && currentFilePath && currentFilePath.startsWith(ctxTargetPath + '/'))) {
        currentFilePath = null;
        document.getElementById('editor-view').style.display = 'none';
        document.getElementById('empty-state').style.display = 'flex';
      }
      refreshTree();
    });
}

async function showMoveModal() {
  try {
    const res = await fetch('/api/tree');
    const data = await res.json();
    moveTreeData = data.tree;
    moveSelectedFolder = '';
    const container = document.getElementById('move-tree');
    container.innerHTML = '';

    const rootItem = document.createElement('div');
    rootItem.className = 'move-tree-item selected';
    rootItem.innerHTML = '<span class="move-icon"><i class="fas fa-home"></i></span> Kök Dizin';
    rootItem.addEventListener('click', () => {
      container.querySelectorAll('.move-tree-item').forEach(el => el.classList.remove('selected'));
      rootItem.classList.add('selected');
      moveSelectedFolder = '';
    });
    container.appendChild(rootItem);

    renderMoveTree(data.tree, container, 0);
    document.getElementById('move-modal-overlay').style.display = 'flex';
  } catch (err) {
    console.error('Move modal error:', err);
  }
}

function renderMoveTree(items, container, depth) {
  for (const item of items) {
    if (item.type !== 'folder') continue;

    const row = document.createElement('div');
    row.className = 'move-tree-item';
    row.style.paddingLeft = (12 + depth * 16) + 'px';

    if (item.path === moveSourcePath || (moveSourcePath && item.path.startsWith(moveSourcePath + '/'))) {
      row.style.opacity = '0.3';
      row.style.pointerEvents = 'none';
    }

    const chevron = document.createElement('span');
    chevron.style.width = '14px';
    chevron.style.marginRight = '4px';
    chevron.style.fontSize = '9px';
    chevron.style.color = 'var(--text-muted)';
    chevron.innerHTML = '<i class="fas fa-chevron-right"></i>';

    const icon = document.createElement('span');
    icon.className = 'move-icon';
    icon.innerHTML = '<i class="fas fa-folder"></i>';

    const name = document.createElement('span');
    name.textContent = item.name;

    row.appendChild(chevron);
    row.appendChild(icon);
    row.appendChild(name);

    const children = document.createElement('div');
    children.className = 'move-tree-children';

    row.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = children.classList.contains('open');
      chevron.innerHTML = isOpen ? '<i class="fas fa-chevron-right"></i>' : '<i class="fas fa-chevron-down"></i>';
      children.classList.toggle('open', !isOpen);
      container.querySelectorAll('.move-tree-item').forEach(el => el.classList.remove('selected'));
      row.classList.add('selected');
      moveSelectedFolder = item.path;
    });

    container.appendChild(row);
    container.appendChild(children);

    renderMoveTree(item.children, children, depth + 1);
  }
}

async function moveModalOk() {
  document.getElementById('move-modal-overlay').style.display = 'none';
  if (!moveSourcePath) return;
  await moveFileTo(moveSourcePath, moveSelectedFolder);
  moveSourcePath = null;
}

function moveModalCancel() {
  document.getElementById('move-modal-overlay').style.display = 'none';
  moveSourcePath = null;
}

async function moveFileTo(sourcePath, targetFolder) {
  try {
    const res = await fetch('/api/move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourcePath, targetFolder })
    });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { throw new Error('Sunucu yanıtı: ' + res.status + ' - ' + text.substring(0, 200)); }
    if (data.success) {
      if (currentFilePath === sourcePath) {
        currentFilePath = data.newPath;
        document.getElementById('file-path-display').textContent = data.newPath;
      }
      refreshTree();
    } else {
      alert(data.error || 'Taşıma başarısız');
    }
  } catch (err) {
    console.error('Move error:', err);
    alert('Taşıma hatası: ' + err.message);
  }
}
