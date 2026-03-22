/**
 * ide.js — Project IDE with Puter FS storage, AI file operations, terminal, history
 *
 * NEW IN THIS VERSION:
 * • Puter FS — every file auto-syncs to puter.fs under /NeuralDock-IDE/<project>/
 * • AI file operations — AI can create/modify/delete/rename files via <nd_file_op> tags
 * • AI history persistence — chat history saved to puter.kv per project
 * • Multi-file context — "Include all files" toggle sends full project context to AI
 * • Puter terminal — embedded panel with puter.ui.launchApp('terminal') + iframe fallback
 * • Project switcher — list/create/load cloud projects
 * • Rename file — UI action
 * • Auto-save — 2 s after last keystroke, syncs to Puter FS
 * • Ask AI about output — button in console tab
 * • Rich AI chips covering all common dev tasks
 */

'use strict';

// ── STATE ─────────────────────────────────────────────────────────────────
const IDE = {
  files:          {},
  activeFile:     null,
  cm:             null,
  aiMessages:     [],
  ideBusy:        false,
  abortIde:       false,
  outTab:         'preview',
  termOpen:       false,
  projectName:    'my-project',
  _historyLoaded: false,
};

// ── THEMED MODAL ──────────────────────────────────────────────────────────
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
          value="${escHtml(input.default || '')}" placeholder="${escHtml(input.placeholder || '')}" autocomplete="off">` : ''}
        <div class="ide-modal-btns">
          <button class="ide-modal-btn cancel"  id="ide-modal-cancel">${escHtml(cancelLabel)}</button>
          <button class="ide-modal-btn confirm" id="ide-modal-confirm">${escHtml(confirmLabel)}</button>
        </div>
      </div>`;
    document.body.appendChild(ov);
    const inp = document.getElementById('ide-modal-input');
    const ok  = document.getElementById('ide-modal-confirm');
    const no  = document.getElementById('ide-modal-cancel');
    if (inp) { inp.focus(); inp.select(); inp.addEventListener('keydown', e => { if (e.key==='Enter') ok.click(); if (e.key==='Escape') no.click(); }); }
    else ok.focus();
    const done = v => { ov.remove(); resolve(v); };
    ok.addEventListener('click', () => done(input ? (inp?.value?.trim() || null) : true));
    no.addEventListener('click', () => done(null));
    ov.addEventListener('click', e => { if (e.target === ov) done(null); });
  });
}

// ── PUTER FS ──────────────────────────────────────────────────────────────
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
        const id   = crypto.randomUUID();
        files[id]  = { id, name: item.name, content: text, language: getLang(item.name), saved: true };
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

// ── PUTER KV — AI HISTORY ─────────────────────────────────────────────────
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

