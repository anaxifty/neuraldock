/**
 * ide.js  v3  — NeuralDock Project IDE
 *
 * FIXES in this revision
 * ──────────────────────
 * • Duplicate AI-panel button: removed the old `#ide-ai-toggle` ("AI Help")
 *   from the toolbar wire-up.  The single canonical button is now
 *   `#ide-toggle-ai` inside the panel-toggle-row (wired by ide-panels.js).
 *
 * • Tab × button no longer deletes the file — it only removes the tab from
 *   the open-tab bar.  The file remains in the project and is still
 *   accessible via the file tree.  A new `IDE.openTabs` array tracks which
 *   files are currently pinned open.  The file-tree delete button (✕) is
 *   the only path that actually removes a file (with confirmation).
 *
 * NEW DEVELOPER FEATURES
 * ──────────────────────
 * • Status bar  — live line / column / language / file-size / save status
 * • Word-wrap toggle  — button in toolbar, persisted to localStorage
 * • Prettier formatting — JS, TS, JSX, TSX, HTML, CSS, JSON via CDN
 * • Search across files — find text in every file, jump to result
 * • Live preview  — open current HTML file in a new browser tab
 * • Code folding  — fold/unfold all (CodeMirror foldCode addon)
 * • Go to line  — Ctrl+G shortcut opens a mini modal
 * • Find & Replace panel — Ctrl+H (CodeMirror search addon wired)
 *
 * Depends on: utils.js, config.js, state.js, markdown.js, ui.js,
 *             ide-panels.js, ide-terminal.js
 */

'use strict';

// ══════════════════════════════════════════════════════════
//  STATE
// ══════════════════════════════════════════════════════════
const IDE = {
  files:          {},        // { [uuid]: { id, name, content, language, saved } }
  openTabs:       [],        // uuid[] — files currently visible in the tab bar
  activeFile:     null,      // uuid of the currently open file
  cm:             null,      // CodeMirror instance
  aiMessages:     [],
  ideBusy:        false,
  abortIde:       false,
  outTab:         'preview',
  termOpen:       false,
  projectName:    'my-project',
  _historyLoaded: false,
  wordWrap:       (localStorage.getItem('nd_ide_wrap') !== 'false'),
};

// ══════════════════════════════════════════════════════════
//  THEMED MODAL
// ══════════════════════════════════════════════════════════
function ideModal({ title, message, input = null, confirmLabel = 'OK', cancelLabel = 'Cancel' }) {
  return new Promise(resolve => {
    document.getElementById('ide-modal-overlay')?.remove();
    const ov = document.createElement('div');
    ov.id = 'ide-modal-overlay';
    ov.className = 'ide-modal-overlay';
    ov.innerHTML = `
      <div class="ide-modal">
        <div class="ide-modal-title">${escHtml(title)}</div>
        <div class="ide-modal-msg">${escHtml(message)}</div>
        ${input ? `<input id="ide-modal-input" class="ide-modal-input" type="text"
          value="${escHtml(input.default || '')}"
          placeholder="${escHtml(input.placeholder || '')}" autocomplete="off">` : ''}
        <div class="ide-modal-btns">
          <button class="ide-modal-btn cancel"  id="ide-modal-cancel">${escHtml(cancelLabel)}</button>
          <button class="ide-modal-btn confirm" id="ide-modal-confirm">${escHtml(confirmLabel)}</button>
        </div>
      </div>`;
    document.body.appendChild(ov);
    const inp = document.getElementById('ide-modal-input');
    const ok  = document.getElementById('ide-modal-confirm');
    const no  = document.getElementById('ide-modal-cancel');
    if (inp) {
      inp.focus(); inp.select();
      inp.addEventListener('keydown', e => {
        if (e.key === 'Enter')  ok.click();
        if (e.key === 'Escape') no.click();
      });
    } else { ok.focus(); }
    const done = v => { ov.remove(); resolve(v); };
    ok.addEventListener('click', () => done(input ? (inp?.value?.trim() || null) : true));
    no.addEventListener('click', () => done(null));
    ov.addEventListener('click', e => { if (e.target === ov) done(null); });
  });
}

// ══════════════════════════════════════════════════════════
//  PUTER FS
// ══════════════════════════════════════════════════════════
const PUTER_DIR = 'NeuralDock-IDE';

function puterReady() {
  try { return typeof puter !== 'undefined' && puter.auth.isSignedIn(); }
  catch(e) { return false; }
}

async function pfsSave(fileName, content) {
  if (!puterReady()) return;
  try {
    await puter.fs.write(`${PUTER_DIR}/${IDE.projectName}/${fileName}`, content,
      { createMissingParents: true, overwrite: true });
  } catch(e) { console.warn('[pfs] save:', e.message); }
}

async function pfsDelete(fileName) {
  if (!puterReady()) return;
  try { await puter.fs.delete(`${PUTER_DIR}/${IDE.projectName}/${fileName}`); }
  catch(e) { console.warn('[pfs] delete:', e.message); }
}

async function pfsRename(oldName, newName) {
  if (!puterReady()) return;
  try { await puter.fs.rename(`${PUTER_DIR}/${IDE.projectName}/${oldName}`, newName); }
  catch(e) { console.warn('[pfs] rename:', e.message); }
}

async function pfsLoadProject(projectName) {
  if (!puterReady()) return null;
  try {
    const items = await puter.fs.readdir(`${PUTER_DIR}/${projectName}`);
    const files = {};
    for (const item of items) {
      if (item.is_dir) continue;
      try {
        const blob = await puter.fs.read(`${PUTER_DIR}/${projectName}/${item.name}`);
        const text = await blob.text();
        const id = crypto.randomUUID();
        files[id] = { id, name: item.name, content: text, language: getLang(item.name), saved: true };
      } catch(e) { console.warn('[pfs] read:', item.name, e.message); }
    }
    return Object.keys(files).length ? files : null;
  } catch(e) { return null; }
}

async function pfsListProjects() {
  if (!puterReady()) return [];
  try {
    await puter.fs.mkdir(PUTER_DIR, { parents: true }).catch(() => {});
    const items = await puter.fs.readdir(PUTER_DIR);
    return items.filter(i => i.is_dir).map(i => i.name);
  } catch(e) { return []; }
}

// ══════════════════════════════════════════════════════════
//  PUTER KV — AI HISTORY
// ══════════════════════════════════════════════════════════
async function pkSaveHistory() {
  if (!puterReady() || !IDE.aiMessages.length) return;
  try { await puter.kv.set(`ide-history-${IDE.projectName}`, JSON.stringify(IDE.aiMessages.slice(-80))); }
  catch(e) { console.warn('[pkv] save:', e.message); }
}

async function pkLoadHistory() {
  if (!puterReady()) return false;
  try {
    const raw = await puter.kv.get(`ide-history-${IDE.projectName}`);
    if (!raw) return false;
    IDE.aiMessages = JSON.parse(raw);
    return true;
  } catch(e) { return false; }
}

async function pkClearHistory() {
  IDE.aiMessages = [];
  if (!puterReady()) return;
  try { await puter.kv.del(`ide-history-${IDE.projectName}`); } catch(e) {}
}

