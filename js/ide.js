/**
 * ide.js  v4  — NeuralDock Project IDE
 *
 * WHAT'S NEW / FIXED
 * ──────────────────
 * • Toolbar overflow fixed: split into TWO rows
 *     Row 1  (topbar)     – tab list + panel toggles right-aligned
 *     Row 2  (actionbar)  – icon-only compact action buttons
 *   Opening/closing panels never hides action buttons anymore.
 *
 * • VS Code-style recursive file tree
 *     – Files with paths like "src/index.js" render as folders
 *     – Folders expand/collapse with ▾/▸ chevrons
 *     – State persisted in IDE.expandedFolders (Set)
 *     – Colored SVG badge icons per file extension
 *
 * • Project menu moved into explorer (⋮ button on project row)
 *     Options: New File, New Folder, Download ZIP, Rename, Delete, Switch
 *
 * • ZIP removed from actionbar (now in project ⋮ menu)
 *
 * • Right-click context menu on every file/folder
 *
 * • Folder operations: create, rename, delete (deletes all children)
 *
 * • Tab × = close view only, file stays (fixed from v3)
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
  openTabs:       [],        // uuid[] open in tab bar
  activeFile:     null,
  expandedFolders:new Set(), // set of folder paths e.g. 'src', 'src/utils'
  cm:             null,
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
//  FILE ICON SYSTEM  (SVG badge per extension)
// ══════════════════════════════════════════════════════════
function _badge(bg, label, fg) {
  fg = fg || '#fff';
  const len = label.length;
  const fs  = len > 3 ? 4.2 : len === 3 ? 5.5 : 7;
  const y   = len > 3 ? 9.5 : 10.5;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="14" height="14" style="flex-shrink:0;display:block">` +
    `<rect width="16" height="16" rx="2.5" fill="${bg}"/>` +
    `<text x="8" y="${y}" text-anchor="middle" font-family="'DM Mono',monospace,sans-serif" ` +
    `font-size="${fs}" font-weight="800" fill="${fg}" letter-spacing="-0.2">${label}</text>` +
    `</svg>`;
}

function _folderSvg(open) {
  const fill = open ? '#d4a853' : '#a07835';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="14" height="14" style="flex-shrink:0;display:block">` +
    `<path d="M1 4.5C1 3.67 1.67 3 2.5 3h3.76l1.5 1.5H13.5C14.33 4.5 15 5.17 15 6v7c0 .83-.67 1.5-1.5 1.5h-11C1.67 14.5 1 13.83 1 13V4.5z" fill="${fill}"/>` +
    `</svg>`;
}

function _fileDefault() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="14" height="14" style="flex-shrink:0;display:block">` +
    `<path d="M4 1h5l4 4v10H4V1z" fill="#5a5d62"/>` +
    `<path d="M9 1l4 4H9V1z" fill="#3d3f43"/>` +
    `</svg>`;
}

function getFileIconHtml(name) {
  const lower  = name.toLowerCase();
  const dotIdx = lower.lastIndexOf('.');
  const ext    = dotIdx >= 0 ? lower.slice(dotIdx + 1) : '';
  const base   = dotIdx >= 0 ? lower.slice(0, dotIdx) : lower;

  // Special filenames
  if (lower === '.gitignore' || lower === '.gitattributes' || lower === '.gitkeep') return _badge('#f54d27','GIT');
  if (lower.startsWith('.env'))       return _badge('#d4a853','ENV','#0c0e0f');
  if (lower === 'dockerfile' || lower === 'docker-compose.yml' || lower === 'docker-compose.yaml')
                                      return _badge('#2496ed','DOC');
  if (lower === 'package.json' || lower === 'package-lock.json') return _badge('#cb3837','NPM');
  if (lower === 'makefile')           return _badge('#427819','MAKE');
  if (lower === 'readme.md' || lower === 'readme') return _badge('#083fa1','MD');

  const MAP = {
    // Web
    js:    () => _badge('#f7df1e','JS','#000'),
    mjs:   () => _badge('#f7df1e','JS','#000'),
    cjs:   () => _badge('#f7df1e','JS','#000'),
    ts:    () => _badge('#3178c6','TS'),
    jsx:   () => _badge('#61dafb','JSX','#000'),
    tsx:   () => _badge('#61dafb','TSX','#000'),
    html:  () => _badge('#e34f26','HTML'),
    htm:   () => _badge('#e34f26','HTM'),
    css:   () => _badge('#264de4','CSS'),
    scss:  () => _badge('#cc6699','SCSS'),
    sass:  () => _badge('#cc6699','SASS'),
    less:  () => _badge('#1d365d','LESS'),
    // Languages
    py:    () => _badge('#3776ab','PY','#ffde57'),
    pyw:   () => _badge('#3776ab','PY','#ffde57'),
    rb:    () => _badge('#cc342d','RB'),
    php:   () => _badge('#777bb4','PHP'),
    go:    () => _badge('#00add8','GO'),
    rs:    () => _badge('#ce412b','RS'),
    c:     () => _badge('#555799','C'),
    h:     () => _badge('#555799','H'),
    cpp:   () => _badge('#f34b7d','C++'),
    cc:    () => _badge('#f34b7d','C++'),
    cxx:   () => _badge('#f34b7d','C++'),
    hpp:   () => _badge('#f34b7d','HPP'),
    cs:    () => _badge('#9b4f96','C#'),
    java:  () => _badge('#ed8b00','JAVA'),
    kt:    () => _badge('#7f52ff','KT'),
    swift: () => _badge('#f05138','SWIFT'),
    r:     () => _badge('#276dc3','R'),
    lua:   () => _badge('#000080','LUA'),
    dart:  () => _badge('#00b4ab','DART'),
    // Shell
    sh:    () => _badge('#4eaa25','SH'),
    bash:  () => _badge('#4eaa25','BASH'),
    zsh:   () => _badge('#4eaa25','ZSH'),
    fish:  () => _badge('#4eaa25','FISH'),
    ps1:   () => _badge('#012456','PS'),
    bat:   () => _badge('#c1c1c1','BAT','#000'),
    // Data
    json:  () => _badge('#2d9a5f','JSON'),
    json5: () => _badge('#2d9a5f','JSON5'),
    yaml:  () => _badge('#cb171e','YAML'),
    yml:   () => _badge('#cb171e','YML'),
    toml:  () => _badge('#9c4221','TOML'),
    xml:   () => _badge('#f16529','XML'),
    csv:   () => _badge('#21a150','CSV'),
    sql:   () => _badge('#e38c00','SQL'),
    // Docs
    md:    () => _badge('#083fa1','MD'),
    mdx:   () => _badge('#083fa1','MDX'),
    txt:   () => _badge('#6b6560','TXT'),
    pdf:   () => _badge('#e12e1c','PDF'),
    rst:   () => _badge('#083fa1','RST'),
    // Config
    ini:   () => _badge('#6b6560','INI'),
    cfg:   () => _badge('#6b6560','CFG'),
    conf:  () => _badge('#6b6560','CONF'),
    lock:  () => _badge('#6b6560','LOCK'),
    // Images
    svg:   () => _badge('#ffb13b','SVG','#000'),
    png:   () => _badge('#a855f7','PNG'),
    jpg:   () => _badge('#a855f7','JPG'),
    jpeg:  () => _badge('#a855f7','JPEG'),
    gif:   () => _badge('#a855f7','GIF'),
    webp:  () => _badge('#a855f7','WEBP'),
    ico:   () => _badge('#a855f7','ICO'),
    // Misc
    wasm:  () => _badge('#654ff0','WASM'),
    graphql:()=> _badge('#e10098','GQL'),
    vue:   () => _badge('#42b883','VUE'),
    svelte:()=> _badge('#ff3e00','SVELTE'),
  };

  const fn = MAP[ext];
  return fn ? fn() : _fileDefault();
}

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
          value="${escHtml(input.default||'')}" placeholder="${escHtml(input.placeholder||'')}" autocomplete="off">` : ''}
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
    ok.addEventListener('click', () => done(input ? (inp?.value?.trim()||null) : true));
    no.addEventListener('click', () => done(null));
    ov.addEventListener('click', e => { if (e.target===ov) done(null); });
  });
}

// ══════════════════════════════════════════════════════════
//  CONTEXT MENU ENGINE
// ══════════════════════════════════════════════════════════
function showContextMenu(x, y, items) {
  document.querySelector('.ide-ctx-menu')?.remove();
  const menu = document.createElement('div');
  menu.className = 'ide-ctx-menu';
  for (const item of items) {
    if (item === null) {
      const sep = document.createElement('div');
      sep.className = 'ide-ctx-sep';
      menu.appendChild(sep);
      continue;
    }
    const btn = document.createElement('button');
    btn.className = 'ide-ctx-item' + (item.danger ? ' ide-ctx-danger' : '');
    btn.innerHTML = `<span class="ide-ctx-ico">${item.icon||''}</span>${escHtml(item.label)}`;
    btn.addEventListener('click', e => { e.stopPropagation(); menu.remove(); item.action(); });
    menu.appendChild(btn);
  }

  document.body.appendChild(menu);
  const mw = menu.offsetWidth, mh = menu.offsetHeight;
  const vw = window.innerWidth,  vh = window.innerHeight;
  menu.style.left = (x + mw > vw ? x - mw : x) + 'px';
  menu.style.top  = (y + mh > vh ? y - mh : y) + 'px';

  const close = e => { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('mousedown', close); } };
  setTimeout(() => document.addEventListener('mousedown', close), 0);
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
  try { await puter.fs.write(`${PUTER_DIR}/${IDE.projectName}/${fileName}`, content, { createMissingParents:true, overwrite:true }); }
  catch(e) { console.warn('[pfs] save:', e.message); }
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
    await puter.fs.mkdir(PUTER_DIR, { parents:true }).catch(()=>{});
    const items = await puter.fs.readdir(PUTER_DIR);
    return items.filter(i => i.is_dir).map(i => i.name);
  } catch(e) { return []; }
}

// ── Puter KV: AI history ──────────────────────────────────
async function pkSaveHistory() {
  if (!puterReady() || !IDE.aiMessages.length) return;
  try { await puter.kv.set(`ide-history-${IDE.projectName}`, JSON.stringify(IDE.aiMessages.slice(-80))); }
  catch(e) { console.warn('[pkv]', e.message); }
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
    IDE.cm.setOption('mode', lang||'null');
    IDE.cm.setOption('lineWrapping', IDE.wordWrap);
    requestAnimationFrame(()=>requestAnimationFrame(()=>{ IDE.cm.refresh(); IDE.cm.focus(); }));
    return;
  }
  container.style.display = '';
  IDE.cm = CodeMirror(container, {
    value: content, mode: lang||'null', theme: 'aistudio',
    lineNumbers: true, autoCloseBrackets: true, matchBrackets: true,
    lineWrapping: IDE.wordWrap, indentUnit: 2, tabSize: 2, indentWithTabs: false,
    extraKeys: {
      'Ctrl-S': ()=>ideSaveFile(), 'Cmd-S': ()=>ideSaveFile(),
      'Ctrl-/': 'toggleComment',   'Cmd-/': 'toggleComment',
      'Ctrl-G': ()=>ideGoToLine(), 'Cmd-G': ()=>ideGoToLine(),
      'Tab': cm=>cm.execCommand('insertSoftTab'),
      'Shift-Tab': cm=>cm.execCommand('indentLess'),
    },
  });
  requestAnimationFrame(()=>requestAnimationFrame(()=>{ IDE.cm.refresh(); IDE.cm.focus(); }));
  IDE.cm.on('change', ()=>{
    if (IDE.activeFile && IDE.files[IDE.activeFile]) {
      IDE.files[IDE.activeFile].saved = false;
      renderFileTabs(); renderFileTree();
      scheduleAutoSave();
    }
  });
  IDE.cm.on('cursorActivity', updateStatusBar);
  updateWrapBtn();
}

let _autoSaveTimer = null;
function scheduleAutoSave() {
  clearTimeout(_autoSaveTimer);
  _autoSaveTimer = setTimeout(()=>{
    if (!IDE.activeFile || !IDE.files[IDE.activeFile] || !IDE.cm) return;
    const f = IDE.files[IDE.activeFile];
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
    bar.innerHTML = '<span class="ide-sb-item" style="color:var(--muted)">No file open</span>';
    return;
  }
  const f = IDE.files[IDE.activeFile];
  let ln = 1, col = 1;
  if (IDE.cm) { const c = IDE.cm.getCursor(); ln = c.line+1; col = c.ch+1; }
  const content = IDE.cm ? IDE.cm.getValue() : (f.content||'');
  const bytes   = new TextEncoder().encode(content).length;
  const size    = bytes < 1024 ? `${bytes}B` : `${(bytes/1024).toFixed(1)}KB`;
  const lines   = content.split('\n').length;
  const lang    = (f.language||'text').replace('htmlmixed','HTML').replace('javascript','JS').replace('python','PY').toUpperCase();
  const saved   = f.saved ? `<span class="ide-sb-saved">●</span>` : `<span class="ide-sb-unsaved">●</span>`;
  bar.innerHTML =
    `${saved}<span class="ide-sb-item ide-sb-name">${escHtml(f.name.split('/').pop())}</span>` +
    `<span class="ide-sb-sep">│</span><span class="ide-sb-item">Ln ${ln}, Col ${col}</span>` +
    `<span class="ide-sb-sep">│</span><span class="ide-sb-item">${lines} lines</span>` +
    `<span class="ide-sb-sep">│</span><span class="ide-sb-item">${size}</span>` +
    `<span class="ide-sb-sep">│</span><span class="ide-sb-item ide-sb-lang" id="ide-sb-lang" title="Click to change language">${lang}</span>` +
    `<span class="ide-sb-sep">│</span><span class="ide-sb-item">${IDE.wordWrap?'↵ Wrap':'→ No Wrap'}</span>`;
  document.getElementById('ide-sb-lang')?.addEventListener('click', ideChangeLang);
}

function ideChangeLang() {
  if (!IDE.cm || !IDE.activeFile) return;
  const langs = [['javascript','JS / JSX'],['python','Python'],['htmlmixed','HTML'],['css','CSS / SCSS'],['null','Plain Text'],['clike','C / C++ / Java'],['markdown','Markdown'],['shell','Shell / Bash']];
  showContextMenu(
    document.getElementById('ide-statusbar').getBoundingClientRect().right - 120,
    document.getElementById('ide-statusbar').getBoundingClientRect().top - langs.length * 32,
    langs.map(([v,l]) => ({
      label: l,
      action: () => {
        IDE.cm.setOption('mode', v);
        if (IDE.activeFile && IDE.files[IDE.activeFile]) IDE.files[IDE.activeFile].language = v;
        updateStatusBar();
      }
    }))
  );
}

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
  btn.title = `Word Wrap: ${IDE.wordWrap ? 'ON' : 'OFF'} (click to toggle)`;
  btn.classList.toggle('ide-ab-active', IDE.wordWrap);
}

// ══════════════════════════════════════════════════════════
//  TREE BUILDER  (parses file paths → nested structure)
// ══════════════════════════════════════════════════════════
function _buildTree(files) {
  const root = { type: 'root', children: {} };

  for (const [id, f] of Object.entries(files)) {
    const parts = f.name.split('/');
    let node = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const dir = parts[i];
      if (!node.children[dir]) {
        node.children[dir] = {
          type: 'folder',
          name: dir,
          path: parts.slice(0, i+1).join('/'),
          children: {},
        };
      }
      node = node.children[dir];
    }
    const fname = parts[parts.length - 1];
    node.children[`__file__${id}`] = { type: 'file', name: fname, id, file: f };
  }
  return root;
}

function renderFileTree() {
  const list  = document.getElementById('ide-file-list');
  const empty = document.getElementById('ide-empty-tree');
  if (!list) return;
  list.innerHTML = '';

  if (!Object.keys(IDE.files).length) {
    if (empty) empty.style.display = '';
    return;
  }
  if (empty) empty.style.display = 'none';

  const tree = _buildTree(IDE.files);
  _renderNode(tree.children, list, 0);
}

function _renderNode(children, container, depth) {
  // Sort: folders first, then files, both alpha
  const entries = Object.entries(children).sort(([ka, a], [kb, b]) => {
    if (a.type === b.type) return a.name.localeCompare(b.name);
    return a.type === 'folder' ? -1 : 1;
  });

  for (const [key, node] of entries) {
    if (node.type === 'folder') {
      _renderFolder(node, container, depth);
    } else {
      _renderFile(node, container, depth);
    }
  }
}

function _renderFolder(node, container, depth) {
  const { name, path, children } = node;
  const isOpen = IDE.expandedFolders.has(path);
  const pl = 8 + depth * 14;

  const row = document.createElement('div');
  row.className = 'ide-tree-row ide-tree-folder';
  row.dataset.path = path;
  row.style.paddingLeft = pl + 'px';
  row.innerHTML =
    `<span class="ide-tree-chevron">${isOpen ? '▾' : '▸'}</span>` +
    `<span class="ide-tree-icon">${_folderSvg(isOpen)}</span>` +
    `<span class="ide-tree-name">${escHtml(name)}</span>` +
    `<div class="ide-tree-actions">` +
      `<button class="ide-tree-act" data-fol-new="${escHtml(path)}" title="New file here">+</button>` +
      `<button class="ide-tree-act" data-fol-ren="${escHtml(path)}" title="Rename folder">✎</button>` +
      `<button class="ide-tree-act ide-tree-del" data-fol-del="${escHtml(path)}" title="Delete folder">✕</button>` +
    `</div>`;

  row.addEventListener('click', e => {
    if (e.target.dataset.folNew) { e.stopPropagation(); ideNewFileInFolder(e.target.dataset.folNew); return; }
    if (e.target.dataset.folRen) { e.stopPropagation(); ideRenameFolder(e.target.dataset.folRen); return; }
    if (e.target.dataset.folDel) { e.stopPropagation(); ideDeleteFolder(e.target.dataset.folDel); return; }
    if (e.target.closest('.ide-tree-actions')) return;
    if (isOpen) IDE.expandedFolders.delete(path); else IDE.expandedFolders.add(path);
    renderFileTree();
  });
  row.addEventListener('contextmenu', e => {
    e.preventDefault();
    showContextMenu(e.clientX, e.clientY, [
      { icon:'➕', label:'New File Here',    action:()=>ideNewFileInFolder(path) },
      { icon:'📁', label:'New Subfolder',    action:()=>ideNewSubfolder(path)    },
      null,
      { icon:'✎',  label:'Rename Folder',   action:()=>ideRenameFolder(path)    },
      null,
      { icon:'🗑',  label:'Delete Folder', danger:true, action:()=>ideDeleteFolder(path) },
    ]);
  });
  container.appendChild(row);

  if (isOpen) _renderNode(children, container, depth + 1);
}

function _renderFile(node, container, depth) {
  const { id, name, file } = node;
  const pl = 8 + depth * 14 + 14; // extra 14 to align with folder label

  const row = document.createElement('div');
  row.className = 'ide-tree-row ide-tree-file' + (id === IDE.activeFile ? ' active' : '');
  row.dataset.id = id;
  row.style.paddingLeft = pl + 'px';
  row.innerHTML =
    `<span class="ide-tree-icon">${getFileIconHtml(name)}</span>` +
    `<span class="ide-tree-name">${escHtml(name)}</span>` +
    (!file.saved ? `<span class="ide-tree-dot" title="Unsaved">●</span>` : '') +
    `<div class="ide-tree-actions">` +
      `<button class="ide-tree-act" data-act-ren="${id}" title="Rename">✎</button>` +
      `<button class="ide-tree-act ide-tree-del" data-act-del="${id}" title="Delete">✕</button>` +
    `</div>`;

  row.addEventListener('click', e => {
    if (e.target.dataset.actRen) { e.stopPropagation(); ideRenameFile(e.target.dataset.actRen); return; }
    if (e.target.dataset.actDel) { e.stopPropagation(); ideDeleteFile(e.target.dataset.actDel, e); return; }
    if (e.target.closest('.ide-tree-actions')) return;
    _openFile(id);
  });
  row.addEventListener('contextmenu', e => {
    e.preventDefault();
    showContextMenu(e.clientX, e.clientY, [
      { icon:'📂', label:'Open',           action:()=>_openFile(id) },
      null,
      { icon:'✎',  label:'Rename',        action:()=>ideRenameFile(id) },
      { icon:'📋', label:'Duplicate',     action:()=>ideduplicateFile(id) },
      null,
      { icon:'🗑',  label:'Delete', danger:true, action:()=>ideDeleteFile(id) },
    ]);
  });
  container.appendChild(row);
}

// ══════════════════════════════════════════════════════════
//  FILE TABS
// ══════════════════════════════════════════════════════════
function renderFileTabs() {
  const list = document.getElementById('ide-tabs-list');
  if (!list) return;
  list.innerHTML = '';
  IDE.openTabs.filter(id => IDE.files[id]).forEach(id => {
    const f   = IDE.files[id];
    const tab = document.createElement('button');
    tab.className = 'ide-tab' + (id === IDE.activeFile ? ' active' : '');
    tab.title     = f.name;
    tab.innerHTML =
      `<span class="ide-tab-icon">${getFileIconHtml(f.name.split('/').pop())}</span>` +
      `<span class="ide-tab-name">${escHtml(f.name.split('/').pop())}</span>` +
      (!f.saved ? `<span class="ide-tab-dot">●</span>` : '') +
      `<span class="ide-tab-close" data-id="${id}" title="Close tab">×</span>`;
    tab.addEventListener('click', e => {
      const cl = e.target.closest('.ide-tab-close');
      if (cl) { e.stopPropagation(); _closeTab(cl.dataset.id); }
      else _openFile(id);
    });
    list.appendChild(tab);
  });
}

/** Close tab only — does NOT delete the file */
function _closeTab(id) {
  if (!IDE.files[id]) return;
  if (IDE.activeFile === id && IDE.cm) {
    IDE.files[id].content = IDE.cm.getValue();
    IDE.files[id].saved   = true;
    pfsSave(IDE.files[id].name, IDE.files[id].content);
  }
  IDE.openTabs = IDE.openTabs.filter(t => t !== id);
  if (IDE.activeFile === id) {
    IDE.openTabs.length ? _openFile(IDE.openTabs[IDE.openTabs.length-1]) : showWelcome();
  } else { renderFileTabs(); }
}

