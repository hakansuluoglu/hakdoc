// ─── Modals & Context Menu ──────────────────────────────────────────
import {
  currentFilePath, isEditing, modalCallback,
  ctxTargetPath, ctxTargetType, moveSourcePath, moveSelectedFolder,
  setCurrentFilePath, setModalCallback, setCtxTarget,
  setMoveSourcePath, setMoveSelectedFolder, setMoveTreeData, clearDraft
} from './state.js';
import { refreshTree } from './tree.js';
import { loadFile, toggleEdit } from './editor.js';

// ─── Generic Modal ──────────────────────────────────────────────────
export function showModal(title, placeholder, value, callback) {
  document.getElementById('modal-title').textContent = title;
  const input = document.getElementById('modal-input');
  input.placeholder = placeholder;
  input.value = value || '';
  document.getElementById('modal-overlay').style.display = 'flex';
  setModalCallback(callback);
  setTimeout(() => input.focus(), 50);

  input.onkeydown = (e) => {
    if (e.key === 'Enter') modalOk();
    if (e.key === 'Escape') modalCancel();
  };
}

export function modalOk() {
  const value = document.getElementById('modal-input').value.trim();
  document.getElementById('modal-overlay').style.display = 'none';
  if (modalCallback) modalCallback(value);
  setModalCallback(null);
}

export function modalCancel() {
  document.getElementById('modal-overlay').style.display = 'none';
  setModalCallback(null);
}

// ─── Create Folder / File ───────────────────────────────────────────
export function createFolder(parentPath) {
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

export function createFile(parentPath) {
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

// ─── Context Menu ───────────────────────────────────────────────────
export function showContextMenu(e, itemPath, itemType) {
  setCtxTarget(itemPath, itemType);

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

export function setupContextMenuClose() {
  document.addEventListener('click', () => {
    document.getElementById('context-menu').style.display = 'none';
  });
  document.addEventListener('contextmenu', (e) => {
    if (!e.target.closest('#file-tree')) {
      document.getElementById('context-menu').style.display = 'none';
    }
  });
}

export function ctxNewFile() {
  document.getElementById('context-menu').style.display = 'none';
  createFile(ctxTargetPath);
}

export function ctxNewFolder() {
  document.getElementById('context-menu').style.display = 'none';
  createFolder(ctxTargetPath);
}

export function ctxRename() {
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
          setCurrentFilePath(data.newPath);
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

export function ctxMove() {
  document.getElementById('context-menu').style.display = 'none';
  setMoveSourcePath(ctxTargetPath);
  showMoveModal();
}

export function ctxDelete() {
  document.getElementById('context-menu').style.display = 'none';
  const isFolder = ctxTargetType === 'folder';
  const msg = isFolder
    ? 'Bu klasörü ve içindeki her şeyi silmek istediğinize emin misiniz?'
    : 'Bu dosyayı silmek istediğinize emin misiniz?';
  if (!confirm(msg)) return;
  fetch('/api/file?path=' + encodeURIComponent(ctxTargetPath), { method: 'DELETE' })
    .then(() => {
      if (currentFilePath === ctxTargetPath || (isFolder && currentFilePath && currentFilePath.startsWith(ctxTargetPath + '/'))) {
        clearDraft(ctxTargetPath);
        setCurrentFilePath(null);
        document.getElementById('editor-view').style.display = 'none';
        document.getElementById('empty-state').style.display = 'flex';
      }
      refreshTree();
    });
}

// ─── Move Modal ─────────────────────────────────────────────────────
async function showMoveModal() {
  try {
    const res = await fetch('/api/tree');
    const data = await res.json();
    setMoveTreeData(data.tree);
    setMoveSelectedFolder('');
    const container = document.getElementById('move-tree');
    container.innerHTML = '';

    const rootItem = document.createElement('div');
    rootItem.className = 'move-tree-item selected';
    rootItem.innerHTML = '<span class="move-icon"><i class="fas fa-home"></i></span> Kök Dizin';
    rootItem.addEventListener('click', () => {
      container.querySelectorAll('.move-tree-item').forEach(el => el.classList.remove('selected'));
      rootItem.classList.add('selected');
      setMoveSelectedFolder('');
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
      setMoveSelectedFolder(item.path);
    });

    container.appendChild(row);
    container.appendChild(children);

    renderMoveTree(item.children, children, depth + 1);
  }
}

export async function moveModalOk() {
  document.getElementById('move-modal-overlay').style.display = 'none';
  if (!moveSourcePath) return;
  await moveFileTo(moveSourcePath, moveSelectedFolder);
  setMoveSourcePath(null);
}

export function moveModalCancel() {
  document.getElementById('move-modal-overlay').style.display = 'none';
  setMoveSourcePath(null);
}

export async function moveFileTo(sourcePath, targetFolder) {
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
        setCurrentFilePath(data.newPath);
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
