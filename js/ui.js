/**
 * ui.js — Tabs, sidebar, model selector, keyboard shortcuts, canvas panel, settings
 * Depends on: utils.js, config.js, state.js
 */

'use strict';

// ── Client-side router ────────────────────────────────────────────────────
const VALID_TABS = ['chat', 'code', 'image', 'voice'];

function pathToTab(pathname) {
  const seg = pathname.replace(/^\//, '').toLowerCase().split('/')[0];
  return VALID_TABS.includes(seg) ? seg : 'chat';
}

function _switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === tab)
  );
  document.querySelectorAll('.tab-panel').forEach(p =>
    p.classList.toggle('active', p.id === `panel-${tab}`)
  );

  const titles = { chat: 'Chat', code: 'Code IDE', image: 'Image', voice: 'Voice' };
  document.title = `${titles[tab] || 'Chat'} — AI Studio | NeuralDock`;

  if (tab === 'code') {
    // FIX: Always delegate to ideOnTabActivated instead of branching on
    // IDE.cm. The old code did:
    //   if (IDE.cm) IDE.cm.refresh();
    //   else ideOnTabActivated();
    // …which meant that when CM was already initialised the active file's
    // content was never pushed into CM after an upload / file-switch that
    // happened while on another tab. ideOnTabActivated() now handles both
    // cases: flush + refresh when CM exists, create when it doesn't.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (typeof ideOnTabActivated === 'function') {
        ideOnTabActivated();
      }
    }));
  }

  if (tab === 'image' && typeof updateImageModels === 'function') {
    updateImageModels();
  }
}

function activateTab(tab) {
  if (!VALID_TABS.includes(tab)) tab = 'chat';
  const newPath = `/${tab}`;
  if (window.location.pathname !== newPath) {
    history.pushState({ tab }, '', newPath);
  }
  _switchTab(tab);
}

function initRouter() {
  const tab = pathToTab(window.location.pathname);
  history.replaceState({ tab }, '', `/${tab}`);
  _switchTab(tab);
}

window.addEventListener('popstate', e => {
  const tab = (e.state && e.state.tab) ? e.state.tab : pathToTab(window.location.pathname);
  _switchTab(tab);
});

document.querySelectorAll('.tab-btn').forEach(btn =>
  btn.addEventListener('click', () => activateTab(btn.dataset.tab))
);

// ── Sidebar toggle ─────────────────────────────────────────────────────────
document.getElementById('hamburger-btn').addEventListener('click', toggleSidebar);
document.getElementById('sidebar-collapse-btn').addEventListener('click', toggleSidebar);
document.getElementById('sidebar-overlay').addEventListener('click', toggleSidebar);

function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  const ov = document.getElementById('sidebar-overlay');
  if (window.innerWidth <= 768) {
    const open = sb.classList.contains('open');
    sb.classList.toggle('open', !open);
    ov.classList.toggle('active', !open);
  } else {
    sb.classList.toggle('collapsed');
  }
}

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

function renderModelList(filter = '') {
  const list = document.getElementById('model-list');
  if (!list) return;
  list.innerHTML = '';
  const q = filter.toLowerCase().trim();
  let anyVisible = false;

  for (const g of MODELS) {
    const color   = g.color || '#888';
    const matched = q
      ? g.models.filter(m =>
          m.name.toLowerCase().includes(q) ||
          m.id.toLowerCase().includes(q)   ||
          g.provider.toLowerCase().includes(q)
        )
      : g.models;
    if (!matched.length) continue;
    anyVisible = true;

    const lbl = document.createElement('div');
    lbl.className = 'model-group-label';
    lbl.textContent = g.provider;
    list.appendChild(lbl);

    for (const m of matched) {
      const opt = document.createElement('div');
      opt.className = 'model-option' + (m.id === S.currentModel ? ' selected' : '');
      const tagClass = m.tag === 'FREE' ? 'model-option-tag free-tag' : 'model-option-tag';
      opt.innerHTML =
        `<span class="model-dot" style="background:${color}"></span>` +
        `<span class="model-option-name">${m.name}</span>` +
        (m.tag ? `<span class="${tagClass}">${m.tag}</span>` : '');
      opt.addEventListener('click', () => setModel(m.id));
      list.appendChild(opt);
    }
  }

  if (!anyVisible) {
    const none = document.createElement('div');
    none.className = 'model-no-results';
    none.textContent = `No models match "${filter}"`;
    list.appendChild(none);
  }
}

