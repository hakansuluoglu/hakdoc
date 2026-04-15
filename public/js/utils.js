// ─── Utility Functions ──────────────────────────────────────────────

export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ─── Debounce ───────────────────────────────────────────────────────
export function debounce(fn, delay) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// ─── Toast Notifications ────────────────────────────────────────────
let toastCounter = 0;

export function showToast(message, options = {}) {
  const {
    type = 'info',       // 'info' | 'success' | 'warning' | 'error'
    duration = 4000,
    actions = null       // [{ label, onClick }]
  } = options;

  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.id = `toast-${++toastCounter}`;

  const iconMap = {
    info: 'fa-info-circle',
    success: 'fa-check-circle',
    warning: 'fa-exclamation-triangle',
    error: 'fa-times-circle'
  };

  let html = `
    <div class="toast-body">
      <i class="fas ${iconMap[type]} toast-icon"></i>
      <span class="toast-message">${escapeHtml(message)}</span>
    </div>
  `;

  if (actions && actions.length > 0) {
    html += '<div class="toast-actions">';
    actions.forEach((action, i) => {
      html += `<button class="toast-btn ${i === 0 ? 'toast-btn-primary' : 'toast-btn-secondary'}" data-action="${i}">${escapeHtml(action.label)}</button>`;
    });
    html += '</div>';
  }

  toast.innerHTML = html;

  // Bind action buttons
  if (actions) {
    toast.querySelectorAll('.toast-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.action);
        if (actions[idx] && actions[idx].onClick) {
          actions[idx].onClick();
        }
        dismissToast(toast);
      });
    });
  }

  container.appendChild(toast);

  // Trigger enter animation
  requestAnimationFrame(() => {
    toast.classList.add('toast-visible');
  });

  // Auto-dismiss (only if no actions)
  if (!actions) {
    setTimeout(() => dismissToast(toast), duration);
  }

  return toast;
}

// ─── Confirm Dialog ────────────────────────────────────────────────
export function showConfirm(message, okLabel = 'Delete') {
  return new Promise((resolve) => {
    const overlay = document.getElementById('confirm-overlay');
    const msgEl   = document.getElementById('confirm-message');
    const okBtn   = document.getElementById('confirm-ok');
    const cancelBtn = document.getElementById('confirm-cancel');

    msgEl.textContent = message;
    okBtn.textContent = okLabel;
    overlay.style.display = 'flex';

    function finish(result) {
      overlay.style.display = 'none';
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      overlay.removeEventListener('click', onBackdrop);
      resolve(result);
    }
    function onOk()      { finish(true); }
    function onCancel()  { finish(false); }
    function onBackdrop(e) { if (e.target === overlay) finish(false); }

    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    overlay.addEventListener('click', onBackdrop);
  });
}

function dismissToast(toast) {
  if (!toast || !toast.parentElement) return;
  toast.classList.remove('toast-visible');
  toast.classList.add('toast-exit');
  setTimeout(() => {
    if (toast.parentElement) toast.parentElement.removeChild(toast);
  }, 300);
}
