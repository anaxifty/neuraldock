/**
 * ui.js — Tabs, sidebar, model selector, keyboard shortcuts, canvas panel, settings
 * Refactored for New UI
 */

'use strict';

const VALID_TABS = ['chat', 'code', 'image', 'voice', 'settings'];

function activateTab(tab) {
  if (!VALID_TABS.includes(tab)) tab = 'chat';
  const newPath = `/${tab}`;
  if (window.location.pathname !== newPath) {
    history.pushState({ tab }, '', newPath);
  }
  _switchTab(tab);
}

function _switchTab(tab) {
  // Update Sidebar Buttons
  document.querySelectorAll('.tab-btn').forEach(b => {
    const isActive = b.dataset.tab === tab;
    b.classList.toggle('text-accent', isActive);
    b.classList.toggle('bg-surface-elevated', isActive);
    b.classList.toggle('text-on-surface-variant/40', !isActive);
  });

  // Update Panels
  document.querySelectorAll('.tab-panel').forEach(p =>
    p.classList.toggle('active', p.id === `panel-${tab}`)
  );

  // Update Top Bar Indicator
  const indicator = document.getElementById('active-tab-indicator');
  if (indicator) indicator.textContent = tab.toUpperCase();

  const titles = { chat: 'Chat', code: 'Code IDE', image: 'Image', voice: 'Voice', settings: 'Settings' };
  document.title = `${titles[tab] || 'Chat'} — NeuralDock`;

  if (tab === 'code' && typeof ideOnTabActivated === 'function') {
    ideOnTabActivated();
  }
  if (tab === 'image' && typeof updateImageModels === 'function') {
    updateImageModels();
  }
  if (tab === 'voice' && typeof updateVoiceOptions === 'function') {
    updateVoiceOptions();
  }
  if (tab === 'settings') {
    applySettingsUI();
  }
}

function initRouter() {
  const seg = window.location.pathname.replace(/^\//, '').toLowerCase().split('/')[0];
  const tab = VALID_TABS.includes(seg) ? seg : 'chat';
  history.replaceState({ tab }, '', `/${tab}`);
  _switchTab(tab);
}

window.addEventListener('popstate', e => {
  const tab = (e.state && e.state.tab) ? e.state.tab : 'chat';
  _switchTab(tab);
});

// ── Model selector ─────────────────────────────────────────────────────────
function getModelInfo(id) {
  for (const g of MODELS) {
    for (const m of g.models) {
      if (m.id === id) return { ...m, provider: g.provider, color: g.color || '#888' };
    }
  }
  const name = id.split('/').pop().replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return { id, name, provider: 'Unknown', color: '#888', tag: '' };
}

function updateModelDisplay() {
    const info = getModelInfo(S.currentModel);
    const nameEl = document.getElementById('current-model-name');
    const dotEl = document.getElementById('model-status-dot');
    if (nameEl) nameEl.textContent = info.name.toUpperCase();
    if (dotEl) dotEl.style.backgroundColor = info.color || '#d97706';
}

function renderSidebar(searchQuery = '') {
  // Now handled in conversations.js
}

// ── Keyboard shortcuts ─────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  const tag = document.activeElement?.tagName;
  const inInput = tag === 'INPUT' || tag === 'TEXTAREA';

  if (!inInput && e.key === '?') { e.preventDefault(); return; }

  if (e.key === 'Escape') {
    if (typeof S !== 'undefined' && S.busy && typeof stopGeneration === 'function') stopGeneration();
    return;
  }

  if (!e.ctrlKey && !e.metaKey) return;
  if      (e.key === 'k') { e.preventDefault(); if (typeof newChat === 'function') newChat(); }
  else if (e.key === '1') { e.preventDefault(); activateTab('chat');  }
  else if (e.key === '2') { e.preventDefault(); activateTab('code');  }
  else if (e.key === '3') { e.preventDefault(); activateTab('image'); }
  else if (e.key === '4') { e.preventDefault(); activateTab('voice'); }
});

// ── Toast System ───────────────────────────────────────────────────────────
function toast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = `bg-surface-elevated border-l-2 border-accent p-3 shadow-xl mb-2 min-w-[200px] animate-slide-in font-mono text-[11px] text-on-surface`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateX(20px)';
    el.style.transition = 'all 0.3s';
    setTimeout(() => el.remove(), 300);
  }, 3000);
}

// ── Settings ───────────────────────────────────────────────────────────────
function applySettingsUI() {
  const sysPEl = document.getElementById('settings-system-prompt');
  if (sysPEl) sysPEl.value = S.systemPrompt || '';

  const lengthEl = document.getElementById('settings-length');
  if (lengthEl) lengthEl.value = S.length || 'balanced';

  const fontSlider = document.getElementById('settings-font-size');
  if (fontSlider) {
      fontSlider.value = parseInt(S.fontSize) || 14;
      const valEl = document.getElementById('font-size-val');
      if (valEl) valEl.textContent = `${fontSlider.value}px`;
  }
}

function applyFontSize(size) {
    document.documentElement.style.setProperty('--base-font-size', `${size}px`);
}

window.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.tab-btn').forEach(btn =>
      btn.addEventListener('click', () => activateTab(btn.dataset.tab))
    );

    document.getElementById('new-chat-btn')?.addEventListener('click', () => {
        if (typeof newChat === 'function') newChat();
    });

    document.getElementById('settings-font-size')?.addEventListener('input', (e) => {
        const size = e.target.value;
        const valEl = document.getElementById('font-size-val');
        if (valEl) valEl.textContent = `${size}px`;
        S.fontSize = size;
        saveState();
        applyFontSize(size);
    });

    document.getElementById('settings-system-prompt')?.addEventListener('change', (e) => {
        S.systemPrompt = e.target.value;
        saveState();
    });

    document.getElementById('settings-length')?.addEventListener('change', (e) => {
        S.length = e.target.value;
        saveState();
    });

    document.getElementById('model-selector-btn')?.addEventListener('click', () => {
        // Simple toggle between models for now
        const currentIndex = MODELS[0].models.findIndex(m => m.id === S.currentModel);
        const nextIndex = (currentIndex + 1) % MODELS[0].models.length;
        S.currentModel = MODELS[0].models[nextIndex].id;
        updateModelDisplay();
        saveState();
        toast('Model switched to ' + S.currentModel);
    });

    // Handle deepthink toggle
    document.getElementById('deepthink-toggle')?.addEventListener('click', function() {
        this.classList.toggle('bg-accent');
        this.classList.toggle('text-background');
        this.classList.toggle('bg-accent/10');
        this.classList.toggle('text-accent');
    });
});