// ── CODEMIRROR ────────────────────────────────────────────────────────────
function initCM(content = '', lang = 'null') {
  const container = document.getElementById('ide-monaco');
  if (IDE.cm) {
    IDE.cm.setValue(content);
    IDE.cm.setOption('mode', lang || 'null');
    requestAnimationFrame(() => requestAnimationFrame(() => { IDE.cm.refresh(); IDE.cm.focus(); }));
    return;
  }
  container.style.display = '';
  IDE.cm = CodeMirror(container, {
    value: content, mode: lang || 'null', theme: 'aistudio',
    lineNumbers: true, autoCloseBrackets: true, matchBrackets: true,
    lineWrapping: true, indentUnit: 2, tabSize: 2, indentWithTabs: false,
    extraKeys: {
      'Ctrl-S': () => ideSaveFile(), 'Cmd-S': () => ideSaveFile(),
      'Ctrl-/': 'toggleComment',    'Cmd-/': 'toggleComment',
      'Tab': cm => cm.execCommand('insertSoftTab'),
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
}

// ── AUTO-SAVE ─────────────────────────────────────────────────────────────
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

// ── FILE MANAGEMENT ───────────────────────────────────────────────────────
async function ideNewFile(suggestedName) {
  const name = suggestedName || await ideModal({
    title: 'New File', message: 'Enter a filename:',
    input: { default: 'index.html', placeholder: 'e.g. index.html, app.py' },
    confirmLabel: 'Create',
  });
  if (!name?.trim()) return;
  const id = crypto.randomUUID();
  IDE.files[id] = { id, name: name.trim(), content: '', language: getLang(name), saved: true };
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
  renderFileTree();
  _openFile(newIds[newIds.length - 1]);
  toast(`Uploaded ${newIds.length} file(s)`);
});

async function ideDeleteFile(id, e) {
  if (e) { e.stopPropagation(); e.preventDefault(); }
  const f = IDE.files[id];
  if (!f) return;
  const ok = await ideModal({
    title: 'Delete File', message: `Delete "${f.name}"? This cannot be undone.`,
    confirmLabel: 'Delete', cancelLabel: 'Cancel',
  });
  if (!ok) return;
  await pfsDelete(f.name);
  delete IDE.files[id];
  if (IDE.activeFile === id) {
    const rem = Object.keys(IDE.files);
    rem.length ? _openFile(rem[rem.length - 1]) : showWelcome();
  } else { renderFileTabs(); renderFileTree(); }
  toast('Deleted ' + f.name);
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
  f.name = newName.trim(); f.language = getLang(newName.trim());
  if (IDE.cm && IDE.activeFile === id) IDE.cm.setOption('mode', f.language);
  renderFileTree(); renderFileTabs();
  toast(`Renamed to ${newName.trim()}`);
}

function ideSaveFile() {
  if (!IDE.activeFile) return;
  const f = IDE.files[IDE.activeFile];
  if (!f) return;
  if (IDE.cm) f.content = IDE.cm.getValue();
  f.saved = true;
  pfsSave(f.name, f.content);
  renderFileTabs(); renderFileTree();
  toast('Saved ' + f.name);
}

function ideDownloadFile() {
  if (!IDE.activeFile) { toast('No file open', 'error'); return; }
  ideSaveFile();
  const f = IDE.files[IDE.activeFile];
  const a = document.createElement('a');
  a.href     = URL.createObjectURL(new Blob([f.content], { type: 'text/plain' }));
  a.download = f.name; a.click();
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
  a.download = project + '.zip'; a.click();
  URL.revokeObjectURL(a.href);
  toast(`Downloaded ${project}.zip`);
}

function _openFile(id) {
  if (IDE.cm && IDE.activeFile && IDE.files[IDE.activeFile]) {
    IDE.files[IDE.activeFile].content = IDE.cm.getValue();
  }
  IDE.activeFile = id;
  const f = IDE.files[id];
  if (!f) return;
  renderFileTree(); renderFileTabs();
  const visible = document.getElementById('panel-code')?.classList.contains('active');
  document.getElementById('ide-welcome').style.display = 'none';
  document.getElementById('ide-monaco').style.display  = '';
  if (visible) initCM(f.content, f.language);
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
        `<button class="ide-file-btn ide-file-del"    data-id="${id}" title="Delete">✕</button>` +
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
  Object.values(IDE.files).forEach(f => {
    const tab = document.createElement('button');
    tab.className    = 'ide-tab' + (f.id === IDE.activeFile ? ' active' : '');
    tab.dataset.fileId = f.id;
    tab.innerHTML =
      `<span>${getFileIcon(f.name)}</span>` +
      `<span class="ide-tab-name">${escHtml(f.name)}</span>` +
      (f.saved ? '' : `<span class="ide-tab-dot">●</span>`) +
      `<span class="ide-tab-close" data-id="${f.id}">×</span>`;
    tab.addEventListener('click', e => {
      const close = e.target.closest('.ide-tab-close');
      if (close) { e.stopPropagation(); _closeTab(close.dataset.id); }
      else _openFile(f.id);
    });
    list.appendChild(tab);
  });
}

function _closeTab(id) {
  const f = IDE.files[id];
  if (!f) return;
  if (IDE.activeFile === id && IDE.cm) { f.content = IDE.cm.getValue(); f.saved = true; pfsSave(f.name, f.content); }
  delete IDE.files[id];
  if (IDE.activeFile === id) {
    const rem = Object.keys(IDE.files);
    rem.length ? _openFile(rem[rem.length - 1]) : showWelcome();
  } else { renderFileTabs(); renderFileTree(); }
}

// ── PROJECT SWITCHER ──────────────────────────────────────────────────────
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
  IDE.files = loaded || {};
  IDE.activeFile = null;
  IDE._historyLoaded = false;
  IDE.aiMessages = [];
  if (IDE.cm) IDE.cm.setValue('');
  renderFileTree(); renderFileTabs();
  const ids = Object.keys(IDE.files);
  if (ids.length) _openFile(ids[0]); else showWelcome();
  const histLoaded = await pkLoadHistory();
  _refreshAiPanel(histLoaded);
  toast(`Project: ${name}`);
}

// ── TEMPLATES ─────────────────────────────────────────────────────────────
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
  for (const f of files) {
    const id = crypto.randomUUID();
    IDE.files[id] = { id, name: f.name, content: f.content, language: getLang(f.name), saved: false };
    await pfsSave(f.name, f.content);
  }
  renderFileTree();
  _openFile(Object.keys(IDE.files)[0]);
  toast(`${tpl} template loaded!`);
}