function buildModelDropdown() {
  renderModelList('');
  const s = document.getElementById('model-search');
  if (s) s.value = '';
}

document.getElementById('model-selector-btn').addEventListener('click', () => {
  const ms = document.getElementById('model-selector');
  ms.classList.toggle('open');
  if (ms.classList.contains('open')) {
    setTimeout(() => {
      const s = document.getElementById('model-search');
      if (s) { s.value = ''; s.focus(); renderModelList(''); }
    }, 50);
  }
});

document.addEventListener('input', e => {
  if (e.target?.id === 'model-search') renderModelList(e.target.value);
});
document.addEventListener('click', e => {
  if (e.target?.id === 'model-search') e.stopPropagation();
}, true);
document.addEventListener('click', e => {
  const ms = document.getElementById('model-selector');
  if (ms && !ms.contains(e.target)) ms.classList.remove('open');
});

function setModel(id) {
  S.currentModel = id;
  if (S.activeConvId && S.conversations[S.activeConvId]) {
    S.conversations[S.activeConvId].model = id;
    saveConvs();
  }
  updateModelDisplay();
  buildModelDropdown();
  document.getElementById('model-selector').classList.remove('open');
  saveSettings();
}

function updateModelDisplay() {
  const info = getModelInfo(S.currentModel);
  document.getElementById('active-model-name').textContent = info.name;
  document.getElementById('active-model-dot').style.background = info.color;
}

function populateSettingsModel() {
  const sel = document.getElementById('settings-default-model');
  if (!sel) return;
  sel.innerHTML = '';
  for (const g of MODELS) {
    for (const m of g.models) {
      const o = document.createElement('option');
      o.value = m.id;
      o.textContent = `${g.provider}: ${m.name}`;
      if (m.id === S.currentModel) o.selected = true;
      sel.appendChild(o);
    }
  }
}

async function fetchAndMergeModels() {
  try {
    const fetched = await puter.ai.listModels();
    if (!Array.isArray(fetched) || !fetched.length) return;

    const knownIds = new Set();
    for (const g of MODELS) for (const m of g.models) knownIds.add(m.id);

    const newByProvider = {};
    for (const m of fetched) {
      if (knownIds.has(m.id)) continue;
      const raw = (m.provider || '').toLowerCase();
      let label = 'Other', color = '#888888';
      const key = Object.keys(PROVIDER_META).find(k =>
        raw === k || raw.startsWith(k + '-') || raw.startsWith(k + '/')
      );
      if (key) { label = PROVIDER_META[key].label; color = PROVIDER_META[key].color; }
      if (!newByProvider[label]) newByProvider[label] = { color, models: [] };
      const name = m.name || m.id.split('/').pop().replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      newByProvider[label].models.push({ id: m.id, name, tag: '' });
      knownIds.add(m.id);
    }

    for (const [label, data] of Object.entries(newByProvider)) {
      const existing = MODELS.find(g => g.provider === label);
      if (existing) existing.models.push(...data.models);
      else MODELS.push({ provider: label, color: data.color, models: data.models });
    }

    buildModelDropdown();
    populateSettingsModel();
  } catch (e) {
    console.warn('[ui] fetchAndMergeModels failed:', e);
  }
}

