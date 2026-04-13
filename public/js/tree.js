// ─── File Tree ──────────────────────────────────────────────────────
import {
  expandedFolders, addExpandedFolder, removeExpandedFolder,
  currentFilePath, setCtxTarget
} from './state.js';
import { loadFile } from './editor.js';
import { showContextMenu } from './modals.js';
import { moveFileTo } from './modals.js';

export async function refreshTree() {
  try {
    // Capture currently expanded folders from DOM before re-render
    document.querySelectorAll('.tree-children.open').forEach(el => {
      const row = el.previousElementSibling;
      if (row && row.dataset.path) {
        addExpandedFolder(row.dataset.path);
      }
    });

    const res = await fetch('/api/tree');
    const data = await res.json();
    const container = document.getElementById('file-tree');
    container.innerHTML = '';
    renderTree(data.tree, container, 0);

    // Re-expand saved folders
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
          removeExpandedFolder(item.path);
        } else {
          addExpandedFolder(item.path);
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
      } else if (['yaml', 'yml'].includes(ext)) {
        icon.innerHTML = '<i class="fas fa-file-code" style="color:#cb171e"></i>';
      } else if (['sh', 'bash', 'zsh'].includes(ext)) {
        icon.innerHTML = '<i class="fas fa-terminal" style="color:#3fb950"></i>';
      } else if (['java', 'kt'].includes(ext)) {
        icon.innerHTML = '<i class="fab fa-java" style="color:#f89820"></i>';
      } else if (['svg', 'png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) {
        icon.innerHTML = '<i class="fas fa-file-image" style="color:#bc8cff"></i>';
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

export function highlightActive(row) {
  document.querySelectorAll('.tree-item.active').forEach(el => el.classList.remove('active'));
  row.classList.add('active');
}

export function highlightFileInTree(filePath) {
  document.querySelectorAll('.tree-item').forEach(el => {
    if (el.dataset.path === filePath && el.dataset.type === 'file') {
      highlightActive(el);
    }
  });
}