// ══════════════════════════════════════════════════════════
//  CODEMIRROR
// ══════════════════════════════════════════════════════════
function initCM(content = '', lang = 'null') {
  const container = document.getElementById('ide-monaco');
  if (IDE.cm) {
    IDE.cm.setValue(content);
    IDE.cm.setOption('mode', lang || 'null');
    IDE.cm.setOption('lineWrapping', IDE.wordWrap);
    requestAnimationFrame(() => requestAnimationFrame(() => { IDE.cm.refresh(); IDE.cm.focus(); }));
    return;
  }
  container.style.display = '';
  IDE.cm = CodeMirror(container, {
    value:             content,
    mode:              lang || 'null',
    theme:             'aistudio',
    lineNumbers:       true,
    autoCloseBrackets: true,
    matchBrackets:     true,
    lineWrapping:      IDE.wordWrap,
    indentUnit:        2,
    tabSize:           2,
    indentWithTabs:    false,
    foldGutter:        true,
    gutters:           ['CodeMirror-linenumbers', 'CodeMirror-foldgutter'],
    extraKeys: {
      'Ctrl-S':    () => ideSaveFile(),
      'Cmd-S':     () => ideSaveFile(),
      'Ctrl-/':    'toggleComment',
      'Cmd-/':     'toggleComment',
      'Tab':        cm => cm.execCommand('insertSoftTab'),
      'Ctrl-G':    () => ideGoToLine(),
      'Cmd-G':     () => ideGoToLine(),
      'Shift-Tab': cm => cm.execCommand('indentLess'),
    },
  });
  requestAnimationFrame(() => requestAnimationFrame(() => { IDE.cm.refresh(); IDE.cm.focus(); }));
  IDE.cm.on('change', () => {
    if (IDE.activeFile && IDE.files[IDE.activeFile]) {
      IDE.files[IDE.activeFile].saved = false;
      renderFileTabs(); renderFileTree();
      scheduleAutoSave();
    }
  });
  IDE.cm.on('cursorActivity', updateStatusBar);
  updateWrapBtn();
}

// ══════════════════════════════════════════════════════════
//  AUTO-SAVE
// ══════════════════════════════════════════════════════════
let _autoSaveTimer = null;
function scheduleAutoSave() {
  clearTimeout(_autoSaveTimer);
  _autoSaveTimer = setTimeout(() => {
    if (!IDE.activeFile || !IDE.files[IDE.activeFile] || !IDE.cm) return;
    const f  = IDE.files[IDE.activeFile];
    const cv = IDE.cm.getValue();
    if (cv !== f.content) { f.content = cv; pfsSave(f.name, cv); }
  }, 2000);
}

// ══════════════════════════════════════════════════════════
//  STATUS BAR
// ══════════════════════════════════════════════════════════
function updateStatusBar() {
  const bar = document.getElementById('ide-statusbar');
  if (!bar) return;
  if (!IDE.activeFile || !IDE.files[IDE.activeFile]) {
    bar.innerHTML = '<span class="ide-sb-item">No file open</span>';
    return;
  }
  const f = IDE.files[IDE.activeFile];
  let line = 1, col = 1;
  if (IDE.cm) {
    const cursor = IDE.cm.getCursor();
    line = cursor.line + 1;
    col  = cursor.ch + 1;
  }
  const content  = IDE.cm ? IDE.cm.getValue() : (f.content || '');
  const bytes    = new TextEncoder().encode(content).length;
  const sizeStr  = bytes < 1024 ? `${bytes} B` : `${(bytes/1024).toFixed(1)} KB`;
  const lineCount = content.split('\n').length;
  const langLabel = (f.language || 'text').replace('htmlmixed','HTML').toUpperCase();
  const savedDot  = f.saved
    ? `<span class="ide-sb-dot ide-sb-saved" title="Saved">●</span>`
    : `<span class="ide-sb-dot ide-sb-unsaved" title="Unsaved changes">●</span>`;

  bar.innerHTML =
    `<span class="ide-sb-item ide-sb-file">${savedDot} ${escHtml(f.name)}</span>` +
    `<span class="ide-sb-sep">|</span>` +
    `<span class="ide-sb-item" title="Cursor position">Ln ${line}, Col ${col}</span>` +
    `<span class="ide-sb-sep">|</span>` +
    `<span class="ide-sb-item">${lineCount} lines</span>` +
    `<span class="ide-sb-sep">|</span>` +
    `<span class="ide-sb-item">${sizeStr}</span>` +
    `<span class="ide-sb-sep">|</span>` +
    `<span class="ide-sb-item ide-sb-lang" id="ide-sb-lang-btn" title="Language">${langLabel}</span>` +
    `<span class="ide-sb-sep">|</span>` +
    `<span class="ide-sb-item ide-sb-wrap-indicator" title="Word wrap: ${IDE.wordWrap ? 'On' : 'Off'}">${IDE.wordWrap ? '↵ Wrap' : '→ No wrap'}</span>`;

  // Language click = manual mode select
  document.getElementById('ide-sb-lang-btn')?.addEventListener('click', e => {
    e.stopPropagation();
    ideChangeLang();
  });
}

function ideChangeLang() {
  const langs = [
    ['javascript','JavaScript / JSX'],['python','Python'],['htmlmixed','HTML'],
    ['css','CSS / SCSS'],['null','Plain Text'],['clike','C / C++ / Java'],
    ['markdown','Markdown'],['shell','Shell / Bash'],
  ];
  if (!IDE.cm || !IDE.activeFile) return;
  const ov = document.createElement('div');
  ov.className = 'ide-lang-picker-overlay';
  ov.innerHTML = `<div class="ide-lang-picker">
    <div class="ide-lang-picker-title">Select Language</div>
    ${langs.map(([v,l]) => `<button class="ide-lang-opt" data-v="${v}">${escHtml(l)}</button>`).join('')}
    <button class="ide-lang-opt ide-lang-cancel" id="ide-lang-cancel">Cancel</button>
  </div>`;
  document.body.appendChild(ov);
  ov.querySelectorAll('.ide-lang-opt:not(#ide-lang-cancel)').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.v;
      IDE.cm.setOption('mode', mode);
      if (IDE.activeFile && IDE.files[IDE.activeFile]) IDE.files[IDE.activeFile].language = mode;
      ov.remove(); updateStatusBar();
    });
  });
  document.getElementById('ide-lang-cancel')?.addEventListener('click', () => ov.remove());
  ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
}

// ══════════════════════════════════════════════════════════
//  WORD WRAP TOGGLE
// ══════════════════════════════════════════════════════════
function toggleWordWrap() {
  IDE.wordWrap = !IDE.wordWrap;
  localStorage.setItem('nd_ide_wrap', String(IDE.wordWrap));
  if (IDE.cm) IDE.cm.setOption('lineWrapping', IDE.wordWrap);
  updateWrapBtn();
  updateStatusBar();
}

function updateWrapBtn() {
  const btn = document.getElementById('ide-wrap-btn');
  if (!btn) return;
  btn.title = IDE.wordWrap ? 'Word Wrap: ON (click to toggle)' : 'Word Wrap: OFF (click to toggle)';
  btn.classList.toggle('ide-panel-btn-active', IDE.wordWrap);
}

// ══════════════════════════════════════════════════════════
//  PRETTIER FORMATTING
// ══════════════════════════════════════════════════════════
let _prettierLoaded = false;

async function ideFormatCode() {
  if (!IDE.activeFile || !IDE.cm) { toast('No file open', 'error'); return; }
  const f   = IDE.files[IDE.activeFile];
  const ext = f.name.split('.').pop().toLowerCase();
  const supported = { js:1, jsx:1, ts:1, tsx:1, html:1, htm:1, css:1, scss:1, json:1, md:1 };
  if (!supported[ext]) { toast(`Formatting not supported for .${ext}`, 'error'); return; }

  const btn = document.getElementById('ide-format-btn');
  if (btn) { btn.textContent = '…'; btn.disabled = true; }

  try {
    if (!_prettierLoaded) {
      await _loadScript('https://unpkg.com/prettier@3.3.3/standalone.js');
      await _loadScript('https://unpkg.com/prettier@3.3.3/plugins/babel.js');
      await _loadScript('https://unpkg.com/prettier@3.3.3/plugins/html.js');
      await _loadScript('https://unpkg.com/prettier@3.3.3/plugins/postcss.js');
      await _loadScript('https://unpkg.com/prettier@3.3.3/plugins/markdown.js');
      await _loadScript('https://unpkg.com/prettier@3.3.3/plugins/typescript.js');
      _prettierLoaded = true;
    }
    const code = IDE.cm.getValue();
    const parserMap = {
      js: 'babel', jsx: 'babel', ts: 'typescript', tsx: 'typescript',
      html: 'html', htm: 'html', css: 'css', scss: 'css',
      json: 'json', md: 'markdown',
    };
    const plugins = window.prettierPlugins || [];
    const allPlugins = [
      window.prettierPlugins?.babel,
      window.prettierPlugins?.html,
      window.prettierPlugins?.postcss,
      window.prettierPlugins?.markdown,
      window.prettierPlugins?.typescript,
    ].filter(Boolean);

    const formatted = await window.prettier.format(code, {
      parser:  parserMap[ext] || 'babel',
      plugins: allPlugins,
      printWidth:    100,
      tabWidth:      2,
      useTabs:       false,
      semi:          true,
      singleQuote:   true,
      trailingComma: 'es5',
    });

    // Preserve cursor position
    const cursor = IDE.cm.getCursor();
    IDE.cm.setValue(formatted);
    IDE.cm.setCursor(cursor);
    toast('✓ Formatted');
  } catch(e) {
    toast('Format failed: ' + (e.message || 'unknown error'), 'error');
    console.warn('[prettier]', e);
  }

  if (btn) { btn.textContent = '⌥ Format'; btn.disabled = false; }
}