// ══════════════════════════════════════════════════════════
//  FILE / FOLDER OPERATIONS
// ══════════════════════════════════════════════════════════
async function ideNewFile(suggestedName, folder) {
  const def  = folder ? `${folder}/index.js` : 'index.html';
  const name = suggestedName || await ideModal({
    title: 'New File', message: 'Enter filename (use / for subfolders, e.g. src/app.js):',
    input: { default: def, placeholder: 'filename.ext or folder/filename.ext' },
    confirmLabel: 'Create',
  });
  if (!name?.trim()) return;
  const id = crypto.randomUUID();
  IDE.files[id] = { id, name: name.trim(), content: '', language: getLang(name), saved: true };
  // Auto-expand parent folder
  const parts = name.trim().split('/');
  for (let i = 1; i < parts.length; i++) IDE.expandedFolders.add(parts.slice(0, i).join('/'));
  if (!IDE.openTabs.includes(id)) IDE.openTabs.push(id);
  await pfsSave(name.trim(), '');
  renderFileTree(); _openFile(id);
  toast('Created ' + name.trim());
}

async function ideNewFileInFolder(folderPath) {
  const name = await ideModal({
    title: 'New File', message: `Create file in ${folderPath}/`,
    input: { default: '', placeholder: 'filename.js' }, confirmLabel: 'Create',
  });
  if (!name?.trim()) return;
  const fullName = `${folderPath}/${name.trim()}`;
  const id = crypto.randomUUID();
  IDE.files[id] = { id, name: fullName, content: '', language: getLang(name), saved: true };
  IDE.expandedFolders.add(folderPath);
  if (!IDE.openTabs.includes(id)) IDE.openTabs.push(id);
  await pfsSave(fullName, '');
  renderFileTree(); _openFile(id);
  toast('Created ' + fullName);
}

