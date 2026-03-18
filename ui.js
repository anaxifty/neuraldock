/**
 * ui.js — Tabs, sidebar, model selector, keyboard shortcuts, canvas panel, settings
 * Depends on: utils.js, config.js, state.js
 */

'use strict';

// ── Tab switching ──────────────────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn =>
  btn.addEventListener('click', () => activateTab(btn.dataset.tab))
);

function activateTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === tab)
  );
  document.querySelectorAll('.tab-panel').forEach(p =>
    p.classList.toggle('active', p.id === `panel-${tab}`)
  );
  // Refresh CodeMirror layout when switching to the code tab
  if (tab === 'code' && typeof IDE !== 'undefined' && IDE.cm) {
    setTimeout(() => IDE.cm.refresh(), 50);
  }
  // Refresh image models when switching to image tab
  if (tab === 'image' && typeof updateImageModels === 'function') {
    updateImageModels();
  }
}

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
/** Look up model metadata by ID. Falls back gracefully for unknown models. */
function getModelInfo(id) {
  for (const g of MODELS) {
    for (const m of g.models) {
      if (m.id === id) return { ...m, provider: g.provider, color: g.color || '#888' };
    }
  }
  const name = id.split('/').pop().replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return { id, name, provider: 'Unknown', color: '#888', tag: '' };
}

/** Render the model dropdown list, optionally filtered by a query string */
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

/** Fetch additional models from Puter and merge into MODELS */
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
document.getElementById('deepthink-toggle').addEventListener('click', toggleDeepThink);
document.getElementById('search-toggle').addEventListener('click', toggleWebSearch);

function toggleDeepThink() {
  S.deepThink = !S.deepThink;
  document.getElementById('deepthink-toggle').classList.toggle('active', S.deepThink);
  if (S.deepThink) {
    S.webSearch = false;
    document.getElementById('search-toggle').classList.remove('active');
  }
}

function toggleWebSearch() {
  S.webSearch = !S.webSearch;
  document.getElementById('search-toggle').classList.toggle('active', S.webSearch);
  if (S.webSearch) {
    S.deepThink = false;
    document.getElementById('deepthink-toggle').classList.remove('active');
  }
}

// ── Response length ────────────────────────────────────────────────────────
document.querySelectorAll('.length-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.length-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    S.responseLength = btn.dataset.len;
    saveSettings();
  });
});

function applyLengthUI() {
  document.querySelectorAll('.length-btn').forEach(b =>
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

// ── Settings drawer ────────────────────────────────────────────────────────
document.getElementById('settings-open-btn').addEventListener('click', openSettings);
document.getElementById('settings-close-btn').addEventListener('click', closeSettings);
document.getElementById('settings-overlay').addEventListener('click', closeSettings);

function openSettings() {
  document.getElementById('settings-overlay').classList.add('open');
  document.getElementById('settings-drawer').classList.add('open');
}
function closeSettings() {
  document.getElementById('settings-overlay').classList.remove('open');
  document.getElementById('settings-drawer').classList.remove('open');
}

document.querySelectorAll('.size-option').forEach(btn =>
  btn.addEventListener('click', () => setFontSize(btn.dataset.size))
);
function setFontSize(size) {
  S.fontSize = size;
  document.querySelectorAll('.size-option').forEach(b => b.classList.toggle('active', b.dataset.size === size));
  applyFontSize(size);
  saveSettings();
}
function applyFontSize(size) {
  document.documentElement.setAttribute('data-font-size', size);
}

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
document.getElementById('speak-speed').addEventListener('input', function () {
  S.speakSpeed = this.value / 100;
  document.getElementById('speed-value').textContent = S.speakSpeed.toFixed(1) + 'x';
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

document.getElementById('export-btn').addEventListener('click', () => {
  const d = JSON.stringify(S.conversations, null, 2);
  const blob = new Blob([d], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `ai-studio-export-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  toast('Conversations exported');
});

document.getElementById('clear-btn').addEventListener('click', () => {
  if (!confirm('Delete all conversations? This cannot be undone.')) return;
  S.conversations = {};
  S.activeConvId  = null;
  S.chatMessages  = [];
  saveConvs();
  renderSidebar();
  renderChatMessages();
  toast('All history cleared');
});

function applySettingsUI() {
  document.getElementById('settings-temperature').value           = S.temperature * 100;
  document.getElementById('temperature-value').textContent        = S.temperature.toFixed(1);
  document.getElementById('settings-system-prompt').value         = S.systemPrompt || '';
  document.getElementById('settings-custom-instructions').value   = S.customInstructions || '';
  document.getElementById('speak-speed').value                    = S.speakSpeed * 100;
  document.getElementById('speed-value').textContent              = S.speakSpeed.toFixed(1) + 'x';
  document.getElementById('speak-toggle').classList.toggle('active', S.speakResponses);
  document.getElementById('memory-toggle').classList.toggle('active', S.memoryEnabled);
  document.querySelectorAll('.size-option').forEach(b =>
    b.classList.toggle('active', b.dataset.size === S.fontSize)
  );
}

// ── Keyboard shortcuts ─────────────────────────────────────────────────────
document.getElementById('shortcuts-btn').addEventListener('click', openShortcuts);
document.getElementById('shortcuts-close').addEventListener('click', closeShortcuts);
document.getElementById('shortcuts-overlay').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeShortcuts();
});

function openShortcuts()  { document.getElementById('shortcuts-overlay').style.display = 'flex'; }
function closeShortcuts() { document.getElementById('shortcuts-overlay').style.display = 'none'; }

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
  if (e.key === 'k') { e.preventDefault(); if (typeof newChat === 'function') newChat(); }
  else if (e.key === '/') { e.preventDefault(); toggleSidebar(); }
  else if (e.key === '.') { e.preventDefault(); openSettings(); }
  else if (e.key === '1') { e.preventDefault(); activateTab('chat'); }
  else if (e.key === '2') { e.preventDefault(); activateTab('code'); }
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

/** Open a code block from a chat message in the canvas panel */
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

// Lazy-load Pyodide for Python execution
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