function _loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}

// ══════════════════════════════════════════════════════════
//  GO TO LINE
// ══════════════════════════════════════════════════════════
function ideGoToLine() {
  if (!IDE.cm) return;
  const total = IDE.cm.lineCount();
  ideModal({
    title: 'Go to Line',
    message: `Enter a line number (1–${total}):`,
    input: { default: String(IDE.cm.getCursor().line + 1), placeholder: '1' },
    confirmLabel: 'Go',
  }).then(val => {
    if (!val) return;
    const n = parseInt(val) - 1;
    if (isNaN(n)) return;
    const line = Math.max(0, Math.min(total - 1, n));
    IDE.cm.setCursor({ line, ch: 0 });
    IDE.cm.scrollIntoView({ line, ch: 0 }, 100);
    IDE.cm.focus();
  });
}

// ══════════════════════════════════════════════════════════
//  SEARCH ACROSS FILES
// ══════════════════════════════════════════════════════════
function ideSearchFiles() {
  const existing = document.getElementById('ide-search-panel');
  if (existing) { existing.remove(); return; }

  const panel = document.createElement('div');
  panel.id = 'ide-search-panel';
  panel.className = 'ide-search-panel';
  panel.innerHTML = `
    <div class="ide-search-header">
      <span class="ide-search-title">🔍 Search in Files</span>
      <button class="ide-hdr-btn" id="ide-search-close">✕</button>
    </div>
    <div class="ide-search-input-row">
      <input id="ide-search-query" class="ide-search-input" type="text"
        placeholder="Search all project files…" autocomplete="off" spellcheck="false">
      <label class="ide-search-opt-label" title="Case sensitive">
        <input type="checkbox" id="ide-search-case"> Aa
      </label>
      <label class="ide-search-opt-label" title="Whole word">
        <input type="checkbox" id="ide-search-word"> W
      </label>
    </div>
    <div id="ide-search-results" class="ide-search-results"></div>`;

  // Insert before the editor body
  const editorBody = document.getElementById('ide-editor-body');
  editorBody.parentElement.insertBefore(panel, editorBody);

  document.getElementById('ide-search-close').addEventListener('click', () => panel.remove());

  const qEl   = document.getElementById('ide-search-query');
  const resEl = document.getElementById('ide-search-results');

  function doSearch() {
    const q          = qEl.value;
    const caseSens   = document.getElementById('ide-search-case').checked;
    const wholeWord  = document.getElementById('ide-search-word').checked;
    resEl.innerHTML  = '';
    if (q.length < 2) { resEl.innerHTML = '<div class="ide-search-hint">Type at least 2 characters…</div>'; return; }

    let totalMatches = 0;
    const flags      = caseSens ? 'g' : 'gi';
    let   pattern    = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (wholeWord) pattern = `\\b${pattern}\\b`;
    const re = new RegExp(pattern, flags);

    for (const [id, f] of Object.entries(IDE.files)) {
      const content = (IDE.cm && IDE.activeFile === id) ? IDE.cm.getValue() : f.content;
      const lines   = content.split('\n');
      const matches = [];
      lines.forEach((line, i) => {
        re.lastIndex = 0;
        let m;
        while ((m = re.exec(line)) !== null) {
          matches.push({ line: i, col: m.index, text: line.trim().slice(0, 100) });
        }
      });
      if (!matches.length) continue;
      totalMatches += matches.length;

      const group = document.createElement('div');
      group.className = 'ide-search-group';
      group.innerHTML = `<div class="ide-search-file-label">
        ${getFileIcon(f.name)} ${escHtml(f.name)}
        <span class="ide-search-count">${matches.length}</span>
      </div>`;

      matches.slice(0, 20).forEach(({ line, col, text }) => {
        const row = document.createElement('div');
        row.className = 'ide-search-row';
        const hiText  = escHtml(text).replace(
          new RegExp(escHtml(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), caseSens ? 'g' : 'gi'),
          m => `<mark class="ide-search-hl">${m}</mark>`
        );
        row.innerHTML = `<span class="ide-search-lineno">${line + 1}</span><span class="ide-search-text">${hiText}</span>`;
        row.addEventListener('click', () => {
          _openFile(id);
          setTimeout(() => {
            if (IDE.cm) {
              IDE.cm.setCursor({ line, ch: col });
              IDE.cm.scrollIntoView({ line, ch: col }, 80);
              IDE.cm.focus();
            }
          }, 80);
        });
        group.appendChild(row);
      });
      if (matches.length > 20) {
        const more = document.createElement('div');
        more.className = 'ide-search-more';
        more.textContent = `+ ${matches.length - 20} more matches`;
        group.appendChild(more);
      }
      resEl.appendChild(group);
    }

    if (!totalMatches) resEl.innerHTML = `<div class="ide-search-hint">No results for "${escHtml(q)}"</div>`;
  }

  qEl.addEventListener('input', doSearch);
  document.getElementById('ide-search-case').addEventListener('change', doSearch);
  document.getElementById('ide-search-word').addEventListener('change', doSearch);
  qEl.focus();
}

// ══════════════════════════════════════════════════════════
//  LIVE PREVIEW (open HTML in new tab)
// ══════════════════════════════════════════════════════════
function ideLivePreview() {
  if (!IDE.activeFile) { toast('No file open', 'error'); return; }
  const f   = IDE.files[IDE.activeFile];
  const ext = f.name.split('.').pop().toLowerCase();
  if (!['html','htm'].includes(ext)) { toast('Live preview is for HTML files only', 'error'); return; }
  const content = IDE.cm ? IDE.cm.getValue() : f.content;
  const blob    = new Blob([content], { type: 'text/html' });
  const url     = URL.createObjectURL(blob);
  const win     = window.open(url, '_blank');
  // Revoke after the tab has loaded
  if (win) setTimeout(() => URL.revokeObjectURL(url), 8000);
  toast('Opened in new tab ↗');
}

// ══════════════════════════════════════════════════════════
//  FOLD / UNFOLD ALL
// ══════════════════════════════════════════════════════════
function ideFoldAll() {
  if (!IDE.cm) return;
  const count = IDE.cm.lineCount();
  for (let i = 0; i < count; i++) {
    try { IDE.cm.foldCode(CodeMirror.Pos(i, 0)); } catch(_) {}
  }
}

function ideUnfoldAll() {
  if (!IDE.cm) return;
  const count = IDE.cm.lineCount();
  for (let i = 0; i < count; i++) {
    try { IDE.cm.foldCode(CodeMirror.Pos(i, 0), null, 'unfold'); } catch(_) {}
  }
}