async function ideNewSubfolder(parentPath) {
  const name = await ideModal({
    title: 'New Folder', message: `Create folder inside ${parentPath}/`,
    input: { default: '', placeholder: 'folder-name' }, confirmLabel: 'Create',
  });
  if (!name?.trim()) return;
  const fullPath = `${parentPath}/${name.trim()}`;
  // Create a .gitkeep to materialize the folder
  const keepName = `${fullPath}/.gitkeep`;
  const id = crypto.randomUUID();
  IDE.files[id] = { id, name: keepName, content: '', language: 'null', saved: true };
  IDE.expandedFolders.add(parentPath);
  IDE.expandedFolders.add(fullPath);
  await pfsSave(keepName, '');
  renderFileTree();
  toast('Created folder: ' + fullPath);
}

async function ideNewTopFolder() {
  const name = await ideModal({
    title: 'New Folder', message: 'Enter folder name:',
    input: { default: 'src', placeholder: 'folder-name' }, confirmLabel: 'Create',
  });
  if (!name?.trim()) return;
  const keepName = `${name.trim()}/.gitkeep`;
  const id = crypto.randomUUID();
  IDE.files[id] = { id, name: keepName, content: '', language: 'null', saved: true };
  IDE.expandedFolders.add(name.trim());
  await pfsSave(keepName, '');
  renderFileTree();
  toast('Created folder: ' + name.trim());
}