// ── Feature toggles ────────────────────────────────────────────────────────
function toggleDeepThink() {
  S.deepThink = !S.deepThink;
  document.getElementById('deepthink-toggle').classList.toggle('active', S.deepThink);
  if (S.deepThink) {
    S.webSearch = false;
    document.getElementById('search-toggle').classList.remove('active');
    document.getElementById('sp-websearch-toggle')?.classList.remove('active');
  }
}

function toggleWebSearch() {
  S.webSearch = !S.webSearch;
  document.getElementById('search-toggle').classList.toggle('active', S.webSearch);
  document.getElementById('sp-websearch-toggle')?.classList.toggle('active', S.webSearch);
  if (S.webSearch) {
    S.deepThink = false;
    document.getElementById('deepthink-toggle').classList.remove('active');
  }
}

document.getElementById('deepthink-toggle').addEventListener('click', toggleDeepThink);
document.getElementById('search-toggle').addEventListener('click', toggleWebSearch);

// ── Response length ────────────────────────────────────────────────────────
function applyLengthUI() {
  document.querySelectorAll('.length-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.len === S.responseLength)
  );
  document.querySelectorAll('.sp-resp-card').forEach(b =>
    b.classList.toggle('active', b.dataset.len === S.responseLength)
  );
}

function getLengthSysPrompt() {
  if (S.responseLength === 'concise')
    return 'Be concise. Keep responses short and to the point. Avoid padding or unnecessary elaboration.';
  if (S.responseLength === 'detailed')
    return 'Be thorough and detailed. Explain concepts fully, provide examples, and cover edge cases.';
  return '';
}

document.querySelectorAll('.sp-resp-card').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.sp-resp-card').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    S.responseLength = btn.dataset.len;
    document.querySelectorAll('.length-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.len === S.responseLength)
    );
    saveSettings();
  });
});

document.querySelectorAll('.length-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.length-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    S.responseLength = btn.dataset.len;
    document.querySelectorAll('.sp-resp-card').forEach(b =>
      b.classList.toggle('active', b.dataset.len === S.responseLength)
    );
    saveSettings();
  });
});

// ── Settings page ─────────────────────────────────────────────────────────
document.getElementById('settings-open-btn').addEventListener('click', openSettings);
document.getElementById('settings-close-btn').addEventListener('click', closeSettings);
document.getElementById('settings-overlay').addEventListener('click', closeSettings);

function openSettings(sectionId) {
  document.getElementById('settings-overlay').classList.add('open');
  document.getElementById('settings-drawer').classList.add('open');
  refreshSettingsStats();
  refreshAccountPanel();
  if (typeof buildAppearanceUI === 'function') buildAppearanceUI();
  if (sectionId) switchSettingsSection(sectionId);
}

function closeSettings() {
  document.getElementById('settings-overlay').classList.remove('open');
  document.getElementById('settings-drawer').classList.remove('open');
}

// Section navigation
document.querySelectorAll('.sp-nav-item').forEach(btn => {
  btn.addEventListener('click', () => switchSettingsSection(btn.dataset.section));
});