// ══════════════════════════════════════════════════════════
//  FILE MANAGEMENT
//
//  KEY CHANGE: tab × now calls _closeTab (hides tab, keeps file)
//              file-tree ✕ calls ideDeleteFile (really deletes)
// ══════════════════════════════════════════════════════════
async function ideNewFile(suggestedName) {
  const name = suggestedName || await ideModal({
    title: 'New File', message: 'Enter a filename:',
    input: { default: 'index.html', placeholder: 'e.g. index.html, app.py' },
    confirmLabel: 'Create',
  });
  if (!name?.trim()) return;
  const id = crypto.randomUUID();
  IDE.files[id] = { id, name: name.trim(), content: '', language: getLang(name), saved: true };
  if (!IDE.openTabs.includes(id)) IDE.openTabs.push(id);
  await pfsSave(name.trim(), '');
  renderFileTree(); _openFile(id);
  toast('Created ' + name.trim());
}

function ideUploadFile() { document.getElementById('ide-file-input').click(); }

document.getElementById('ide-file-input').addEventListener('change', async function(e) {
  const files = Array.from(e.target.files);
  e.target.value = '';
  if (!files.length) return;
  const newIds = [];
  for (const f of files) {
    try {
      const content = await readFileAsText(f);
      const id = crypto.randomUUID();
      IDE.files[id] = { id, name: f.name, content: content || '', language: getLang(f.name), saved: true };
      await pfsSave(f.name, content || '');
      newIds.push(id);
    } catch(err) { toast(`Failed to read ${f.name}`, 'error'); }
  }
  if (!newIds.length) return;
  newIds.forEach(id => { if (!IDE.openTabs.includes(id)) IDE.openTabs.push(id); });
  renderFileTree();
  _openFile(newIds[newIds.length - 1]);
  toast(`Uploaded ${newIds.length} file(s)`);
});

/** Permanently delete a file (with confirmation). Called from file-tree ✕ button only. */
async function ideDeleteFile(id, e) {
  if (e) { e.stopPropagation(); e.preventDefault(); }
  const f = IDE.files[id];
  if (!f) return;
  const ok = await ideModal({
    title: 'Delete File',
    message: `Permanently delete "${f.name}"?\nThis cannot be undone.`,
    confirmLabel: 'Delete',
    cancelLabel:  'Cancel',
  });
  if (!ok) return;
  await pfsDelete(f.name);
  IDE.openTabs = IDE.openTabs.filter(t => t !== id);
  delete IDE.files[id];
  if (IDE.activeFile === id) {
    const rem = IDE.openTabs;
    rem.length ? _openFile(rem[rem.length - 1]) : showWelcome();
  } else { renderFileTabs(); renderFileTree(); }
  toast('🗑 Deleted ' + f.name);
}

async function ideRenameFile(id) {
  const f = IDE.files[id];
  if (!f) return;
  const newName = await ideModal({
    title: 'Rename File', message: 'Enter new filename:',
    input: { default: f.name, placeholder: f.name }, confirmLabel: 'Rename',
  });
  if (!newName?.trim() || newName.trim() === f.name) return;
  await pfsRename(f.name, newName.trim());
  f.name     = newName.trim();
  f.language = getLang(newName.trim());
  if (IDE.cm && IDE.activeFile === id) IDE.cm.setOption('mode', f.language);
  renderFileTree(); renderFileTabs();
  toast(`Renamed → ${newName.trim()}`);
}

function ideSaveFile() {
  if (!IDE.activeFile) return;
  const f = IDE.files[IDE.activeFile];
  if (!f) return;
  if (IDE.cm) f.content = IDE.cm.getValue();
  f.saved = true;
  pfsSave(f.name, f.content);
  renderFileTabs(); renderFileTree();
  updateStatusBar();
  toast('Saved ' + f.name);
}

function ideDownloadFile() {
  if (!IDE.activeFile) { toast('No file open', 'error'); return; }
  ideSaveFile();
  const f = IDE.files[IDE.activeFile];
  const a = document.createElement('a');
  a.href     = URL.createObjectURL(new Blob([f.content], { type: 'text/plain' }));
  a.download = f.name;
  a.click();
  URL.revokeObjectURL(a.href);
  toast('Downloaded ' + f.name);
}