async function ideRenameFolder(oldPath) {
  const newName = await ideModal({
    title: 'Rename Folder', message: `Rename "${oldPath.split('/').pop()}":`,
    input: { default: oldPath.split('/').pop(), placeholder: 'new-name' }, confirmLabel: 'Rename',
  });
  if (!newName?.trim()) return;
  const parentPath = oldPath.includes('/') ? oldPath.slice(0, oldPath.lastIndexOf('/') + 1) : '';
  const newPath    = parentPath + newName.trim();

  for (const [id, f] of Object.entries(IDE.files)) {
    if (f.name.startsWith(oldPath + '/') || f.name === oldPath) {
      const newFilePath = newPath + f.name.slice(oldPath.length);
      await pfsRename(f.name, newFilePath);
      f.name = newFilePath;
      f.language = getLang(newFilePath.split('/').pop());
    }
  }
  if (IDE.expandedFolders.has(oldPath)) {
    IDE.expandedFolders.delete(oldPath);
    IDE.expandedFolders.add(newPath);
  }
  renderFileTree(); renderFileTabs();
  toast(`Renamed → ${newPath}`);
}

async function ideDeleteFolder(folderPath) {
  const affected = Object.values(IDE.files).filter(f => f.name.startsWith(folderPath + '/'));
  const ok = await ideModal({
    title: 'Delete Folder',
    message: `Delete "${folderPath}" and its ${affected.length} file(s)? Cannot be undone.`,
    confirmLabel: 'Delete All', cancelLabel: 'Cancel',
  });
  if (!ok) return;
  for (const f of affected) {
    await pfsDelete(f.name);
    IDE.openTabs = IDE.openTabs.filter(t => t !== f.id);
    if (IDE.activeFile === f.id) { IDE.activeFile = null; }
    delete IDE.files[f.id];
  }
  IDE.expandedFolders.delete(folderPath);
  renderFileTree(); renderFileTabs();
  if (!IDE.activeFile) { IDE.openTabs.length ? _openFile(IDE.openTabs[IDE.openTabs.length-1]) : showWelcome(); }
  toast(`Deleted folder: ${folderPath}`);
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
      IDE.files[id] = { id, name: f.name, content: content||'', language: getLang(f.name), saved: true };
      await pfsSave(f.name, content||'');
      newIds.push(id);
    } catch(err) { toast(`Failed to read ${f.name}`, 'error'); }
  }
  if (!newIds.length) return;
  newIds.forEach(id => { if (!IDE.openTabs.includes(id)) IDE.openTabs.push(id); });
  renderFileTree();
  _openFile(newIds[newIds.length-1]);
  toast(`Uploaded ${newIds.length} file(s)`);
});

async function ideDeleteFile(id, e) {
  if (e) { e.stopPropagation(); e.preventDefault(); }
  const f = IDE.files[id];
  if (!f) return;
  const ok = await ideModal({
    title:'Delete File', message:`Permanently delete "${f.name}"?`,
    confirmLabel:'Delete', cancelLabel:'Cancel',
  });
  if (!ok) return;
  await pfsDelete(f.name);
  IDE.openTabs = IDE.openTabs.filter(t => t !== id);
  delete IDE.files[id];
  if (IDE.activeFile === id) {
    IDE.openTabs.length ? _openFile(IDE.openTabs[IDE.openTabs.length-1]) : showWelcome();
  } else { renderFileTabs(); renderFileTree(); }
  toast('Deleted ' + f.name);
}

async function ideRenameFile(id) {
  const f = IDE.files[id];
  if (!f) return;
  const parts = f.name.split('/');
  const dir   = parts.slice(0, -1).join('/');
  const newBaseName = await ideModal({
    title:'Rename File', message:'New filename:',
    input:{ default: parts[parts.length-1], placeholder: parts[parts.length-1] },
    confirmLabel:'Rename',
  });
  if (!newBaseName?.trim() || newBaseName.trim() === parts[parts.length-1]) return;
  const newFullName = dir ? `${dir}/${newBaseName.trim()}` : newBaseName.trim();
  await pfsRename(f.name, newFullName);
  f.name     = newFullName;
  f.language = getLang(newBaseName.trim());
  if (IDE.cm && IDE.activeFile === id) IDE.cm.setOption('mode', f.language);
  renderFileTree(); renderFileTabs();
  toast(`Renamed → ${newFullName}`);
}

async function ideduplicateFile(id) {
  const f = IDE.files[id];
  if (!f) return;
  const parts   = f.name.split('.');
  const ext     = parts.pop();
  const newName = `${parts.join('.')}-copy.${ext}`;
  const newId   = crypto.randomUUID();
  const content = IDE.cm && IDE.activeFile === id ? IDE.cm.getValue() : f.content;
  IDE.files[newId] = { id: newId, name: newName, content, language: f.language, saved: false };
  if (!IDE.openTabs.includes(newId)) IDE.openTabs.push(newId);
  await pfsSave(newName, content);
  renderFileTree(); renderFileTabs();
  toast('Duplicated → ' + newName);
}

function ideSaveFile() {
  if (!IDE.activeFile) return;
  const f = IDE.files[IDE.activeFile];
  if (!f) return;
  if (IDE.cm) f.content = IDE.cm.getValue();
  f.saved = true;
  pfsSave(f.name, f.content);
  renderFileTabs(); renderFileTree(); updateStatusBar();
  toast('Saved ' + f.name.split('/').pop());
}

function ideDownloadFile() {
  if (!IDE.activeFile) { toast('No file open', 'error'); return; }
  ideSaveFile();
  const f = IDE.files[IDE.activeFile];
  const a = document.createElement('a');
  a.href     = URL.createObjectURL(new Blob([f.content], { type:'text/plain' }));
  a.download = f.name.split('/').pop();
  a.click(); URL.revokeObjectURL(a.href);
  toast('Downloaded');
}