// ── RUN CODE ──────────────────────────────────────────────────────────────
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
    const hints = { py:'python '+f.name, ts:'npx ts-node '+f.name, tsx:'npm run dev', jsx:'npm run dev', rs:'cargo run', go:'go run '+f.name, rb:'ruby '+f.name, php:'php '+f.name };
    const cmd = hints[ext];
    outPre.textContent = cmd
      ? `Run in terminal:\n  ${cmd}\n\nClick the Terminal button in the toolbar to open a shell.`
      : `Cannot run .${ext} files in-browser.\nUse the Terminal button to open a shell.`;
  }
}

function _addAskAiBtn(outputText) {
  const outHdr = document.querySelector('.ide-output-hdr > div');
  if (!outHdr) return;
  document.getElementById('ide-ask-ai-output-btn')?.remove();
  const btn = document.createElement('button');
  btn.id = 'ide-ask-ai-output-btn'; btn.className = 'ide-hdr-btn';
  btn.title = 'Ask AI about this output / error'; btn.textContent = '🤖 Ask AI';
  btn.addEventListener('click', () => {
    const inp = document.getElementById('ide-ai-input');
    inp.value = `Here is my console output:\n\`\`\`\n${outputText.slice(0,1000)}\n\`\`\`\nExplain any errors and suggest fixes using file operations if needed.`;
    inp.style.height = 'auto'; inp.style.height = Math.min(inp.scrollHeight,120) + 'px';
    document.getElementById('ide-ai-panel').classList.remove('hidden');
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

// ── TERMINAL ──────────────────────────────────────────────────────────────
function toggleTerminal() {
  IDE.termOpen = !IDE.termOpen;
  const panel  = document.getElementById('ide-terminal-panel');
  if (!panel) return;
  panel.style.display = IDE.termOpen ? 'flex' : 'none';
  if (IDE.termOpen && !panel.dataset.loaded) {
    panel.dataset.loaded = '1';
    _buildTerminal(panel.querySelector('.ide-term-body'));
  }
  requestAnimationFrame(() => { if (IDE.cm) IDE.cm.refresh(); });
}

function _buildTerminal(body) {
  if (!body) return;
  body.innerHTML = `
    <div class="ide-term-placeholder">
      <div class="ide-term-ph-icon">⬛</div>
      <p>Open the <strong>Puter Terminal</strong> — a full Unix shell with access to your project files.</p>
      <p class="ide-term-ph-path">Your files are at: <code>~/NeuralDock-IDE/${escHtml(IDE.projectName)}/</code></p>
      <div class="ide-term-btn-row">
        <button class="ide-tool-btn" id="ide-term-launch">▶ Launch Puter Terminal</button>
        <button class="ide-tool-btn" id="ide-term-embed">⊞ Embed (experimental)</button>
      </div>
    </div>`;
  document.getElementById('ide-term-launch')?.addEventListener('click', () => {
    try { puter.ui.launchApp('terminal'); }
    catch(e) { window.open('https://puter.com/app/terminal', '_blank'); }
  });
  document.getElementById('ide-term-embed')?.addEventListener('click', () => {
    body.innerHTML = `<iframe id="ide-terminal-frame"
      src="https://puter.com/app/terminal"
      style="width:100%;height:100%;border:none;background:#000;"
      allow="clipboard-read;clipboard-write"
      sandbox="allow-same-origin allow-scripts allow-forms allow-modals allow-popups allow-downloads">
    </iframe>`;
  });
}

// ── AI CONTEXT ────────────────────────────────────────────────────────────
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

// ── FILE OPS PARSER ───────────────────────────────────────────────────────
const FILE_OP_RE = /<nd_file_op\s+([^>]*?)>([\s\S]*?)<\/nd_file_op>|<nd_file_op\s+([^/]*?)\s*\/>/g;

function parseFileOps(text) {
  const ops = [];
  let m;
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
      _openFile(id);
    }
    renderFileTree(); renderFileTabs();
    toast(`${op.action === 'create' ? '📄 Created' : '✏️ Modified'} ${op.file}`);
    return;
  }
  if (op.action === 'delete') {
    const f = Object.values(IDE.files).find(f => f.name === op.file);
    if (!f) { toast(`Not found: ${op.file}`, 'error'); return; }
    await pfsDelete(op.file);
    delete IDE.files[f.id];
    if (IDE.activeFile === f.id) {
      const rem = Object.keys(IDE.files);
      rem.length ? _openFile(rem[rem.length-1]) : showWelcome();
    } else { renderFileTabs(); renderFileTree(); }
    toast(`🗑️ Deleted ${op.file}`);
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
    toast(`🔄 Renamed to ${newName}`);
  }
}

function _renderFileOpCards(ops, container) {
  if (!ops.length) return;
  const panel = document.createElement('div');
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
      await pkSaveHistory();
    });
  });

  panel.querySelectorAll('.ide-fop-prev-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const op = ops[+btn.dataset.i];
      const cb = document.getElementById('canvas-body');
      const ct = document.getElementById('canvas-title');
      if (!cb || !ct) return;
      ct.textContent = `Preview · ${op.file}`;
      cb.innerHTML   = '';
      const pre  = document.createElement('pre');
      const code = document.createElement('code');
      code.className   = `language-${getLang(op.file)||'text'}`;
      code.textContent = op.content;
      pre.appendChild(code); cb.appendChild(pre);
      try { hljs.highlightElement(code); } catch(e) {}
      document.getElementById('canvas-run-output').style.display = 'none';
      document.getElementById('canvas-panel').classList.add('open');
      document.getElementById('canvas-overlay').classList.add('open');
    });
  });
}