async function ideDownloadZip() {
  if (!Object.keys(IDE.files).length) { toast('No files', 'error'); return; }
  ideSaveFile();
  if (!window.JSZip) { toast('JSZip not loaded', 'error'); return; }
  const zip     = new JSZip();
  const project = document.getElementById('ide-project-name')?.textContent?.trim() || 'project';
  for (const f of Object.values(IDE.files)) zip.file(f.name, f.content || '');
  const blob = await zip.generateAsync({ type: 'blob' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = project + '.zip';
  a.click();
  URL.revokeObjectURL(a.href);
  toast(`Downloaded ${project}.zip`);
}

/** Open a file in the editor. Opens a tab for it too. */
function _openFile(id) {
  if (IDE.cm && IDE.activeFile && IDE.files[IDE.activeFile]) {
    IDE.files[IDE.activeFile].content = IDE.cm.getValue();
  }
  IDE.activeFile = id;
  const f = IDE.files[id];
  if (!f) return;

  // Ensure it's in openTabs
  if (!IDE.openTabs.includes(id)) IDE.openTabs.push(id);

  renderFileTree(); renderFileTabs();
  const panel   = document.getElementById('panel-code');
  const visible = panel && panel.classList.contains('active');
  document.getElementById('ide-welcome').style.display = 'none';
  document.getElementById('ide-monaco').style.display  = '';
  if (visible) initCM(f.content, f.language);
  updateStatusBar();
}
function openFile(id) { _openFile(id); }

function showWelcome() {
  if (IDE.cm && IDE.activeFile && IDE.files[IDE.activeFile]) {
    IDE.files[IDE.activeFile].content = IDE.cm.getValue();
  }
  document.getElementById('ide-monaco').style.display  = 'none';
  document.getElementById('ide-welcome').style.display = '';
  IDE.activeFile = null;
  renderFileTabs(); renderFileTree();
  updateStatusBar();
}

function renderFileTree() {
  const list  = document.getElementById('ide-file-list');
  const empty = document.getElementById('ide-empty-tree');
  const ids   = Object.keys(IDE.files);
  Array.from(list.children).forEach(c => { if (c.id !== 'ide-empty-tree') c.remove(); });
  if (!ids.length) { empty.style.display = ''; return; }
  empty.style.display = 'none';
  ids.forEach(id => {
    const f  = IDE.files[id];
    const el = document.createElement('div');
    el.className      = 'ide-file-item' + (id === IDE.activeFile ? ' active' : '');
    el.dataset.fileId = id;
    el.innerHTML =
      `<span class="ide-file-icon">${getFileIcon(f.name)}</span>` +
      `<span class="ide-file-name">${escHtml(f.name)}</span>` +
      (f.saved ? '' : `<span class="ide-file-modified" title="Unsaved">●</span>`) +
      `<div class="ide-file-actions">` +
        `<button class="ide-file-btn ide-file-rename" data-id="${id}" title="Rename">✎</button>` +
        `<button class="ide-file-btn ide-file-del" data-id="${id}" title="Delete file permanently">✕</button>` +
      `</div>`;
    el.addEventListener('click', e => {
      const del    = e.target.closest('.ide-file-del');
      const rename = e.target.closest('.ide-file-rename');
      if (del)    { ideDeleteFile(del.dataset.id, e); return; }
      if (rename) { e.stopPropagation(); ideRenameFile(rename.dataset.id); return; }
      _openFile(id);
    });
    list.appendChild(el);
  });
}

function renderFileTabs() {
  const list = document.getElementById('ide-tabs-list');
  list.innerHTML = '';
  IDE.openTabs
    .filter(id => IDE.files[id])   // guard against stale ids
    .forEach(id => {
      const f = IDE.files[id];
      const tab = document.createElement('button');
      tab.className    = 'ide-tab' + (id === IDE.activeFile ? ' active' : '');
      tab.dataset.fileId = id;
      tab.title        = f.name;
      tab.innerHTML    =
        `<span class="ide-tab-icon">${getFileIcon(f.name)}</span>` +
        `<span class="ide-tab-name">${escHtml(f.name)}</span>` +
        (f.saved ? '' : `<span class="ide-tab-dot" title="Unsaved">●</span>`) +
        `<span class="ide-tab-close" data-id="${id}" title="Close tab">×</span>`;
      tab.addEventListener('click', e => {
        const close = e.target.closest('.ide-tab-close');
        if (close) {
          e.stopPropagation();
          _closeTab(close.dataset.id);    // close tab only — file stays in project
        } else {
          _openFile(id);
        }
      });
      list.appendChild(tab);
    });
}

/**
 * _closeTab — removes the tab from the tab bar.
 * The file is NOT deleted. It remains in IDE.files and the file tree.
 * FIX: Previously this called `delete IDE.files[id]` which destroyed the file.
 */
function _closeTab(id) {
  if (!IDE.files[id]) return;

  // Auto-save before closing
  if (IDE.activeFile === id && IDE.cm) {
    IDE.files[id].content = IDE.cm.getValue();
    IDE.files[id].saved   = true;
    pfsSave(IDE.files[id].name, IDE.files[id].content);
  }

  // Remove from open tabs only
  IDE.openTabs = IDE.openTabs.filter(t => t !== id);

  if (IDE.activeFile === id) {
    if (IDE.openTabs.length) {
      _openFile(IDE.openTabs[IDE.openTabs.length - 1]);
    } else {
      showWelcome();
    }
  } else {
    renderFileTabs();
  }
}

// ══════════════════════════════════════════════════════════
//  PROJECT SWITCHER
// ══════════════════════════════════════════════════════════
async function ideOpenProjectSwitcher() {
  const projects = await pfsListProjects();
  const opts     = [...projects.filter(p => p !== IDE.projectName), '＋ New project…'];
  const chosen   = await _showListPicker('Switch Project', opts);
  if (!chosen) return;
  if (chosen === '＋ New project…') {
    const name = await ideModal({
      title: 'New Project', message: 'Project name:',
      input: { default: 'my-app', placeholder: 'my-app' }, confirmLabel: 'Create',
    });
    if (name?.trim()) await _loadProject(name.trim());
  } else {
    await _loadProject(chosen);
  }
}

function _showListPicker(title, options) {
  return new Promise(resolve => {
    document.getElementById('ide-modal-overlay')?.remove();
    const ov = document.createElement('div');
    ov.id = 'ide-modal-overlay'; ov.className = 'ide-modal-overlay';
    ov.innerHTML = `
      <div class="ide-modal">
        <div class="ide-modal-title">${escHtml(title)}</div>
        <div class="ide-proj-list">${options.map((p, i) =>
          `<button class="ide-proj-item" data-i="${i}">${escHtml(p)}</button>`).join('')}</div>
        <div class="ide-modal-btns">
          <button class="ide-modal-btn cancel" id="ide-modal-cancel">Cancel</button>
        </div>
      </div>`;
    document.body.appendChild(ov);
    ov.querySelectorAll('.ide-proj-item').forEach(btn =>
      btn.addEventListener('click', () => { ov.remove(); resolve(options[+btn.dataset.i]); }));
    document.getElementById('ide-modal-cancel').addEventListener('click', () => { ov.remove(); resolve(null); });
    ov.addEventListener('click', e => { if (e.target === ov) { ov.remove(); resolve(null); } });
  });
}

async function _loadProject(name) {
  if (IDE.cm && IDE.activeFile && IDE.files[IDE.activeFile]) {
    IDE.files[IDE.activeFile].content = IDE.cm.getValue();
  }
  IDE.projectName = name;
  document.getElementById('ide-project-name').textContent = name;
  const loaded = await pfsLoadProject(name);
  IDE.files    = loaded || {};
  IDE.openTabs = Object.keys(IDE.files).slice(0, 5); // open first 5 files as tabs
  IDE.activeFile = null;
  IDE._historyLoaded = false;
  IDE.aiMessages = [];
  if (IDE.cm) IDE.cm.setValue('');
  renderFileTree(); renderFileTabs();
  const ids = IDE.openTabs;
  if (ids.length) _openFile(ids[0]); else showWelcome();
  const histLoaded = await pkLoadHistory();
  _refreshAiPanel(histLoaded);
  toast(`Project: ${name}`);
}

// ══════════════════════════════════════════════════════════
//  TEMPLATES
// ══════════════════════════════════════════════════════════
async function ideQuickStart(tpl) {
  const files = TEMPLATES[tpl];
  if (!files) return;
  if (Object.keys(IDE.files).length > 0) {
    const ok = await ideModal({
      title: 'Load Template', message: `Add ${tpl} template to current project?`,
      confirmLabel: 'Load', cancelLabel: 'Cancel',
    });
    if (!ok) return;
  }
  const newIds = [];
  for (const f of files) {
    const id = crypto.randomUUID();
    IDE.files[id] = { id, name: f.name, content: f.content, language: getLang(f.name), saved: false };
    await pfsSave(f.name, f.content);
    newIds.push(id);
  }
  newIds.forEach(id => { if (!IDE.openTabs.includes(id)) IDE.openTabs.push(id); });
  renderFileTree();
  _openFile(newIds[0]);
  toast(`${tpl} template loaded!`);
}

// ══════════════════════════════════════════════════════════
//  RUN CODE
// ══════════════════════════════════════════════════════════
function ideRunCode() {
  if (!IDE.activeFile) { toast('No file open', 'error'); return; }
  const f = IDE.files[IDE.activeFile];
  if (!f) return;
  if (IDE.cm) f.content = IDE.cm.getValue();
  f.saved = true; pfsSave(f.name, f.content);
  renderFileTabs(); renderFileTree();

  const ext    = f.name.split('.').pop().toLowerCase();
  const code   = f.content || '';
  const outDiv = document.getElementById('ide-output');
  const outPre = document.getElementById('ide-output-pre');
  const frame  = document.getElementById('ide-html-frame');
  outDiv.style.display = '';
  if (typeof window.idePanels?.openOutput === 'function') window.idePanels.openOutput();

  if (['html','htm'].includes(ext)) {
    showOutTab('preview');
    outPre.style.display = 'none'; frame.style.display = ''; frame.srcdoc = code;
  } else if (['js','mjs'].includes(ext)) {
    showOutTab('console');
    outPre.style.display = ''; frame.style.display = 'none'; outPre.textContent = '';
    const log = (...a) => { outPre.textContent += a.map(x => typeof x === 'object' ? JSON.stringify(x,null,2) : String(x)).join(' ') + '\n'; };
    try {
      const sb = document.createElement('iframe');
      sb.style.display = 'none'; document.body.appendChild(sb);
      sb.contentWindow.console = { log, warn: log, error: log, info: log, debug: log };
      sb.contentWindow.eval(code); sb.remove();
      if (!outPre.textContent.trim()) outPre.textContent = '(no console output)';
    } catch(err) { outPre.textContent = '⚠ Error: ' + err.message; }
    _addAskAiBtn(outPre.textContent);
  } else {
    showOutTab('console');
    outPre.style.display = ''; frame.style.display = 'none';
    const hints = {
      py:'python '+f.name, ts:'npx ts-node '+f.name, tsx:'npm run dev',
      jsx:'npm run dev', rs:'cargo run', go:'go run '+f.name,
      rb:'ruby '+f.name, php:'php '+f.name,
    };
    const cmd = hints[ext];
    outPre.textContent = cmd
      ? `Run in terminal:\n  ${cmd}\n\nOpen the Terminal panel to run this.`
      : `Cannot run .${ext} files in-browser. Use the Terminal panel.`;
  }
}

function _addAskAiBtn(outputText) {
  const outHdr = document.querySelector('.ide-output-hdr > div');
  if (!outHdr) return;
  document.getElementById('ide-ask-ai-output-btn')?.remove();
  const btn = document.createElement('button');
  btn.id = 'ide-ask-ai-output-btn'; btn.className = 'ide-hdr-btn';
  btn.title = 'Ask AI about this output'; btn.textContent = '🤖 Ask AI';
  btn.addEventListener('click', () => {
    const inp = document.getElementById('ide-ai-input');
    inp.value = `Here is my console output:\n\`\`\`\n${outputText.slice(0,1000)}\n\`\`\`\nExplain any errors and suggest fixes.`;
    inp.style.height = 'auto'; inp.style.height = Math.min(inp.scrollHeight,120) + 'px';
    document.getElementById('ide-ai-panel').classList.remove('hidden','ide-panel-hidden');
    ideAiSend();
  });
  outHdr.prepend(btn);
}

function showOutTab(tab) {
  IDE.outTab = tab;
  document.querySelectorAll('.ide-out-tab').forEach(t => t.classList.toggle('active', t.dataset.out === tab));
  const frame = document.getElementById('ide-html-frame');
  const pre   = document.getElementById('ide-output-pre');
  frame.style.display = tab === 'preview' ? '' : 'none';
  pre.style.display   = tab !== 'preview' ? '' : 'none';
}

// ══════════════════════════════════════════════════════════
//  TERMINAL
// ══════════════════════════════════════════════════════════
function toggleTerminal() {
  const nowOpen = typeof window.panelsToggleTerm === 'function'
    ? window.panelsToggleTerm()
    : (() => {
        const p = document.getElementById('ide-terminal-panel');
        if (!p) return false;
        const next = p.style.display === 'none' || !p.style.display;
        p.style.display = next ? 'flex' : 'none';
        return next;
      })();

  if (nowOpen) {
    const panel = document.getElementById('ide-terminal-panel');
    if (panel && !panel.dataset.termBuilt) {
      panel.dataset.termBuilt = '1';
      if (typeof window.buildIdeTerminal === 'function') {
        window.buildIdeTerminal(document.getElementById('ide-term-body'));
      }
    }
  }
  requestAnimationFrame(() => { if (IDE.cm) IDE.cm.refresh(); });
}

// ══════════════════════════════════════════════════════════
//  AI CONTEXT
// ══════════════════════════════════════════════════════════
function getIdeContext() {
  if (!document.getElementById('ide-include-code')?.checked) return '';
  const includeAll  = document.getElementById('ide-include-all-files')?.checked ?? true;
  const projectName = document.getElementById('ide-project-name')?.textContent?.trim() || 'my-project';
  const allNames    = Object.values(IDE.files).map(f => f.name).join(', ');
  let ctx  = `\n\n[Project: ${projectName}]\n[Files: ${allNames}]\n`;
  let used = ctx.length;
  const MAX = 14000;
  if (IDE.activeFile && IDE.files[IDE.activeFile]) {
    const f    = IDE.files[IDE.activeFile];
    const code = IDE.cm ? IDE.cm.getValue() : f.content;
    ctx  += `\n[Active: ${f.name}]\n\`\`\`${f.language||'text'}\n${code.slice(0,8000)}\n\`\`\`\n`;
    used += code.length;
  }
  if (includeAll) {
    for (const [id, f] of Object.entries(IDE.files)) {
      if (id === IDE.activeFile || used > MAX) continue;
      const snip = f.content.slice(0, 1500);
      ctx  += `\n[File: ${f.name}]\n\`\`\`${f.language||'text'}\n${snip}${f.content.length>1500?'\n// …truncated':''}\n\`\`\`\n`;
      used += snip.length;
    }
  }
  return ctx;
}

// ══════════════════════════════════════════════════════════
//  FILE OPS PARSER (AI)
// ══════════════════════════════════════════════════════════
const FILE_OP_RE = /<nd_file_op\s+([^>]*?)>([\s\S]*?)<\/nd_file_op>|<nd_file_op\s+([^/]*?)\s*\/>/g;

function parseFileOps(text) {
  const ops = []; let m;
  FILE_OP_RE.lastIndex = 0;
  while ((m = FILE_OP_RE.exec(text)) !== null) {
    const attrsStr = (m[1] || m[3] || '').trim();
    const content  = (m[2] || '').trim();
    const attrs    = {};
    attrsStr.replace(/(\w+)="([^"]*?)"/g, (_, k, v) => { attrs[k] = v; });
    if (attrs.action) ops.push({ ...attrs, content });
  }
  return ops;
}

function stripFileOps(text) {
  return text.replace(FILE_OP_RE, '').replace(/\n{3,}/g, '\n\n').trim();
}

async function applyFileOp(op) {
  if (op.action === 'create' || op.action === 'modify') {
    const existing = Object.values(IDE.files).find(f => f.name === op.file);
    if (existing) {
      existing.content = op.content; existing.saved = false;
      if (IDE.activeFile === existing.id && IDE.cm) IDE.cm.setValue(op.content);
      await pfsSave(op.file, op.content);
    } else {
      const id = crypto.randomUUID();
      IDE.files[id] = { id, name: op.file, content: op.content, language: getLang(op.file), saved: false };
      await pfsSave(op.file, op.content);
      if (!IDE.openTabs.includes(id)) IDE.openTabs.push(id);
      _openFile(id);
    }
    renderFileTree(); renderFileTabs();
    toast(`${op.action === 'create' ? '📄' : '✏️'} ${op.action} ${op.file}`);
    return;
  }
  if (op.action === 'delete') {
    const f = Object.values(IDE.files).find(f => f.name === op.file);
    if (!f) { toast(`Not found: ${op.file}`, 'error'); return; }
    await pfsDelete(op.file);
    IDE.openTabs = IDE.openTabs.filter(t => t !== f.id);
    delete IDE.files[f.id];
    if (IDE.activeFile === f.id) {
      IDE.openTabs.length ? _openFile(IDE.openTabs[IDE.openTabs.length-1]) : showWelcome();
    } else { renderFileTabs(); renderFileTree(); }
    toast(`🗑 Deleted ${op.file}`);
    return;
  }
  if (op.action === 'rename') {
    const newName = op.to || op.new_name;
    const f       = Object.values(IDE.files).find(f => f.name === (op.file || op.from));
    if (!f || !newName) return;
    await pfsRename(f.name, newName);
    f.name = newName; f.language = getLang(newName);
    if (IDE.cm && IDE.activeFile === f.id) IDE.cm.setOption('mode', f.language);
    renderFileTree(); renderFileTabs();
    toast(`🔄 Renamed → ${newName}`);
  }
}

function _renderFileOpCards(ops, container) {
  if (!ops.length) return;
  const panel  = document.createElement('div');
  panel.className = 'ide-fop-panel';
  const icons  = { create:'📄', modify:'✏️', delete:'🗑️', rename:'🔄' };
  const labels = { create:'Create', modify:'Modify', delete:'Delete', rename:'Rename' };
  panel.innerHTML = `
    <div class="ide-fop-header">
      <span class="ide-fop-title">⚡ ${ops.length} file operation${ops.length>1?'s':''}</span>
      <button class="ide-fop-apply-all-btn">Apply All</button>
    </div>
    ${ops.map((op,i) => {
      const name    = op.file || op.from || '?';
      const preview = op.content ? op.content.slice(0,70).replace(/\n/g,' ')+(op.content.length>70?'…':'') : '';
      return `
        <div class="ide-fop-card ide-fop-${op.action}">
          <div class="ide-fop-row">
            <span class="ide-fop-badge">${icons[op.action]||'⚡'} ${labels[op.action]||op.action}</span>
            <span class="ide-fop-filename">${escHtml(name)}</span>
            ${op.action==='rename'?`<span class="ide-fop-arrow">→ ${escHtml(op.to||op.new_name||'')}</span>`:''}
            <div class="ide-fop-btns">
              ${op.content?`<button class="ide-fop-btn ide-fop-prev-btn" data-i="${i}">Preview</button>`:''}
              <button class="ide-fop-btn ide-fop-apply-btn" data-i="${i}">Apply</button>
            </div>
          </div>
          ${preview?`<div class="ide-fop-preview-line">${escHtml(preview)}</div>`:''}
        </div>`;
    }).join('')}`;
  container.appendChild(panel);

  panel.querySelector('.ide-fop-apply-all-btn').addEventListener('click', async function() {
    this.disabled = true; this.textContent = 'Applying…';
    for (const op of ops) await applyFileOp(op);
    this.textContent = '✓ All Applied';
    panel.querySelectorAll('.ide-fop-apply-btn').forEach(b => { b.textContent='✓'; b.disabled=true; });
    await pkSaveHistory();
  });
  panel.querySelectorAll('.ide-fop-apply-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      await applyFileOp(ops[+btn.dataset.i]);
      btn.textContent = '✓'; btn.disabled = true;
    });
  });
  panel.querySelectorAll('.ide-fop-prev-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const op = ops[+btn.dataset.i];
      const cb = document.getElementById('canvas-body');
      const ct = document.getElementById('canvas-title');
      if (!cb||!ct) return;
      ct.textContent = `Preview · ${op.file}`;
      cb.innerHTML = '';
      const pre=document.createElement('pre'), code=document.createElement('code');
      code.className = `language-${getLang(op.file)||'text'}`;
      code.textContent = op.content;
      pre.appendChild(code); cb.appendChild(pre);
      try { hljs.highlightElement(code); } catch(e) {}
      document.getElementById('canvas-run-output').style.display = 'none';
      document.getElementById('canvas-panel').classList.add('open');
      document.getElementById('canvas-overlay').classList.add('open');
    });
  });
}

