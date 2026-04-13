// ─── Global Application State ───────────────────────────────────────
export let currentFilePath = null;
export let isEditing = false;
export let modalCallback = null;
export let ctxTargetPath = null;
export let ctxTargetType = null;
export let moveSourcePath = null;
export let moveSelectedFolder = null;
export let moveTreeData = null;
export let expandedFolders = new Set();

// ─── State Setters ──────────────────────────────────────────────────
export function setCurrentFilePath(val) {
  currentFilePath = val;
  if (val) {
    localStorage.setItem('docwebapp:lastFile', val);
  } else {
    localStorage.removeItem('docwebapp:lastFile');
  }
}

export function setIsEditing(val) {
  isEditing = val;
}

export function setModalCallback(val) {
  modalCallback = val;
}

export function setCtxTarget(path, type) {
  ctxTargetPath = path;
  ctxTargetType = type;
}

export function setMoveSourcePath(val) {
  moveSourcePath = val;
}

export function setMoveSelectedFolder(val) {
  moveSelectedFolder = val;
}

export function setMoveTreeData(val) {
  moveTreeData = val;
}

// ─── Expanded Folders Persistence ───────────────────────────────────
export function addExpandedFolder(path) {
  expandedFolders.add(path);
  persistExpandedFolders();
}

export function removeExpandedFolder(path) {
  expandedFolders.delete(path);
  persistExpandedFolders();
}

function persistExpandedFolders() {
  try {
    localStorage.setItem('docwebapp:expandedFolders', JSON.stringify([...expandedFolders]));
  } catch (e) { /* quota exceeded — ignore */ }
}

export function restoreExpandedFolders() {
  try {
    const saved = localStorage.getItem('docwebapp:expandedFolders');
    if (saved) {
      const arr = JSON.parse(saved);
      expandedFolders = new Set(arr);
    }
  } catch (e) { /* corrupted data — ignore */ }
}

export function getLastOpenFile() {
  return localStorage.getItem('docwebapp:lastFile');
}

// ─── Draft Management ───────────────────────────────────────────────
const DRAFT_PREFIX = 'docwebapp:draft:';

export function saveDraft(filePath, content) {
  try {
    localStorage.setItem(DRAFT_PREFIX + filePath, JSON.stringify({
      content,
      timestamp: Date.now()
    }));
  } catch (e) { /* quota exceeded — ignore */ }
}

export function loadDraft(filePath) {
  try {
    const raw = localStorage.getItem(DRAFT_PREFIX + filePath);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

export function clearDraft(filePath) {
  localStorage.removeItem(DRAFT_PREFIX + filePath);
}

export function hasDraft(filePath) {
  return localStorage.getItem(DRAFT_PREFIX + filePath) !== null;
}
