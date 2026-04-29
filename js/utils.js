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

// ── Code block actions ─────────────────────────────────────────────────────
/** Copy the content of a code block to clipboard (called from inline onclick) */
function copyCodeBlock(btn) {
  const code = btn.closest('pre')?.querySelector('code');
  if (!code) return;
  navigator.clipboard.writeText(code.textContent).then(() => {
    toast('Code copied');
    const oldText = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = oldText; }, 2000);
  });
}