// ══════════════════════════════════════════════════════════
//  AI ASSISTANT
// ══════════════════════════════════════════════════════════
const AI_CHIPS = [
  { p:'Explain this code step by step.',                                                        l:'Explain' },
  { p:'Find and fix all bugs. Apply corrected code with file operations.',                      l:'Fix Bugs' },
  { p:'Refactor for performance and readability. Apply changes.',                               l:'Optimise' },
  { p:'Add TypeScript types. Convert .js files to .ts.',                                       l:'→ TypeScript' },
  { p:'Write comprehensive unit tests in a new test file.',                                     l:'Add Tests' },
  { p:'Add JSDoc/docstring comments to all public functions.',                                  l:'Add Docs' },
  { p:'Review ALL project files. List issues by severity and propose fixes.',                   l:'Review All' },
  { p:'Write a detailed README.md for this project.',                                           l:'README' },
  { p:'Create a complete .gitignore for this project type.',                                    l:'.gitignore' },
  { p:'Create a Dockerfile and docker-compose.yml for this project.',                          l:'Dockerise' },
  { p:'How do I push this to GitHub? Give exact terminal commands.',                            l:'GitHub' },
  { p:'How do I deploy this? Cover Vercel, Netlify, and Railway with step-by-step commands.',  l:'Deploy' },
];

