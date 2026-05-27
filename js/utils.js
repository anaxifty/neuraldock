/**
 * utils.js — Shared utility functions
 * No dependencies. Must be loaded first.
 */

'use strict';

// ── HTML escaping ──────────────────────────────────────────────────────────
/** Safely escape a string for HTML insertion */
function escHtml(s) {
  const d = document.createElement('div');
  d.textContent = String(s ?? '');
  return d.innerHTML;
}

// ── Toast notifications ────────────────────────────────────────────────────
/**
 * Show a brief notification toast.
 * @param {string} msg
 * @param {'success'|'error'|'info'} type
 */
function toast(msg, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  container.appendChild(el);
  // Remove after animation completes
  setTimeout(() => el.remove(), 3200);
}

// ── Time formatting ────────────────────────────────────────────────────────
/** Convert a timestamp to a human-readable relative time string */
function relativeTime(ts) {
  const seconds = (Date.now() - ts) / 1000;
  if (seconds < 60)    return 'just now';
  if (seconds < 3600)  return Math.floor(seconds / 60)    + 'm ago';
  if (seconds < 86400) return Math.floor(seconds / 3600)  + 'h ago';
  return Math.floor(seconds / 86400) + 'd ago';
}

// ── Textarea auto-resize ───────────────────────────────────────────────────
/** Expand a textarea to fit its content, capped at 160px */
function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 160) + 'px';
}

// Wire up auto-resize to all textareas on input
document.addEventListener('input', e => {
  if (e.target && e.target.tagName === 'TEXTAREA') autoResize(e.target);
});

// ── File reading helpers ───────────────────────────────────────────────────
/** Read a file as a base64 data URL */
function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Read a file as plain text */
function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

// ── Clipboard Feedback ─────────────────────────────────────────────────────
/**
 * Provide visual and accessible feedback for clipboard actions
 * @param {HTMLElement} btn The button element that was clicked
 * @param {string} successText The text to show on success
 * @param {number} delay How long to show the feedback (ms)
 */
function copyFeedback(btn, successText = 'Copied!', delay = 2000) {
  if (!btn || btn._copying) return;
  btn._copying = true;

  const originalHTML = btn.innerHTML;
  const originalAria = btn.getAttribute('aria-label');
  const svg = btn.querySelector('svg');

  // Update UI
  btn.classList.add('copy-success');
  if (svg) {
    btn.innerHTML = svg.outerHTML + ` <span>${successText}</span>`;
  } else {
    btn.textContent = successText;
  }
  btn.setAttribute('aria-label', successText);

  setTimeout(() => {
    btn.classList.remove('copy-success');
    btn.innerHTML = originalHTML;
    if (originalAria) btn.setAttribute('aria-label', originalAria);
    else btn.removeAttribute('aria-label');
    delete btn._copying;
  }, delay);
}

// ── Code block actions ─────────────────────────────────────────────────────
/** Copy the content of a code block to clipboard (called from inline onclick) */
function copyCodeBlock(btn) {
  const code = btn.closest('pre')?.querySelector('code');
  if (!code) return;
  navigator.clipboard.writeText(code.textContent).then(() => {
    copyFeedback(btn, 'Copied!');
    toast('Code copied');
  });
}
