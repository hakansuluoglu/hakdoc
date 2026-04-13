// ─── DocWebApp Entry Point ──────────────────────────────────────────
import { isEditing, restoreExpandedFolders, getLastOpenFile, currentFilePath, sidebarCollapsed, restoreSidebarState, restoreOpenTabs, setSidebarCollapsed } from './state.js';
import { refreshTree } from './tree.js';
import {
  initMarked, initMermaid, setupEditorAutoSave,
  loadFile, toggleEdit, saveFile, deleteCurrent, insertFormat, renderTabs, setupDragAndDrop
} from './editor.js';
import { escapeHtml } from './utils.js';
import {
  modalOk, modalCancel,
  createFolder, createFile,
  setupContextMenuClose,
  ctxNewFile, ctxNewFolder, ctxRename, ctxMove, ctxDelete,
  moveModalOk, moveModalCancel
} from './modals.js';

// ─── Expose functions to window for onclick handlers ────────────────
globalThis.toggleEdit = toggleEdit;
globalThis.saveFile = saveFile;
globalThis.deleteCurrent = deleteCurrent;
globalThis.insertFormat = insertFormat;
globalThis.createFolder = createFolder;
globalThis.createFile = createFile;
globalThis.refreshTree = refreshTree;
globalThis.modalOk = modalOk;
globalThis.modalCancel = modalCancel;
globalThis.ctxNewFile = ctxNewFile;
globalThis.ctxNewFolder = ctxNewFolder;
globalThis.ctxRename = ctxRename;
globalThis.ctxMove = ctxMove;
globalThis.ctxDelete = ctxDelete;
globalThis.moveModalOk = moveModalOk;
globalThis.moveModalCancel = moveModalCancel;

// ─── Initialization ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Init libraries
  initMermaid();
  initMarked();

  // Restore session state
  restoreExpandedFolders();
  restoreSidebarState();
  restoreOpenTabs();

  // Load file tree
  await refreshTree();
  renderTabs();

  if (sidebarCollapsed) {
    document.getElementById('sidebar').classList.add('sidebar-collapsed');
  }

  // Setup features
  setupKeyboardShortcuts();
  setupAutoRefresh();
  setupContextMenuClose();
  setupEditorAutoSave();
  setupSidebarToggle();
  setupSearch();
  setupDragAndDrop();

  // Restore last open file
  const lastFile = getLastOpenFile();
  if (lastFile) {
    try {
      await loadFile(lastFile);
    } catch (e) {
      console.warn('Could not restore last file:', lastFile);
    }
  }
});

// ─── Keyboard Shortcuts ─────────────────────────────────────────────
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      if (isEditing) saveFile();
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'e') {
      e.preventDefault();
      if (currentFilePath) toggleEdit();
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

// ─── Auto-refresh on tab focus ──────────────────────────────────────
function setupAutoRefresh() {
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && currentFilePath && !isEditing) {
      loadFile(currentFilePath);
    }
  });
}

// ─── Sidebar Toggle ─────────────────────────────────────────────────
function setupSidebarToggle() {
  document.getElementById('toggle-sidebar').addEventListener('click', () => {
    const sidebar = document.getElementById('sidebar');
    const isCollapsing = !sidebar.classList.contains('sidebar-collapsed');
    if (isCollapsing) {
      sidebar.classList.add('sidebar-collapsed');
    } else {
      sidebar.classList.remove('sidebar-collapsed');
    }
    setSidebarCollapsed(isCollapsing);
  });
}

// ─── Search ─────────────────────────────────────────────────────────
function setupSearch() {
  const searchInput = document.getElementById('search-input');
  const searchResults = document.getElementById('search-results');
  const fileTree = document.getElementById('file-tree');
  
  let searchTimeout;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    const query = searchInput.value.trim();
    if (query.length < 2) {
      searchResults.style.display = 'none';
      fileTree.style.display = 'block';
      return;
    }
    
    searchTimeout = setTimeout(async () => {
      try {
        const res = await fetch('/api/search?q=' + encodeURIComponent(query));
        const data = await res.json();
        
        fileTree.style.display = 'none';
        searchResults.style.display = 'block';
        searchResults.innerHTML = '';
        
        if (data.results.length === 0) {
          searchResults.innerHTML = '<div style="padding: 10px; color: var(--text-muted); text-align: center;">Sonuç bulunamadı</div>';
          return;
        }
        
        data.results.forEach(item => {
          const div = document.createElement('div');
          div.className = 'search-result-item';
          div.innerHTML = `
            <div class="result-name">${escapeHtml(item.name)}</div>
            <div class="result-path">${escapeHtml(item.path)}</div>
          `;
          div.onclick = () => {
            import('./editor.js').then(module => module.loadFile(item.path));
          };
          searchResults.appendChild(div);
        });
      } catch (err) {
        console.error(err);
      }
    }, 500);
  });
}