async function ideDownloadZip() {
  if (!Object.keys(IDE.files).length) { toast('No files', 'error'); return; }
  ideSaveFile();
  if (!window.JSZip) { toast('JSZip not loaded', 'error'); return; }
  const zip     = new JSZip();
  const project = IDE.projectName;
  for (const f of Object.values(IDE.files)) zip.file(f.name, f.content||'');
  const blob = await zip.generateAsync({ type:'blob' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = project+'.zip'; a.click(); URL.revokeObjectURL(a.href);
  toast(`Downloaded ${project}.zip`);
}

function _openFile(id) {
  if (IDE.cm && IDE.activeFile && IDE.files[IDE.activeFile]) {
    IDE.files[IDE.activeFile].content = IDE.cm.getValue();
  }
  IDE.activeFile = id;
  const f = IDE.files[id];
  if (!f) return;
  if (!IDE.openTabs.includes(id)) IDE.openTabs.push(id);
  renderFileTree(); renderFileTabs();
  document.getElementById('ide-welcome').style.display = 'none';
  document.getElementById('ide-monaco').style.display  = '';
  const panel = document.getElementById('panel-code');
  if (panel?.classList.contains('active')) initCM(f.content, f.language);
  updateStatusBar();
}
function openFile(id) { _openFile(id); }

function showWelcome() {
  if (IDE.cm && IDE.activeFile && IDE.files[IDE.activeFile]) IDE.files[IDE.activeFile].content = IDE.cm.getValue();
  document.getElementById('ide-monaco').style.display  = 'none';
  document.getElementById('ide-welcome').style.display = '';
  IDE.activeFile = null;
  renderFileTabs(); renderFileTree(); updateStatusBar();
}

// ══════════════════════════════════════════════════════════
//  PROJECT MENU  (⋮ in explorer panel)
// ══════════════════════════════════════════════════════════
function showProjectMenu(btn) {
  const r = btn.getBoundingClientRect();
  showContextMenu(r.right, r.bottom + 4, [
    { icon:'➕', label:'New File',       action:()=>ideNewFile()      },
    { icon:'📁', label:'New Folder',     action:()=>ideNewTopFolder() },
    { icon:'↑',  label:'Upload File',    action:()=>ideUploadFile()   },
    null,
    { icon:'⬇',  label:'Download ZIP',   action:()=>ideDownloadZip()  },
    null,
    { icon:'⇄',  label:'Switch Project', action:()=>ideOpenProjectSwitcher() },
    null,
    { icon:'✎',  label:'Rename Project', action:()=>ideRenameProject()       },
    { icon:'🗑',  label:'Delete Project', danger:true, action:()=>ideDeleteProject() },
  ]);
}

async function ideRenameProject() {
  const name = await ideModal({
    title:'Rename Project', message:'New project name:',
    input:{ default: IDE.projectName, placeholder: IDE.projectName }, confirmLabel:'Rename',
  });
  if (!name?.trim() || name.trim() === IDE.projectName) return;
  IDE.projectName = name.trim();
  document.getElementById('ide-project-name').textContent = name.trim();
  toast('Project renamed to: ' + name.trim());
}

async function ideDeleteProject() {
  const ok = await ideModal({
    title:'Delete Project', message:`Delete project "${IDE.projectName}" and all its files from Puter cloud? This cannot be undone.`,
    confirmLabel:'Delete Everything', cancelLabel:'Cancel',
  });
  if (!ok) return;
  for (const f of Object.values(IDE.files)) await pfsDelete(f.name);
  IDE.files = {}; IDE.openTabs = []; IDE.activeFile = null;
  renderFileTree(); renderFileTabs(); showWelcome();
  toast('Project deleted');
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
    const name = await ideModal({ title:'New Project', message:'Project name:', input:{ default:'my-app', placeholder:'my-app' }, confirmLabel:'Create' });
    if (name?.trim()) await _loadProject(name.trim());
  } else { await _loadProject(chosen); }
}

function _showListPicker(title, options) {
  return new Promise(resolve => {
    document.getElementById('ide-modal-overlay')?.remove();
    const ov = document.createElement('div');
    ov.id = 'ide-modal-overlay'; ov.className = 'ide-modal-overlay';
    ov.innerHTML = `<div class="ide-modal">
      <div class="ide-modal-title">${escHtml(title)}</div>
      <div class="ide-proj-list">${options.map((p,i)=>`<button class="ide-proj-item" data-i="${i}">${escHtml(p)}</button>`).join('')}</div>
      <div class="ide-modal-btns"><button class="ide-modal-btn cancel" id="ide-modal-cancel">Cancel</button></div>
    </div>`;
    document.body.appendChild(ov);
    ov.querySelectorAll('.ide-proj-item').forEach(btn => btn.addEventListener('click',()=>{ ov.remove(); resolve(options[+btn.dataset.i]); }));
    document.getElementById('ide-modal-cancel').addEventListener('click',()=>{ ov.remove(); resolve(null); });
    ov.addEventListener('click', e=>{ if(e.target===ov){ ov.remove(); resolve(null); } });
  });
}

async function _loadProject(name) {
  if (IDE.cm && IDE.activeFile && IDE.files[IDE.activeFile]) IDE.files[IDE.activeFile].content = IDE.cm.getValue();
  IDE.projectName = name;
  document.getElementById('ide-project-name').textContent = name;
  const loaded = await pfsLoadProject(name);
  IDE.files = loaded||{}; IDE.openTabs = Object.keys(IDE.files).slice(0,5);
  IDE.activeFile = null; IDE._historyLoaded = false; IDE.aiMessages = [];
  IDE.expandedFolders = new Set();
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
    const ok = await ideModal({ title:'Load Template', message:`Add ${tpl} template to current project?`, confirmLabel:'Load', cancelLabel:'Cancel' });
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
  renderFileTree(); _openFile(newIds[0]);
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
  const code   = f.content||'';
  const outDiv = document.getElementById('ide-output');
  const outPre = document.getElementById('ide-output-pre');
  const frame  = document.getElementById('ide-html-frame');
  outDiv.style.display = '';

  if (['html','htm'].includes(ext)) {
    showOutTab('preview');
    outPre.style.display='none'; frame.style.display=''; frame.srcdoc=code;
  } else if (['js','mjs'].includes(ext)) {
    showOutTab('console');
    outPre.style.display=''; frame.style.display='none'; outPre.textContent='';
    const log = (...a)=>{ outPre.textContent += a.map(x=>typeof x==='object'?JSON.stringify(x,null,2):String(x)).join(' ')+'\n'; };
    try {
      const sb = document.createElement('iframe');
      sb.style.display='none'; document.body.appendChild(sb);
      sb.contentWindow.console = { log, warn:log, error:log, info:log, debug:log };
      sb.contentWindow.eval(code); sb.remove();
      if (!outPre.textContent.trim()) outPre.textContent='(no console output)';
    } catch(err) { outPre.textContent='⚠ Error: '+err.message; }
    _addAskAiBtn(outPre.textContent);
  } else {
    showOutTab('console');
    outPre.style.display=''; frame.style.display='none';
    const hints = { py:'python '+f.name.split('/').pop(), ts:'npx ts-node '+f.name.split('/').pop(), tsx:'npm run dev', jsx:'npm run dev', rs:'cargo run', go:'go run '+f.name.split('/').pop(), rb:'ruby '+f.name.split('/').pop() };
    const cmd = hints[ext];
    outPre.textContent = cmd ? `Run in terminal:\n  ${cmd}\n\nOpen the Terminal panel above.` : `Cannot run .${ext} in-browser. Use the Terminal panel.`;
  }
}

function _addAskAiBtn(outputText) {
  const outHdr = document.querySelector('.ide-output-hdr > div');
  if (!outHdr) return;
  document.getElementById('ide-ask-ai-output-btn')?.remove();
  const btn = document.createElement('button');
  btn.id='ide-ask-ai-output-btn'; btn.className='ide-hdr-btn'; btn.title='Ask AI about this output'; btn.textContent='🤖 Ask AI';
  btn.addEventListener('click', ()=>{
    const inp = document.getElementById('ide-ai-input');
    inp.value = `Console output:\n\`\`\`\n${outputText.slice(0,1000)}\n\`\`\`\nExplain errors and suggest fixes.`;
    inp.style.height='auto'; inp.style.height=Math.min(inp.scrollHeight,120)+'px';
    document.getElementById('ide-ai-panel').classList.remove('hidden','ide-panel-hidden');
    ideAiSend();
  });
  outHdr.prepend(btn);
}

function showOutTab(tab) {
  IDE.outTab=tab;
  document.querySelectorAll('.ide-out-tab').forEach(t=>t.classList.toggle('active', t.dataset.out===tab));
  document.getElementById('ide-html-frame').style.display = tab==='preview'?'':'none';
  document.getElementById('ide-output-pre').style.display = tab!=='preview'?'':'none';
}

// ══════════════════════════════════════════════════════════
//  UTILITIES: FORMAT, WRAP, SEARCH, GOTO, FOLD, PREVIEW
// ══════════════════════════════════════════════════════════
let _prettierLoaded = false;
async function ideFormatCode() {
  if (!IDE.activeFile || !IDE.cm) { toast('No file open', 'error'); return; }
  const f  = IDE.files[IDE.activeFile];
  const ext= f.name.split('.').pop().toLowerCase();
  const ok = { js:1,jsx:1,ts:1,tsx:1,html:1,htm:1,css:1,scss:1,json:1,md:1 };
  if (!ok[ext]) { toast(`No formatter for .${ext}`, 'error'); return; }
  const btn = document.getElementById('ide-format-btn');
  if (btn) { btn.textContent='…'; btn.disabled=true; }
  try {
    if (!_prettierLoaded) {
      for (const s of [
        'https://unpkg.com/prettier@3.3.3/standalone.js',
        'https://unpkg.com/prettier@3.3.3/plugins/babel.js',
        'https://unpkg.com/prettier@3.3.3/plugins/html.js',
        'https://unpkg.com/prettier@3.3.3/plugins/postcss.js',
        'https://unpkg.com/prettier@3.3.3/plugins/markdown.js',
        'https://unpkg.com/prettier@3.3.3/plugins/typescript.js',
      ]) await new Promise((res,rej)=>{ const sc=document.createElement('script'); sc.src=s; sc.onload=res; sc.onerror=rej; document.head.appendChild(sc); });
      _prettierLoaded=true;
    }
    const parserMap = { js:'babel',jsx:'babel',ts:'typescript',tsx:'typescript',html:'html',htm:'html',css:'css',scss:'css',json:'json',md:'markdown' };
    const plugins   = [window.prettierPlugins?.babel,window.prettierPlugins?.html,window.prettierPlugins?.postcss,window.prettierPlugins?.markdown,window.prettierPlugins?.typescript].filter(Boolean);
    const cursor = IDE.cm.getCursor();
    const formatted = await window.prettier.format(IDE.cm.getValue(), { parser:parserMap[ext], plugins, printWidth:100, tabWidth:2, singleQuote:true, trailingComma:'es5' });
    IDE.cm.setValue(formatted); IDE.cm.setCursor(cursor);
    toast('✓ Formatted');
  } catch(e) { toast('Format failed: '+(e.message||''), 'error'); }
  if (btn) { btn.textContent='⌥ Format'; btn.disabled=false; }
}

function ideGoToLine() {
  if (!IDE.cm) return;
  ideModal({ title:'Go to Line', message:`Line 1–${IDE.cm.lineCount()}:`, input:{ default:String(IDE.cm.getCursor().line+1), placeholder:'1' }, confirmLabel:'Go' })
    .then(val => {
      if (!val) return;
      const n = Math.max(0, Math.min(IDE.cm.lineCount()-1, parseInt(val)-1));
      IDE.cm.setCursor({ line:n, ch:0 }); IDE.cm.scrollIntoView({ line:n, ch:0 }, 100); IDE.cm.focus();
    });
}

function ideSearchFiles() {
  const existing = document.getElementById('ide-search-panel');
  if (existing) { existing.remove(); return; }
  const panel = document.createElement('div');
  panel.id='ide-search-panel'; panel.className='ide-search-panel';
  panel.innerHTML = `
    <div class="ide-search-header">
      <span class="ide-search-title">🔍 Search in Files</span>
      <button class="ide-hdr-btn" id="ide-search-close">✕</button>
    </div>
    <div class="ide-search-input-row">
      <input id="ide-search-query" class="ide-search-input" type="text" placeholder="Search all files…" autocomplete="off">
      <label class="ide-search-opt-label" title="Case sensitive"><input type="checkbox" id="ide-search-case"> Aa</label>
      <label class="ide-search-opt-label" title="Whole word"><input type="checkbox" id="ide-search-word"> W</label>
    </div>
    <div id="ide-search-results" class="ide-search-results"></div>`;
  document.getElementById('ide-editor-body')?.parentElement?.insertBefore(panel, document.getElementById('ide-editor-body'));
  document.getElementById('ide-search-close').addEventListener('click', ()=>panel.remove());
  const qEl=document.getElementById('ide-search-query'), resEl=document.getElementById('ide-search-results');
  function doSearch() {
    const q=qEl.value, cs=document.getElementById('ide-search-case').checked, ww=document.getElementById('ide-search-word').checked;
    resEl.innerHTML='';
    if (q.length<2) { resEl.innerHTML='<div class="ide-search-hint">Type at least 2 characters…</div>'; return; }
    let total=0;
    const pat = (cs?'':'(?i)')+ (ww?`\\b${q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\b` : q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
    const re  = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'), cs?'g':'gi');
    for (const [id,f] of Object.entries(IDE.files)) {
      const content = IDE.cm&&IDE.activeFile===id ? IDE.cm.getValue() : f.content;
      const lines   = content.split('\n');
      const matches = [];
      lines.forEach((line,i)=>{ re.lastIndex=0; let m; while((m=re.exec(line))!==null) matches.push({line:i,col:m.index,text:line.trim().slice(0,100)}); });
      if (!matches.length) continue; total+=matches.length;
      const group=document.createElement('div'); group.className='ide-search-group';
      group.innerHTML=`<div class="ide-search-file-label">${getFileIconHtml(f.name.split('/').pop())} ${escHtml(f.name)} <span class="ide-search-count">${matches.length}</span></div>`;
      matches.slice(0,20).forEach(({line,col,text})=>{
        const row=document.createElement('div'); row.className='ide-search-row';
        row.innerHTML=`<span class="ide-search-lineno">${line+1}</span><span class="ide-search-text">${escHtml(text)}</span>`;
        row.addEventListener('click',()=>{ _openFile(id); setTimeout(()=>{ if(IDE.cm){ IDE.cm.setCursor({line,ch:col}); IDE.cm.scrollIntoView({line,ch:col},80); IDE.cm.focus(); } },80); });
        group.appendChild(row);
      });
      if (matches.length>20) { const m=document.createElement('div'); m.className='ide-search-more'; m.textContent=`+${matches.length-20} more`; group.appendChild(m); }
      resEl.appendChild(group);
    }
    if (!total) resEl.innerHTML=`<div class="ide-search-hint">No results for "${escHtml(q)}"</div>`;
  }
  qEl.addEventListener('input',doSearch);
  document.getElementById('ide-search-case').addEventListener('change',doSearch);
  document.getElementById('ide-search-word').addEventListener('change',doSearch);
  qEl.focus();
}

function ideLivePreview() {
  if (!IDE.activeFile) { toast('No file open','error'); return; }
  const f=IDE.files[IDE.activeFile], ext=f.name.split('.').pop().toLowerCase();
  if (!['html','htm'].includes(ext)) { toast('Live preview is for HTML files','error'); return; }
  const content=IDE.cm?IDE.cm.getValue():f.content;
  const url=URL.createObjectURL(new Blob([content],{type:'text/html'}));
  window.open(url,'_blank');
  setTimeout(()=>URL.revokeObjectURL(url),8000);
  toast('Opened in new tab ↗');
}

function ideFoldAll()   { if (!IDE.cm) return; for (let i=0;i<IDE.cm.lineCount();i++) try { IDE.cm.foldCode(CodeMirror.Pos(i,0)); } catch(_) {} }
function ideUnfoldAll() { if (!IDE.cm) return; for (let i=0;i<IDE.cm.lineCount();i++) try { IDE.cm.foldCode(CodeMirror.Pos(i,0),null,'unfold'); } catch(_) {} }

// ══════════════════════════════════════════════════════════
//  TERMINAL
// ══════════════════════════════════════════════════════════
function toggleTerminal() {
  const nowOpen = typeof window.panelsToggleTerm==='function'
    ? window.panelsToggleTerm()
    : (() => { const p=document.getElementById('ide-terminal-panel'); if(!p) return false; const n=p.style.display==='none'||!p.style.display; p.style.display=n?'flex':'none'; return n; })();
  if (nowOpen) {
    const panel=document.getElementById('ide-terminal-panel');
    if (panel && !panel.dataset.termBuilt) {
      panel.dataset.termBuilt='1';
      if (typeof window.buildIdeTerminal==='function') window.buildIdeTerminal(document.getElementById('ide-term-body'));
    }
  }
  requestAnimationFrame(()=>{ if(IDE.cm) IDE.cm.refresh(); });
}

// ══════════════════════════════════════════════════════════
//  AI CONTEXT + FILE OPS
// ══════════════════════════════════════════════════════════
function getIdeContext() {
  if (!document.getElementById('ide-include-code')?.checked) return '';
  const all  = document.getElementById('ide-include-all-files')?.checked ?? true;
  const pn   = IDE.projectName;
  const names= Object.values(IDE.files).map(f=>f.name).join(', ');
  let ctx = `\n\n[Project: ${pn}]\n[Files: ${names}]\n`;
  let used = ctx.length; const MAX=14000;
  if (IDE.activeFile && IDE.files[IDE.activeFile]) {
    const f=IDE.files[IDE.activeFile], code=IDE.cm?IDE.cm.getValue():f.content;
    ctx+=`\n[Active: ${f.name}]\n\`\`\`${f.language||'text'}\n${code.slice(0,8000)}\n\`\`\`\n`; used+=code.length;
  }
  if (all) for (const [id,f] of Object.entries(IDE.files)) {
    if (id===IDE.activeFile||used>MAX) continue;
    const s=f.content.slice(0,1500);
    ctx+=`\n[File: ${f.name}]\n\`\`\`${f.language||'text'}\n${s}${f.content.length>1500?'\n// …truncated':''}\n\`\`\`\n`; used+=s.length;
  }
  return ctx;
}

const FILE_OP_RE = /<nd_file_op\s+([^>]*?)>([\s\S]*?)<\/nd_file_op>|<nd_file_op\s+([^/]*?)\s*\/>/g;
function parseFileOps(text) {
  const ops=[]; let m; FILE_OP_RE.lastIndex=0;
  while ((m=FILE_OP_RE.exec(text))!==null) {
    const attrsStr=(m[1]||m[3]||'').trim(), content=(m[2]||'').trim(), attrs={};
    attrsStr.replace(/(\w+)="([^"]*?)"/g,(_,k,v)=>{ attrs[k]=v; });
    if (attrs.action) ops.push({...attrs,content});
  }
  return ops;
}
function stripFileOps(text) { return text.replace(FILE_OP_RE,'').replace(/\n{3,}/g,'\n\n').trim(); }

async function applyFileOp(op) {
  if (op.action==='create'||op.action==='modify') {
    const existing=Object.values(IDE.files).find(f=>f.name===op.file);
    if (existing) { existing.content=op.content; existing.saved=false; if(IDE.activeFile===existing.id&&IDE.cm) IDE.cm.setValue(op.content); await pfsSave(op.file,op.content); }
    else { const id=crypto.randomUUID(); IDE.files[id]={id,name:op.file,content:op.content,language:getLang(op.file),saved:false}; await pfsSave(op.file,op.content); if(!IDE.openTabs.includes(id)) IDE.openTabs.push(id); _openFile(id); }
    // expand parent folders
    const parts=op.file.split('/'); for(let i=1;i<parts.length;i++) IDE.expandedFolders.add(parts.slice(0,i).join('/'));
    renderFileTree(); renderFileTabs();
    toast(`${op.action==='create'?'📄':'✏️'} ${op.action} ${op.file}`); return;
  }
  if (op.action==='delete') {
    const f=Object.values(IDE.files).find(f=>f.name===op.file); if(!f){toast(`Not found: ${op.file}`,'error');return;}
    await pfsDelete(op.file); IDE.openTabs=IDE.openTabs.filter(t=>t!==f.id); delete IDE.files[f.id];
    if(IDE.activeFile===f.id){IDE.openTabs.length?_openFile(IDE.openTabs[IDE.openTabs.length-1]):showWelcome();}
    else{renderFileTabs();renderFileTree();}
    toast(`🗑 Deleted ${op.file}`); return;
  }
  if (op.action==='rename') {
    const nn=op.to||op.new_name; const f=Object.values(IDE.files).find(f=>f.name===(op.file||op.from)); if(!f||!nn) return;
    await pfsRename(f.name,nn); f.name=nn; f.language=getLang(nn.split('/').pop());
    if(IDE.cm&&IDE.activeFile===f.id) IDE.cm.setOption('mode',f.language);
    renderFileTree();renderFileTabs(); toast(`🔄 Renamed → ${nn}`);
  }
}

function _renderFileOpCards(ops, container) {
  if (!ops.length) return;
  const panel=document.createElement('div'); panel.className='ide-fop-panel';
  const icons={create:'📄',modify:'✏️',delete:'🗑️',rename:'🔄'}, labels={create:'Create',modify:'Modify',delete:'Delete',rename:'Rename'};
  panel.innerHTML=`<div class="ide-fop-header"><span class="ide-fop-title">⚡ ${ops.length} file op${ops.length>1?'s':''}</span><button class="ide-fop-apply-all-btn">Apply All</button></div>`+
    ops.map((op,i)=>{ const nm=op.file||op.from||'?', prev=op.content?op.content.slice(0,60).replace(/\n/g,' ')+(op.content.length>60?'…':''):'';
      return `<div class="ide-fop-card ide-fop-${op.action}"><div class="ide-fop-row"><span class="ide-fop-badge">${icons[op.action]||'⚡'} ${labels[op.action]||op.action}</span><span class="ide-fop-filename">${escHtml(nm)}</span>${op.action==='rename'?`<span class="ide-fop-arrow">→ ${escHtml(op.to||'')}</span>`:''}<div class="ide-fop-btns">${op.content?`<button class="ide-fop-btn ide-fop-prev-btn" data-i="${i}">Preview</button>`:''}  <button class="ide-fop-btn ide-fop-apply-btn" data-i="${i}">Apply</button></div></div>${prev?`<div class="ide-fop-preview-line">${escHtml(prev)}</div>`:''}</div>`;
    }).join('');
  container.appendChild(panel);
  panel.querySelector('.ide-fop-apply-all-btn').addEventListener('click',async function(){this.disabled=true;this.textContent='Applying…';for(const op of ops) await applyFileOp(op);this.textContent='✓ Done';panel.querySelectorAll('.ide-fop-apply-btn').forEach(b=>{b.textContent='✓';b.disabled=true;});await pkSaveHistory();});
  panel.querySelectorAll('.ide-fop-apply-btn').forEach(btn=>btn.addEventListener('click',async()=>{await applyFileOp(ops[+btn.dataset.i]);btn.textContent='✓';btn.disabled=true;}));
  panel.querySelectorAll('.ide-fop-prev-btn').forEach(btn=>btn.addEventListener('click',()=>{ const op=ops[+btn.dataset.i], cb=document.getElementById('canvas-body'), ct=document.getElementById('canvas-title'); if(!cb||!ct) return; ct.textContent=`Preview · ${op.file}`; cb.innerHTML=''; const pre=document.createElement('pre'),code=document.createElement('code'); code.className=`language-${getLang(op.file)||'text'}`; code.textContent=op.content; pre.appendChild(code); cb.appendChild(pre); try{hljs.highlightElement(code);}catch(e){} document.getElementById('canvas-run-output').style.display='none'; document.getElementById('canvas-panel').classList.add('open'); document.getElementById('canvas-overlay').classList.add('open'); }));
}

// ══════════════════════════════════════════════════════════
//  AI ASSISTANT
// ══════════════════════════════════════════════════════════
const AI_CHIPS = [
  {p:'Explain this code step by step.',l:'Explain'},
  {p:'Find and fix all bugs. Apply with file operations.',l:'Fix Bugs'},
  {p:'Refactor and optimise. Apply changes.',l:'Optimise'},
  {p:'Add TypeScript types. Convert .js → .ts.',l:'→ TypeScript'},
  {p:'Write comprehensive unit tests. Create a test file.',l:'Add Tests'},
  {p:'Add JSDoc/docstring comments to all public functions.',l:'Add Docs'},
  {p:'Review ALL project files. List issues by severity.',l:'Review All'},
  {p:'Write a detailed README.md for this project.',l:'README'},
  {p:'Create a complete .gitignore for this project type.',l:'.gitignore'},
  {p:'Create a Dockerfile and docker-compose.yml.',l:'Dockerise'},
  {p:'How do I push this to GitHub? Give exact commands.',l:'GitHub'},
  {p:'How do I deploy? Cover Vercel, Netlify, and Railway.',l:'Deploy'},
];

function _buildAiWelcome() {
  return `<div class="ide-ai-welcome-msg"><div class="ide-ai-welcome-icon">🤖</div><strong>AI Code Assistant</strong><p>I can <em>create</em>, <em>modify</em>, <em>delete</em>, and <em>rename</em> your files directly.</p></div><div class="ide-ai-chips">${AI_CHIPS.map(c=>`<button class="ide-ai-chip" data-p="${escHtml(c.p)}">${escHtml(c.l)}</button>`).join('')}</div>`;
}

function _refreshAiPanel(showHistory) {
  const msgsEl=document.getElementById('ide-ai-msgs'); if(!msgsEl) return;
  msgsEl.innerHTML='';
  if (showHistory&&IDE.aiMessages.length) {
    const div=document.createElement('div'); div.className='ide-ai-history-divider';
    div.innerHTML=`<span>↑ ${IDE.aiMessages.filter(m=>m.role==='user').length} previous exchanges</span><button id="ide-hist-clear-btn">Clear</button>`;
    msgsEl.appendChild(div);
    document.getElementById('ide-hist-clear-btn')?.addEventListener('click',async()=>{ await pkClearHistory(); _refreshAiPanel(false); toast('History cleared'); });
    IDE.aiMessages.forEach(m=>{ if(m.role!=='system') _addIdeMsgEl(m.role,m.content); });
    const cd=document.createElement('div'); cd.className='ide-ai-chips'; cd.innerHTML=AI_CHIPS.map(c=>`<button class="ide-ai-chip" data-p="${escHtml(c.p)}">${escHtml(c.l)}</button>`).join(''); msgsEl.appendChild(cd); _wireChips(cd);
  } else { msgsEl.innerHTML=_buildAiWelcome(); _wireChips(msgsEl); }
  msgsEl.scrollTop=msgsEl.scrollHeight;
}
function _wireChips(container) { container.querySelectorAll('.ide-ai-chip').forEach(chip=>chip.addEventListener('click',()=>{ const inp=document.getElementById('ide-ai-input'); inp.value=chip.dataset.p; inp.style.height='auto'; inp.style.height=Math.min(inp.scrollHeight,120)+'px'; ideAiSend(); })); }

document.getElementById('ide-ai-send').addEventListener('click', ideAiSend);
document.getElementById('ide-ai-input').addEventListener('keydown', e=>{ if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();ideAiSend();} requestAnimationFrame(()=>{ e.target.style.height='auto'; e.target.style.height=Math.min(e.target.scrollHeight,120)+'px'; }); });
document.getElementById('ide-ai-stop').addEventListener('click',()=>{ IDE.abortIde=true; });
document.getElementById('ide-ai-clear').addEventListener('click',async()=>{ await pkClearHistory(); _refreshAiPanel(false); toast('Chat cleared'); });
document.getElementById('ide-ai-close').addEventListener('click',()=>{ document.getElementById('ide-ai-panel').classList.add('ide-panel-hidden'); });