function _buildAiWelcome() {
  return `
    <div class="ide-ai-welcome-msg">
      <div class="ide-ai-welcome-icon">🤖</div>
      <strong>AI Code Assistant</strong>
      <p>I can <em>create</em>, <em>modify</em>, <em>delete</em>, and <em>rename</em> your files directly.
         Ask me anything about your project.</p>
    </div>
    <div class="ide-ai-chips">${AI_CHIPS.map(c =>
      `<button class="ide-ai-chip" data-p="${escHtml(c.p)}">${escHtml(c.l)}</button>`
    ).join('')}</div>`;
}

function _refreshAiPanel(showHistory) {
  const msgsEl = document.getElementById('ide-ai-msgs');
  if (!msgsEl) return;
  msgsEl.innerHTML = '';
  if (showHistory && IDE.aiMessages.length) {
    const div = document.createElement('div');
    div.className = 'ide-ai-history-divider';
    div.innerHTML = `<span>↑ ${IDE.aiMessages.filter(m=>m.role==='user').length} previous exchanges</span>
      <button id="ide-hist-clear-btn">Clear</button>`;
    msgsEl.appendChild(div);
    document.getElementById('ide-hist-clear-btn')?.addEventListener('click', async () => {
      await pkClearHistory(); _refreshAiPanel(false); toast('History cleared');
    });
    IDE.aiMessages.forEach(m => { if (m.role !== 'system') _addIdeMsgEl(m.role, m.content); });
    const chipsDiv = document.createElement('div');
    chipsDiv.className = 'ide-ai-chips';
    chipsDiv.innerHTML = AI_CHIPS.map(c => `<button class="ide-ai-chip" data-p="${escHtml(c.p)}">${escHtml(c.l)}</button>`).join('');
    msgsEl.appendChild(chipsDiv);
    _wireAiChips(chipsDiv);
  } else {
    msgsEl.innerHTML = _buildAiWelcome();
    _wireAiChips(msgsEl);
  }
  msgsEl.scrollTop = msgsEl.scrollHeight;
}

function _wireAiChips(container) {
  container.querySelectorAll('.ide-ai-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const inp = document.getElementById('ide-ai-input');
      inp.value = chip.dataset.p;
      inp.style.height = 'auto';
      inp.style.height = Math.min(inp.scrollHeight, 120) + 'px';
      ideAiSend();
    });
  });
}

// AI send
document.getElementById('ide-ai-send').addEventListener('click', ideAiSend);
document.getElementById('ide-ai-input').addEventListener('keydown', e => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); ideAiSend(); }
  requestAnimationFrame(() => {
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  });
});
document.getElementById('ide-ai-stop').addEventListener('click', () => { IDE.abortIde = true; });
document.getElementById('ide-ai-clear').addEventListener('click', async () => {
  await pkClearHistory(); _refreshAiPanel(false); toast('Chat cleared');
});
document.getElementById('ide-ai-close').addEventListener('click', () => {
  document.getElementById('ide-ai-panel').classList.add('ide-panel-hidden');
  if (typeof window.idePanels !== 'undefined') { /* panels.js handles state */ }
});