function switchSettingsSection(id) {
  document.querySelectorAll('.sp-nav-item').forEach(b =>
    b.classList.toggle('active', b.dataset.section === id)
  );
  document.querySelectorAll('.sp-section').forEach(s =>
    s.classList.toggle('active', s.id === `sp-${id}`)
  );
  document.querySelector('.sp-content')?.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── Font size ─────────────────────────────────────────────────────────────
document.querySelectorAll('.sp-font-btn').forEach(btn => {
  btn.addEventListener('click', () => setFontSize(btn.dataset.size));
});
document.querySelectorAll('.size-option').forEach(btn =>
  btn.addEventListener('click', () => setFontSize(btn.dataset.size))
);

function setFontSize(size) {
  S.fontSize = size;
  document.querySelectorAll('.size-option').forEach(b =>
    b.classList.toggle('active', b.dataset.size === size)
  );
  document.querySelectorAll('.sp-font-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.size === size)
  );
  applyFontSize(size);
  saveSettings();
}

function applyFontSize(size) {
  document.documentElement.setAttribute('data-font-size', size);
}

// ── Model + temperature ───────────────────────────────────────────────────
document.getElementById('settings-default-model').addEventListener('change', function () {
  S.currentModel = this.value;
  updateModelDisplay();
  buildModelDropdown();
  saveSettings();
});

document.getElementById('settings-temperature').addEventListener('input', function () {
  S.temperature = this.value / 100;
  document.getElementById('temperature-value').textContent = S.temperature.toFixed(1);
  saveSettings();
});

// ── Chat settings: toggles + textareas ───────────────────────────────────
document.getElementById('speak-toggle').addEventListener('click', () => {
  S.speakResponses = !S.speakResponses;
  document.getElementById('speak-toggle').classList.toggle('active', S.speakResponses);
  saveSettings();
});

document.getElementById('memory-toggle').addEventListener('click', () => {
  S.memoryEnabled = !S.memoryEnabled;
  document.getElementById('memory-toggle').classList.toggle('active', S.memoryEnabled);
  saveSettings();
});

document.getElementById('sp-websearch-toggle')?.addEventListener('click', () => {
  S.webSearch = !S.webSearch;
  document.getElementById('sp-websearch-toggle').classList.toggle('active', S.webSearch);
  document.getElementById('search-toggle')?.classList.toggle('active', S.webSearch);
});

document.getElementById('speak-speed').addEventListener('input', function () {
  S.speakSpeed = this.value / 100;
  document.getElementById('speed-value').textContent = S.speakSpeed.toFixed(1) + '×';
  saveSettings();
});

document.getElementById('settings-system-prompt').addEventListener('change', function () {
  S.systemPrompt = this.value;
  saveSettings();
});

document.getElementById('settings-custom-instructions').addEventListener('change', function () {
  S.customInstructions = this.value;
  saveSettings();
});

// ── Data actions ──────────────────────────────────────────────────────────
document.getElementById('export-btn').addEventListener('click', () => {
  const d    = JSON.stringify(S.conversations, null, 2);
  const blob = new Blob([d], { type: 'application/json' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = `neuraldock-export-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast('Conversations exported');
});

document.getElementById('clear-btn').addEventListener('click', async () => {
  const ok = typeof ideModal === 'function'
    ? await ideModal({ title: 'Clear History', message: 'Delete all conversations? This cannot be undone.', confirmLabel: 'Delete All', cancelLabel: 'Cancel' })
    : confirm('Delete all conversations? This cannot be undone.');
  if (!ok) return;
  S.conversations = {};
  S.activeConvId  = null;
  S.chatMessages  = [];
  saveConvs();

  const searchInput = document.getElementById('sidebar-search');
  if (searchInput) searchInput.value = '';

  if (typeof renderSidebar === 'function')      renderSidebar();
  if (typeof renderChatMessages === 'function') renderChatMessages();
  refreshSettingsStats();
  toast('All history cleared');
});

// ── Account sign-out ──────────────────────────────────────────────────────
document.getElementById('sp-signout-btn')?.addEventListener('click', async () => {
  const ok = typeof ideModal === 'function'
    ? await ideModal({ title: 'Sign Out', message: 'Sign out of NeuralDock?', confirmLabel: 'Sign Out', cancelLabel: 'Cancel' })
    : confirm('Sign out of NeuralDock?');
  if (!ok) return;
  if (typeof dbSignOut === 'function') await dbSignOut();
  try { puter.auth.signOut?.(); } catch (e) {}
  S.currentUser   = null;
  S.conversations = {};
  S.chatMessages  = [];
  S.activeConvId  = null;
  localStorage.clear();
  window.location.reload();
});

// ── Stats refresh ──────────────────────────────────────────────────────────
function refreshSettingsStats() {
  const convs    = Object.values(S.conversations);
  const msgCount = convs.reduce((n, c) => n + (c.messages?.length || 0), 0);
  const raw      = localStorage.getItem('aistudio_convs') || '{}';
  const kb       = (new Blob([raw]).size / 1024).toFixed(1);

  document.getElementById('sp-conv-count').textContent = convs.length || '0';
  document.getElementById('sp-msg-count').textContent  = msgCount    || '0';
  document.getElementById('sp-storage-size').textContent = kb + ' KB';

  const syncBadge = document.getElementById('sp-sync-badge');
  if (syncBadge) {
    if (typeof supabaseConfigured === 'function' && supabaseConfigured()) {
      syncBadge.textContent = 'Cloud';
      syncBadge.className = 'sp-badge sp-badge-green';
    } else {
      syncBadge.textContent = 'Local only';
      syncBadge.className = 'sp-badge';
    }
  }
}

// ── Account panel refresh ─────────────────────────────────────────────────
function refreshAccountPanel() {
  const user = S.currentUser;

  const avatarEl = document.getElementById('sp-acct-avatar');
  const nameEl   = document.getElementById('sp-acct-name');
  const emailEl  = document.getElementById('sp-acct-email');

  if (user) {
    const name  = user.username || user.user_metadata?.user_name || user.email?.split('@')[0] || 'User';
    const email = user.email || '';
    const av    = user.user_metadata?.avatar_url;

    if (nameEl)  nameEl.textContent = name;
    if (emailEl) emailEl.textContent = email;
    if (avatarEl) {
      if (av) {
        avatarEl.style.backgroundImage = `url(${av})`;
        avatarEl.style.backgroundSize  = 'cover';
        avatarEl.textContent = '';
      } else {
        avatarEl.textContent = name[0].toUpperCase();
        avatarEl.style.backgroundImage = '';
      }
    }
  }

  const puterBadge = document.getElementById('sp-puter-status');
  if (puterBadge) {
    try {
      if (puter.auth.isSignedIn()) {
        puterBadge.textContent = 'Connected';
        puterBadge.className   = 'sp-badge sp-badge-green';
      } else {
        puterBadge.textContent = 'Not connected';
        puterBadge.className   = 'sp-badge';
      }
    } catch (e) {
      puterBadge.textContent = 'Not connected';
      puterBadge.className   = 'sp-badge';
    }
  }

  const sbBadge = document.getElementById('sp-supabase-status');
  if (sbBadge) {
    if (typeof supabaseConfigured === 'function' && supabaseConfigured() && user) {
      sbBadge.textContent = 'Signed in';
      sbBadge.className   = 'sp-badge sp-badge-green';
    } else {
      sbBadge.textContent = 'Not connected';
      sbBadge.className   = 'sp-badge';
    }
  }
}

// ── applySettingsUI — syncs all controls to S state on open ──────────────
function applySettingsUI() {
  const tempEl = document.getElementById('settings-temperature');
  if (tempEl) tempEl.value = S.temperature * 100;
  const tempVal = document.getElementById('temperature-value');
  if (tempVal) tempVal.textContent = S.temperature.toFixed(1);

  const sysPEl = document.getElementById('settings-system-prompt');
  if (sysPEl) sysPEl.value = S.systemPrompt || '';
  const custEl = document.getElementById('settings-custom-instructions');
  if (custEl) custEl.value = S.customInstructions || '';

  const speedEl = document.getElementById('speak-speed');
  if (speedEl) speedEl.value = S.speakSpeed * 100;
  const speedVal = document.getElementById('speed-value');
  if (speedVal) speedVal.textContent = S.speakSpeed.toFixed(1) + '×';

  document.getElementById('speak-toggle')?.classList.toggle('active', S.speakResponses);
  document.getElementById('memory-toggle')?.classList.toggle('active', S.memoryEnabled);
  document.getElementById('sp-websearch-toggle')?.classList.toggle('active', S.webSearch);

  document.querySelectorAll('.sp-font-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.size === S.fontSize)
  );
  document.querySelectorAll('.size-option').forEach(b =>
    b.classList.toggle('active', b.dataset.size === S.fontSize)
  );

  applyLengthUI();
  populateSettingsModel();
}

// ── Keyboard shortcuts ─────────────────────────────────────────────────────
document.getElementById('shortcuts-btn').addEventListener('click', () => {
  openSettings('shortcuts');
});
document.getElementById('shortcuts-close')?.addEventListener('click', closeSettings);
document.getElementById('shortcuts-overlay')?.addEventListener('click', e => {
  if (e.target === e.currentTarget) closeSettings();
});

function openShortcuts()  { openSettings('shortcuts'); }
function closeShortcuts() { closeSettings(); }

document.addEventListener('keydown', e => {
  const tag = document.activeElement?.tagName;
  const inInput = tag === 'INPUT' || tag === 'TEXTAREA';

  if (!inInput && e.key === '?') { e.preventDefault(); openShortcuts(); return; }

  if (e.key === 'Escape') {
    if (typeof S !== 'undefined' && S.busy && typeof stopGeneration === 'function') stopGeneration();
    if (typeof closeCanvas === 'function') closeCanvas();
    closeShortcuts();
    const lvo = document.getElementById('live-voice-overlay');
    if (lvo) lvo.style.display = 'none';
    document.getElementById('share-modal-overlay')?.classList.remove('open');
    return;
  }

  if (!e.ctrlKey && !e.metaKey) return;
  if      (e.key === 'k') { e.preventDefault(); if (typeof newChat === 'function') newChat(); }
  else if (e.key === '/') { e.preventDefault(); toggleSidebar(); }
  else if (e.key === '.') { e.preventDefault(); openSettings(); }
  else if (e.key === '1') { e.preventDefault(); activateTab('chat');  }
  else if (e.key === '2') { e.preventDefault(); activateTab('code');  }
  else if (e.key === '3') { e.preventDefault(); activateTab('image'); }
  else if (e.key === '4') { e.preventDefault(); activateTab('voice'); }
});

// ── Canvas / Artifact panel ────────────────────────────────────────────────
document.getElementById('canvas-close-btn').addEventListener('click', closeCanvas);
document.getElementById('canvas-overlay').addEventListener('click', closeCanvas);

document.getElementById('canvas-copy-btn').addEventListener('click', () => {
  const code = document.getElementById('canvas-body')?.querySelector('code');
  navigator.clipboard.writeText(code ? code.textContent : document.getElementById('canvas-body').innerText);
  toast('Copied to clipboard');
});

document.getElementById('canvas-clear-output').addEventListener('click', () => {
  document.getElementById('canvas-output-pre').textContent = '';
  document.getElementById('canvas-run-output').style.display = 'none';
});

function openCanvas(btn) {
  const pre  = btn.closest('pre');  if (!pre)  return;
  const code = pre.querySelector('code'); if (!code) return;
  const lang    = (code.className.match(/language-(\w+)/) || [])[1] || 'code';
  const content = code.textContent;

  document.getElementById('canvas-title').textContent = `${lang} · Artifact`;
  const body = document.getElementById('canvas-body');
  body.innerHTML = '';
  const pre2  = document.createElement('pre');
  const code2 = document.createElement('code');
  code2.className = code.className;
  code2.textContent = content;
  pre2.appendChild(code2);
  body.appendChild(pre2);
  try { hljs.highlightElement(code2); } catch (e) {}

  const runBtn = document.getElementById('canvas-run-btn');
  const canRun = ['javascript', 'js', 'html', 'python', 'py'].includes(lang.toLowerCase());
  runBtn.style.display = canRun ? '' : 'none';
  if (canRun) runBtn.onclick = () => runCanvasCode(content, lang);

  document.getElementById('canvas-run-output').style.display = 'none';
  document.getElementById('canvas-panel').classList.add('open');
  document.getElementById('canvas-overlay').classList.add('open');
}

function closeCanvas() {
  document.getElementById('canvas-panel').classList.remove('open');
  document.getElementById('canvas-overlay').classList.remove('open');
}

function runCanvasCode(code, lang) {
  const outDiv = document.getElementById('canvas-run-output');
  const outPre = document.getElementById('canvas-output-pre');
  outDiv.style.display = '';
  outPre.textContent   = '';
  outPre.style.display = '';

  const log = (...args) => {
    outPre.textContent += args
      .map(a => (typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)))
      .join(' ') + '\n';
  };

  const l = lang.toLowerCase();

  if (l === 'javascript' || l === 'js') {
    try {
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      document.body.appendChild(iframe);
      iframe.contentWindow.console = { log, warn: log, error: log, info: log };
      iframe.contentWindow.eval(code);
      iframe.remove();
      if (!outPre.textContent) outPre.textContent = '(no output)';
    } catch (err) {
      outPre.textContent = '⚠ Error: ' + err.message;
    }
  } else if (l === 'html') {
    outPre.style.display = 'none';
    let iframe = outDiv.querySelector('.canvas-html-preview');
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.className = 'canvas-html-preview';
      outDiv.appendChild(iframe);
    }
    iframe.style.display = '';
    iframe.srcdoc = code;
  } else if (l === 'python' || l === 'py') {
    outPre.textContent = 'Loading Python runtime…';
    loadPyodide(code, outPre);
  }
}

let _pyodide = null, _pyodideLoading = false, _pyodideQueue = [];

async function loadPyodide(code, outPre) {
  if (_pyodide) { runPython(code, outPre); return; }
  _pyodideQueue.push({ code, outPre });
  if (_pyodideLoading) return;
  _pyodideLoading = true;
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js';
  script.onload = async () => {
    try {
      _pyodide = await window.loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/' });
      _pyodideLoading = false;
      _pyodideQueue.forEach(({ code: c, outPre: op }) => runPython(c, op));
      _pyodideQueue = [];
    } catch (e) {
      outPre.textContent = 'Failed to load Pyodide: ' + e.message;
    }
  };
  document.head.appendChild(script);
}

function runPython(code, outPre) {
  outPre.textContent = '';
  try {
    _pyodide.runPython('import sys, io; _buf=io.StringIO(); sys.stdout=_buf; sys.stderr=_buf');
    _pyodide.runPython(code);
    const out = _pyodide.runPython('_buf.getvalue()');
    outPre.textContent = out || '(no output)';
  } catch (e) {
    outPre.textContent = '⚠ Error: ' + e.message;
  }
}

// ── Share modal ────────────────────────────────────────────────────────────
document.getElementById('share-modal-close').addEventListener('click', () =>
  document.getElementById('share-modal-overlay').classList.remove('open')
);
document.getElementById('share-modal-overlay').addEventListener('click', e => {
  if (e.target === e.currentTarget) e.currentTarget.classList.remove('open');
});

function openShareModal(msg) {
  const conv     = S.activeConvId ? S.conversations[S.activeConvId] : null;
  const messages = conv ? conv.messages : S.chatMessages;

  let transcript = 'AI Studio — Chat Export\n' + '─'.repeat(40) + '\n\n';
  for (const m of messages) {
    if (m.role === 'system') continue;
    const label = m.role === 'user' ? 'You' : getModelInfo(m.model || S.currentModel).name;
    transcript += `[${label}]\n${m.content || ''}\n\n`;
  }
  transcript = transcript.trim();

  document.getElementById('share-preview').textContent = transcript;
  document.getElementById('share-modal-overlay').classList.add('open');

  document.getElementById('share-copy-btn').onclick = () => {
    navigator.clipboard.writeText(transcript);
    toast('Chat copied to clipboard');
    document.getElementById('share-modal-overlay').classList.remove('open');
  };
  document.getElementById('share-download-btn').onclick = () => {
    const blob = new Blob([transcript], { type: 'text/plain' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = `chat-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    toast('Chat downloaded');
    document.getElementById('share-modal-overlay').classList.remove('open');
  };
}