async function ideAiSend() {
  if (IDE.ideBusy) return;
  const input=document.getElementById('ide-ai-input'); const text=input.value.trim(); if(!text) return;
  input.value=''; input.style.height='auto';
  const msgsEl=document.getElementById('ide-ai-msgs'); msgsEl.querySelector('.ide-ai-welcome-msg')?.remove(); msgsEl.querySelector('.ide-ai-chips')?.remove();
  _addIdeMsgEl('user',text); IDE.aiMessages.push({role:'user',content:text});
  IDE.ideBusy=true; IDE.abortIde=false;
  document.getElementById('ide-ai-send').style.display='none'; document.getElementById('ide-ai-stop').style.display='';
  const ctxStr=getIdeContext();
  const sys=`You are an expert full-stack coding assistant in NeuralDock IDE. You can CREATE, MODIFY, DELETE, RENAME files.

Create: <nd_file_op action="create" file="path/name.ext">COMPLETE content</nd_file_op>
Modify: <nd_file_op action="modify" file="path/name.ext">COMPLETE new content</nd_file_op>
Delete: <nd_file_op action="delete" file="path/name.ext" />
Rename: <nd_file_op action="rename" file="old.ext" to="new.ext" />

Always provide COMPLETE file content. Support nested paths (e.g. src/utils/helpers.js).`;
  const msgs=[{role:'system',content:sys},...IDE.aiMessages.slice(-30).map((m,i,arr)=>({ role:m.role, content:m.role==='user'&&i===arr.length-1?m.content+ctxStr:m.content }))];
  const thinkEl=document.createElement('div'); thinkEl.className='ide-ai-msg assistant'; thinkEl.innerHTML=`<div class="ide-thinking-dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>`; msgsEl.appendChild(thinkEl); msgsEl.scrollTop=msgsEl.scrollHeight;
  let full='';
  try {
    const resp=await puter.ai.chat(msgs,{model:S.currentModel,stream:true,temperature:S.temperature||0.7}); thinkEl.remove();
    const bodyEl=_addIdeMsgEl('assistant','',true);
    if (resp&&typeof resp[Symbol.asyncIterator]==='function') { for await (const part of resp) { if(IDE.abortIde) break; const t=part?.text||part?.message?.content||''; if(t){full+=t;bodyEl.innerHTML=renderMarkdown(stripFileOps(full));msgsEl.scrollTop=msgsEl.scrollHeight;} } }
    else if (resp?.message?.content){full=resp.message.content;bodyEl.innerHTML=renderMarkdown(stripFileOps(full));}
    else if (typeof resp==='string'){full=resp;bodyEl.innerHTML=renderMarkdown(stripFileOps(full));}
    bodyEl.classList.remove('streaming-cursor'); bodyEl.querySelectorAll('pre code').forEach(b=>{try{hljs.highlightElement(b);}catch(_){}});
    const ops=parseFileOps(full);
    if (ops.length) { _renderFileOpCards(ops,msgsEl); }
    else { bodyEl.querySelectorAll('pre').forEach(pre=>{ const code=pre.querySelector('code'); if(!code) return; const btn=document.createElement('button'); btn.className='ide-apply-btn'; btn.textContent='⤵ Apply to editor'; btn.addEventListener('click',()=>{ const ct=code.textContent||''; if(IDE.cm) IDE.cm.setValue(ct); if(IDE.activeFile&&IDE.files[IDE.activeFile]){IDE.files[IDE.activeFile].content=ct;IDE.files[IDE.activeFile].saved=false;renderFileTabs();renderFileTree();} toast('Applied ✓'); }); pre.style.position='relative'; pre.appendChild(btn); }); }
    IDE.aiMessages.push({role:'assistant',content:full}); await pkSaveHistory();
  } catch(err) { thinkEl.remove(); if(!IDE.abortIde){_addIdeMsgEl('assistant','⚠ '+(err.message||'Request failed')); toast('AI error: '+(err.message||''),'error');} }
  IDE.ideBusy=false; IDE.abortIde=false;
  document.getElementById('ide-ai-send').style.display=''; document.getElementById('ide-ai-stop').style.display='none';
}