// ── AI ASSISTANT ──────────────────────────────────────────────────────────
const AI_CHIPS = [
  { p: 'Explain this code step by step.',                                                        l: 'Explain' },
  { p: 'Find and fix all bugs. Use file operations to apply the corrected code.',                l: 'Fix Bugs' },
  { p: 'Refactor and optimise this code for performance and readability. Apply with file ops.',  l: 'Optimise' },
  { p: 'Add TypeScript types. Rename .js files to .ts and update their content.',               l: '→ TypeScript' },
  { p: 'Write comprehensive unit tests. Create a new test file using file operations.',          l: 'Add Tests' },
  { p: 'Add JSDoc/docstring comments to all public functions.',                                  l: 'Add Docs' },
  { p: 'Review ALL project files. List issues by severity. Propose fixes with file operations.', l: 'Review All' },
  { p: 'Write a detailed README.md for this project. Create it with a file operation.',         l: 'README' },
  { p: 'Generate a complete .gitignore for this project type. Create it with a file operation.',l: '.gitignore' },
  { p: 'Create a Dockerfile and docker-compose.yml for this project.',                          l: 'Dockerise' },
  { p: 'How do I push this project to GitHub? Give exact terminal commands.',                    l: 'GitHub' },
  { p: 'How do I deploy this? Cover Vercel, Netlify, and Railway with step-by-step commands.',  l: 'Deploy' },
];

