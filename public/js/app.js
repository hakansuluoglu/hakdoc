// ─── DocWebApp Entry Point ──────────────────────────────────────────
import { isEditing, restoreExpandedFolders, getLastOpenFile, currentFilePath } from './state.js';
import { refreshTree } from './tree.js';
import {
  initMarked, initMermaid, setupEditorAutoSave,
  loadFile, toggleEdit, saveFile, deleteCurrent, insertFormat
} from './editor.js';
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

  // Load file tree
  await refreshTree();

  // Setup features
  setupKeyboardShortcuts();
  setupAutoRefresh();
  setupContextMenuClose();
  setupEditorAutoSave();

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