function _addIdeMsgEl(role, text, streaming=false) {
  const msgsEl=document.getElementById('ide-ai-msgs'); const wrap=document.createElement('div'); wrap.className=`ide-ai-msg ${role}`;
  if(streaming) wrap.classList.add('streaming-cursor');
  if(text){if(role==='assistant'){wrap.classList.add('md');wrap.innerHTML=renderMarkdown(text);}else wrap.textContent=text;}
  msgsEl.appendChild(wrap); msgsEl.scrollTop=msgsEl.scrollHeight; return wrap;
}
function addIdeMsg(role,text,streaming){return _addIdeMsgEl(role,text,streaming);}

// ══════════════════════════════════════════════════════════
//  BUTTON WIRING
//  NOTE: #ide-ai-toggle (old "AI Help") is removed.
//  Only #ide-toggle-ai exists now (wired by ide-panels.js).
// ══════════════════════════════════════════════════════════
document.getElementById('ide-new-btn')?.addEventListener('click',      ()=>ideNewFile());
document.getElementById('ide-upload-btn')?.addEventListener('click',    ideUploadFile);
document.getElementById('ide-tree-new-btn')?.addEventListener('click',  ()=>ideNewFile());
document.getElementById('ide-tree-new-folder-btn')?.addEventListener('click', ()=>ideNewTopFolder());
document.getElementById('ide-tree-upload-btn')?.addEventListener('click', ideUploadFile);
document.getElementById('ide-save-btn')?.addEventListener('click',      ideSaveFile);
document.getElementById('ide-dl-btn')?.addEventListener('click',        ideDownloadFile);
document.getElementById('ide-run-btn')?.addEventListener('click',       ideRunCode);
document.getElementById('ide-preview-btn')?.addEventListener('click',   ideLivePreview);
document.getElementById('ide-format-btn')?.addEventListener('click',    ideFormatCode);
document.getElementById('ide-wrap-btn')?.addEventListener('click',      toggleWordWrap);
document.getElementById('ide-search-btn')?.addEventListener('click',    ideSearchFiles);
document.getElementById('ide-fold-btn')?.addEventListener('click',      ideFoldAll);
document.getElementById('ide-gotoline-btn')?.addEventListener('click',  ideGoToLine);
document.getElementById('ide-terminal-btn')?.addEventListener('click',  toggleTerminal);
document.getElementById('ide-project-btn')?.addEventListener('click',   ideOpenProjectSwitcher);
document.getElementById('ide-proj-menu-btn')?.addEventListener('click', function(){ showProjectMenu(this); });