function _buildAiWelcome() {
  return `
    <div class="ide-ai-welcome-msg">
      <div class="ide-ai-welcome-icon">🤖</div>
      <strong>AI Code Assistant</strong>
      <p>I can <em>create</em>, <em>modify</em>, <em>delete</em>, and <em>rename</em> files directly. Ask me anything about your project.</p>
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
    div.innerHTML = `<span>↑ ${IDE.aiMessages.filter(m=>m.role==='user').length} previous exchanges · ${escHtml(IDE.projectName)}</span>
      <button id="ide-hist-clear-btn">Clear</button>`;
    msgsEl.appendChild(div);
    document.getElementById('ide-hist-clear-btn')?.addEventListener('click', async () => {
      await pkClearHistory();
      _refreshAiPanel(false);
      toast('Chat history cleared');
    });
    IDE.aiMessages.forEach(m => { if (m.role !== 'system') _addIdeMsgEl(m.role, m.content); });
    // Add chips below
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
  await pkClearHistory();
  _refreshAiPanel(false);
  toast('Chat cleared');
});
document.getElementById('ide-ai-close').addEventListener('click', () => {
  document.getElementById('ide-ai-panel').classList.add('hidden');
});

async function ideAiSend() {
  if (IDE.ideBusy) return;
  const input = document.getElementById('ide-ai-input');
  const text  = input.value.trim();
  if (!text) return;
  input.value = ''; input.style.height = 'auto';

  const msgsEl = document.getElementById('ide-ai-msgs');
  msgsEl.querySelector('.ide-ai-welcome-msg')?.remove();

  _addIdeMsgEl('user', text);
  IDE.aiMessages.push({ role: 'user', content: text });
  IDE.ideBusy = true; IDE.abortIde = false;
  document.getElementById('ide-ai-send').style.display = 'none';
  document.getElementById('ide-ai-stop').style.display = '';

  const ctxStr = getIdeContext();
  const sysPrompt = `You are an expert full-stack coding assistant built into NeuralDock IDE.

You have DIRECT access to the project's files and can create, modify, delete, and rename them.

## File Operation Tags

Use these in your response to perform file operations. Users see action cards and can apply them.

Create a new file:
<nd_file_op action="create" file="filename.ext">
COMPLETE file content here (never partial — always the full file)
</nd_file_op>

Modify an existing file (provide COMPLETE new content):
<nd_file_op action="modify" file="filename.ext">
COMPLETE new file content
</nd_file_op>

Delete a file:
<nd_file_op action="delete" file="filename.ext" />

Rename a file:
<nd_file_op action="rename" file="old.ext" to="new.ext" />

## Rules
- ALWAYS provide complete file content in create/modify tags — never snippets
- You can emit multiple file operation tags in one response
- Explain your changes clearly before or after the tags
- For cross-file refactors, emit ALL affected files
- For TypeScript migration: first rename with action="rename", then modify with new content
- For new projects, scaffold ALL necessary files in one response
- Use markdown code fences for examples and explanations`;

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
    } else if (resp?.message?.content) {
      full = resp.message.content;
      bodyEl.innerHTML = renderMarkdown(stripFileOps(full));
    } else if (typeof resp === 'string') {
      full = resp;
      bodyEl.innerHTML = renderMarkdown(stripFileOps(full));
    }

    bodyEl.classList.remove('streaming-cursor');
    bodyEl.querySelectorAll('pre code').forEach(b => { try { hljs.highlightElement(b); } catch(_) {} });

    const ops = parseFileOps(full);
    if (ops.length) {
      _renderFileOpCards(ops, msgsEl);
    } else {
      // Fallback apply buttons on code blocks
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
            IDE.files[IDE.activeFile].saved   = false;
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

// ── BUTTON WIRING ─────────────────────────────────────────────────────────
document.getElementById('ide-new-btn')?.addEventListener('click',        () => ideNewFile());
document.getElementById('ide-upload-btn')?.addEventListener('click',      ideUploadFile);
document.getElementById('ide-zip-btn')?.addEventListener('click',         ideDownloadZip);
document.getElementById('ide-tree-new-btn')?.addEventListener('click',    () => ideNewFile());
document.getElementById('ide-tree-upload-btn')?.addEventListener('click',  ideUploadFile);
document.getElementById('ide-save-btn')?.addEventListener('click',         ideSaveFile);
document.getElementById('ide-dl-btn')?.addEventListener('click',           ideDownloadFile);
document.getElementById('ide-run-btn')?.addEventListener('click',          ideRunCode);
document.getElementById('ide-terminal-btn')?.addEventListener('click',     toggleTerminal);
document.getElementById('ide-project-btn')?.addEventListener('click',      ideOpenProjectSwitcher);
document.getElementById('ide-terminal-close')?.addEventListener('click',  () => {
  IDE.termOpen = false;
  const p = document.getElementById('ide-terminal-panel');
  if (p) p.style.display = 'none';
  requestAnimationFrame(() => { if (IDE.cm) IDE.cm.refresh(); });
});

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
document.getElementById('ide-ai-toggle')?.addEventListener('click', () => {
  document.getElementById('ide-ai-panel').classList.toggle('hidden');
});
document.getElementById('ide-project-name')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); }
});
document.getElementById('ide-project-name')?.addEventListener('blur', function() {
  const n = this.textContent.trim() || 'my-project';
  if (n !== IDE.projectName) { IDE.projectName = n; this.textContent = n; }
});

// ── TAB ACTIVATION (called from ui.js) ───────────────────────────────────
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
  if (!IDE._historyLoaded) {
    IDE._historyLoaded = true;
    const loaded = await pkLoadHistory();
    _refreshAiPanel(loaded);
  }
}