async function ideAiSend() {
  if (IDE.ideBusy) return;
  const input = document.getElementById('ide-ai-input');
  const text  = input.value.trim();
  if (!text) return;
  input.value = ''; input.style.height = 'auto';

  const msgsEl = document.getElementById('ide-ai-msgs');
  msgsEl.querySelector('.ide-ai-welcome-msg')?.remove();
  msgsEl.querySelector('.ide-ai-chips')?.remove();

  _addIdeMsgEl('user', text);
  IDE.aiMessages.push({ role: 'user', content: text });
  IDE.ideBusy = true; IDE.abortIde = false;
  document.getElementById('ide-ai-send').style.display = 'none';
  document.getElementById('ide-ai-stop').style.display = '';

  const ctxStr = getIdeContext();
  const sysPrompt = `You are an expert full-stack coding assistant in NeuralDock IDE.
You can CREATE, MODIFY, DELETE, and RENAME files using XML tags.

Create: <nd_file_op action="create" file="name.ext">COMPLETE content</nd_file_op>
Modify: <nd_file_op action="modify" file="name.ext">COMPLETE new content</nd_file_op>
Delete: <nd_file_op action="delete" file="name.ext" />
Rename: <nd_file_op action="rename" file="old.ext" to="new.ext" />

Rules: Always provide COMPLETE file content. Emit multiple ops per response.
Explain changes clearly. For refactors across files, emit ALL affected files.`;

  const chatMsgs = [
    { role: 'system', content: sysPrompt },
    ...IDE.aiMessages.slice(-30).map((m, i, arr) => ({
      role: m.role,
      content: m.role === 'user' && i === arr.length - 1 ? m.content + ctxStr : m.content,
    })),
  ];

  const thinkEl = document.createElement('div');
  thinkEl.className = 'ide-ai-msg assistant';
  thinkEl.innerHTML = `<div class="ide-thinking-dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>`;
  msgsEl.appendChild(thinkEl);
  msgsEl.scrollTop = msgsEl.scrollHeight;

  let full = '';
  try {
    const resp = await puter.ai.chat(chatMsgs, { model: S.currentModel, stream: true, temperature: S.temperature || 0.7 });
    thinkEl.remove();
    const bodyEl = _addIdeMsgEl('assistant', '', true);

    if (resp && typeof resp[Symbol.asyncIterator] === 'function') {
      for await (const part of resp) {
        if (IDE.abortIde) break;
        const t = part?.text || part?.message?.content || '';
        if (t) { full += t; bodyEl.innerHTML = renderMarkdown(stripFileOps(full)); msgsEl.scrollTop = msgsEl.scrollHeight; }
      }
    } else if (resp?.message?.content) { full = resp.message.content; bodyEl.innerHTML = renderMarkdown(stripFileOps(full)); }
    else if (typeof resp === 'string')  { full = resp; bodyEl.innerHTML = renderMarkdown(stripFileOps(full)); }

    bodyEl.classList.remove('streaming-cursor');
    bodyEl.querySelectorAll('pre code').forEach(b => { try { hljs.highlightElement(b); } catch(_) {} });

    const ops = parseFileOps(full);
    if (ops.length) {
      _renderFileOpCards(ops, msgsEl);
    } else {
      bodyEl.querySelectorAll('pre').forEach(pre => {
        const code = pre.querySelector('code');
        if (!code) return;
        const btn = document.createElement('button');
        btn.className = 'ide-apply-btn'; btn.textContent = '⤵ Apply to editor';
        btn.addEventListener('click', () => {
          const ct = code.textContent || '';
          if (IDE.cm) IDE.cm.setValue(ct);
          if (IDE.activeFile && IDE.files[IDE.activeFile]) {
            IDE.files[IDE.activeFile].content = ct;
            IDE.files[IDE.activeFile].saved = false;
            renderFileTabs(); renderFileTree();
          }
          toast('Applied ✓');
        });
        pre.style.position = 'relative'; pre.appendChild(btn);
      });
    }

    IDE.aiMessages.push({ role: 'assistant', content: full });
    await pkSaveHistory();

  } catch(err) {
    thinkEl.remove();
    if (!IDE.abortIde) {
      _addIdeMsgEl('assistant', '⚠ ' + (err.message || 'Request failed'));
      toast('AI error: ' + (err.message || ''), 'error');
    }
  }

  IDE.ideBusy = false; IDE.abortIde = false;
  document.getElementById('ide-ai-send').style.display = '';
  document.getElementById('ide-ai-stop').style.display = 'none';
}

function _addIdeMsgEl(role, text, streaming = false) {
  const msgsEl = document.getElementById('ide-ai-msgs');
  const wrap   = document.createElement('div');
  wrap.className = `ide-ai-msg ${role}`;
  if (streaming) wrap.classList.add('streaming-cursor');
  if (text) {
    if (role === 'assistant') { wrap.classList.add('md'); wrap.innerHTML = renderMarkdown(text); }
    else wrap.textContent = text;
  }
  msgsEl.appendChild(wrap);
  msgsEl.scrollTop = msgsEl.scrollHeight;
  return wrap;
}
function addIdeMsg(role, text, streaming) { return _addIdeMsgEl(role, text, streaming); }

// ══════════════════════════════════════════════════════════
//  BUTTON WIRING
//  NOTE: #ide-ai-toggle (old "AI Help") REMOVED — the single
//  canonical button is #ide-toggle-ai (in panel-toggle-row,
//  wired by ide-panels.js).
// ══════════════════════════════════════════════════════════
document.getElementById('ide-new-btn')?.addEventListener('click',         () => ideNewFile());
document.getElementById('ide-upload-btn')?.addEventListener('click',       ideUploadFile);
document.getElementById('ide-zip-btn')?.addEventListener('click',          ideDownloadZip);
document.getElementById('ide-tree-new-btn')?.addEventListener('click',     () => ideNewFile());
document.getElementById('ide-tree-upload-btn')?.addEventListener('click',  ideUploadFile);
document.getElementById('ide-save-btn')?.addEventListener('click',         ideSaveFile);
document.getElementById('ide-dl-btn')?.addEventListener('click',           ideDownloadFile);
document.getElementById('ide-run-btn')?.addEventListener('click',          ideRunCode);
document.getElementById('ide-terminal-btn')?.addEventListener('click',     toggleTerminal);
document.getElementById('ide-project-btn')?.addEventListener('click',      ideOpenProjectSwitcher);
document.getElementById('ide-terminal-close')?.addEventListener('click',  () => {
  if (typeof window.panelsToggleTerm === 'function') {
    // If panel is open, toggle it closed
    const p = document.getElementById('ide-terminal-panel');
    if (p && p.style.display !== 'none') window.panelsToggleTerm();
  } else {
    const p = document.getElementById('ide-terminal-panel');
    if (p) p.style.display = 'none';
  }
  requestAnimationFrame(() => { if (IDE.cm) IDE.cm.refresh(); });
});

// New feature buttons
document.getElementById('ide-format-btn')?.addEventListener('click',       ideFormatCode);
document.getElementById('ide-wrap-btn')?.addEventListener('click',         toggleWordWrap);
document.getElementById('ide-search-btn')?.addEventListener('click',       ideSearchFiles);
document.getElementById('ide-preview-btn')?.addEventListener('click',      ideLivePreview);
document.getElementById('ide-fold-btn')?.addEventListener('click',         ideFoldAll);
document.getElementById('ide-gotoline-btn')?.addEventListener('click',     ideGoToLine);

document.querySelectorAll('.ide-wlc-card[data-tpl]').forEach(c => c.addEventListener('click', () => ideQuickStart(c.dataset.tpl)));
document.querySelectorAll('.ide-tpl-chip[data-tpl]').forEach(c => c.addEventListener('click', () => ideQuickStart(c.dataset.tpl)));
document.getElementById('ide-wlc-new')?.addEventListener('click',     () => ideNewFile());
document.getElementById('ide-wlc-upload')?.addEventListener('click',   ideUploadFile);

document.getElementById('ide-output-close')?.addEventListener('click', () => { document.getElementById('ide-output').style.display = 'none'; });
document.getElementById('ide-output-clear')?.addEventListener('click', () => {
  document.getElementById('ide-output-pre').textContent = '';
  const f = document.getElementById('ide-html-frame');
  f.srcdoc = ''; f.style.display = 'none';
});
document.getElementById('ide-output-rerun')?.addEventListener('click', ideRunCode);
document.querySelectorAll('.ide-out-tab').forEach(tab => tab.addEventListener('click', () => showOutTab(tab.dataset.out)));

document.getElementById('ide-project-name')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); }
});
document.getElementById('ide-project-name')?.addEventListener('blur', function() {
  const n = this.textContent.trim() || 'my-project';
  if (n !== IDE.projectName) { IDE.projectName = n; this.textContent = n; }
});

// ══════════════════════════════════════════════════════════
//  TAB ACTIVATION (called from ui.js)
// ══════════════════════════════════════════════════════════
async function ideOnTabActivated() {
  if (IDE.activeFile && IDE.files[IDE.activeFile]) {
    const f = IDE.files[IDE.activeFile];
    document.getElementById('ide-welcome').style.display = 'none';
    document.getElementById('ide-monaco').style.display  = '';
    if (IDE.cm) {
      IDE.files[IDE.activeFile].content = IDE.cm.getValue();
      requestAnimationFrame(() => requestAnimationFrame(() => { IDE.cm.refresh(); IDE.cm.focus(); }));
    } else {
      initCM(f.content, f.language);
    }
  }
  updateStatusBar();
  if (!IDE._historyLoaded) {
    IDE._historyLoaded = true;
    const loaded = await pkLoadHistory();
    _refreshAiPanel(loaded);
  }
}