document.getElementById('ide-terminal-close')?.addEventListener('click',()=>{
  if (typeof window.panelsToggleTerm==='function') { const p=document.getElementById('ide-terminal-panel'); if(p&&p.style.display!=='none') window.panelsToggleTerm(); }
  else { const p=document.getElementById('ide-terminal-panel'); if(p) p.style.display='none'; }
  requestAnimationFrame(()=>{ if(IDE.cm) IDE.cm.refresh(); });
});
document.getElementById('ide-output-close')?.addEventListener('click',()=>{ document.getElementById('ide-output').style.display='none'; });
document.getElementById('ide-output-clear')?.addEventListener('click',()=>{ document.getElementById('ide-output-pre').textContent=''; const f=document.getElementById('ide-html-frame'); f.srcdoc=''; f.style.display='none'; });
document.getElementById('ide-output-rerun')?.addEventListener('click', ideRunCode);
document.querySelectorAll('.ide-out-tab').forEach(tab=>tab.addEventListener('click',()=>showOutTab(tab.dataset.out)));
document.querySelectorAll('.ide-wlc-card[data-tpl]').forEach(c=>c.addEventListener('click',()=>ideQuickStart(c.dataset.tpl)));
document.querySelectorAll('.ide-tpl-chip[data-tpl]').forEach(c=>c.addEventListener('click',()=>ideQuickStart(c.dataset.tpl)));
document.getElementById('ide-wlc-new')?.addEventListener('click',  ()=>ideNewFile());
document.getElementById('ide-wlc-upload')?.addEventListener('click', ideUploadFile);
document.getElementById('ide-project-name')?.addEventListener('keydown',e=>{ if(e.key==='Enter'){e.preventDefault();e.target.blur();} });
document.getElementById('ide-project-name')?.addEventListener('blur',function(){ const n=this.textContent.trim()||'my-project'; if(n!==IDE.projectName){IDE.projectName=n;this.textContent=n;} });

// Keyboard shortcut: Ctrl+Shift+F = search files
document.addEventListener('keydown', e=>{
  if ((e.ctrlKey||e.metaKey)&&e.shiftKey&&e.key==='f') { e.preventDefault(); ideSearchFiles(); }
  if ((e.ctrlKey||e.metaKey)&&e.key==='g') { e.preventDefault(); ideGoToLine(); }
});

// ══════════════════════════════════════════════════════════
//  TAB ACTIVATION
// ══════════════════════════════════════════════════════════
async function ideOnTabActivated() {
  if (IDE.activeFile && IDE.files[IDE.activeFile]) {
    const f=IDE.files[IDE.activeFile];
    document.getElementById('ide-welcome').style.display='none';
    document.getElementById('ide-monaco').style.display='';
    if (IDE.cm) { IDE.files[IDE.activeFile].content=IDE.cm.getValue(); requestAnimationFrame(()=>requestAnimationFrame(()=>{IDE.cm.refresh();IDE.cm.focus();})); }
    else initCM(f.content,f.language);
  }
  updateStatusBar();
  if (!IDE._historyLoaded) { IDE._historyLoaded=true; const loaded=await pkLoadHistory(); _refreshAiPanel(loaded); }
}
