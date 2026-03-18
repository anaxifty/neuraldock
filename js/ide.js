/**
 * ide.js — Project IDE: file management, CodeMirror editor, AI assistant
 * Depends on: utils.js, config.js (LANG_MAP, FILE_ICONS, TEMPLATES, getFileIcon, getLang),
 *             state.js, markdown.js, ui.js (activateTab)
 * Requires: CodeMirror (CDN), JSZip (CDN)
 */

'use strict';

const IDE = {
  /** @type {Object.<string, {id:string, name:string, content:string, language:string, saved:boolean}>} */
  files:      {},
  activeFile: null,
  /** @type {CodeMirror.Editor|null} */
  cm:         null,
  aiMessages: [],
  ideBusy:    false,
  abortIde:   false,
  currentOutTab: 'preview',
};

// ── CodeMirror initialisation ──────────────────────────────────────────────
/**
 * Initialise the CodeMirror editor (once) or update content/mode on an existing instance.
 * @param {string} content
 * @param {string} lang  CodeMirror mode string
 */
function initCM(content = '', lang = 'null') {
  const container = document.getElementById('ide-monaco');
  const ta = document.getElementById('ide-editor-ta');

  if (IDE.cm) {
    // Update existing instance
    IDE.cm.setValue(content);
    IDE.cm.setOption('mode', lang);
    // Multiple refreshes needed: once now, once after browser paint
    IDE.cm.refresh();
    requestAnimationFrame(() => {
      IDE.cm.refresh();
      IDE.cm.focus();
    });
    return;
  }

  // First init — make sure container is visible before CodeMirror measures it
  container.style.display = '';

  IDE.cm = CodeMirror.fromTextArea(ta, {
    value:             content,
    mode:              lang,
    theme:             'aistudio',
    lineNumbers:       true,
    autoCloseBrackets: true,
    matchBrackets:     true,
    lineWrapping:      true,
    indentUnit:        2,
    tabSize:           2,
    indentWithTabs:    false,
    extraKeys: {
      'Ctrl-S': () => ideSaveFile(),
      'Cmd-S':  () => ideSaveFile(),
      'Ctrl-/': 'toggleComment',
      'Cmd-/':  'toggleComment',
      'Tab':    cm => cm.execCommand('insertSoftTab'),
    },
  });

  IDE.cm.setValue(content);

  // Refresh after next paint so CodeMirror can measure its container
  requestAnimationFrame(() => {
    IDE.cm.refresh();
    IDE.cm.focus();
  });

  // Mark file as unsaved when content changes
  IDE.cm.on('change', () => {
    if (IDE.activeFile && IDE.files[IDE.activeFile]) {
      IDE.files[IDE.activeFile].saved = false;
      renderFileTabs();
      renderFileTree();
    }
  });
}

// ── File management ────────────────────────────────────────────────────────
function ideNewFile(suggestedName) {
  const name = suggestedName || prompt('File name (e.g. index.html, app.py):', 'index.html');
  if (!name?.trim()) return;
  const id = crypto.randomUUID();
  IDE.files[id] = { id, name: name.trim(), content: '', language: getLang(name), saved: true };
  renderFileTree();
  openFile(id);
  toast('Created ' + name.trim());
}

function ideUploadFile() {
  document.getElementById('ide-file-input').click();
}

document.getElementById('ide-file-input').addEventListener('change', async function (e) {
  const files = Array.from(e.target.files);
  e.target.value = '';
  for (const f of files) {
    const content = await readFileAsText(f);
    const id = crypto.randomUUID();
    IDE.files[id] = { id, name: f.name, content, language: getLang(f.name), saved: true };
  }
  renderFileTree();
  const ids = Object.keys(IDE.files);
  if (ids.length) openFile(ids[ids.length - 1]);
  toast(`Uploaded ${files.length} file(s)`);
});

function ideDeleteFile(id, e) {
  e?.stopPropagation();
  const f = IDE.files[id];
  if (!f || !confirm(`Delete ${f.name}?`)) return;
  delete IDE.files[id];
  if (IDE.activeFile === id) {
    IDE.activeFile = null;
    const remaining = Object.keys(IDE.files);
    remaining.length ? openFile(remaining[remaining.length - 1]) : showWelcome();
  }
  renderFileTree();
  renderFileTabs();
  toast('Deleted ' + f.name);
}

function ideSaveFile() {
  if (!IDE.activeFile) return;
  const f = IDE.files[IDE.activeFile];
  if (!f) return;
  // Get content from CM if available, otherwise keep stored content
  if (IDE.cm) f.content = IDE.cm.getValue();
  f.saved = true;
  renderFileTabs();
  renderFileTree();
  toast('Saved ' + f.name);
}

function ideDownloadFile() {
  if (!IDE.activeFile) { toast('No file open', 'error'); return; }
  ideSaveFile();
  const f    = IDE.files[IDE.activeFile];
  const blob = new Blob([f.content], { type: 'text/plain' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = f.name;
  a.click();
  toast('Downloaded ' + f.name);
}

async function ideDownloadZip() {
  const ids = Object.keys(IDE.files);
  if (!ids.length) { toast('No files to download', 'error'); return; }
  ideSaveFile();
  if (!window.JSZip) { toast('ZIP library not loaded', 'error'); return; }
  const zip     = new JSZip();
  const project = document.getElementById('ide-project-name')?.textContent?.trim() || 'project';
  for (const id of ids) { const f = IDE.files[id]; zip.file(f.name, f.content); }
  const blob = await zip.generateAsync({ type: 'blob' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = project + '.zip';
  a.click();
  toast(`Downloaded ${project}.zip`);
}

function openFile(id) {
  // Save current file's CM content before switching away
  if (IDE.cm && IDE.activeFile && IDE.files[IDE.activeFile]) {
    IDE.files[IDE.activeFile].content = IDE.cm.getValue();
  }

  IDE.activeFile = id;
  const f = IDE.files[id];
  if (!f) return;

  document.getElementById('ide-welcome').style.display = 'none';
  const monacoEl = document.getElementById('ide-monaco');
  monacoEl.style.display = '';

  renderFileTree();
  renderFileTabs();
  initCM(f.content, f.language);
}

function showWelcome() {
  document.getElementById('ide-monaco').style.display  = 'none';
  document.getElementById('ide-welcome').style.display = '';
  IDE.activeFile = null;
  renderFileTabs();
  renderFileTree();
}

function renderFileTree() {
  const list  = document.getElementById('ide-file-list');
  const empty = document.getElementById('ide-empty-tree');
  const ids   = Object.keys(IDE.files);

  if (!ids.length) { empty.style.display = ''; return; }
  empty.style.display = 'none';
  Array.from(list.children).forEach(c => { if (c.id !== 'ide-empty-tree') c.remove(); });

  ids.forEach(id => {
    const f  = IDE.files[id];
    const el = document.createElement('div');
    el.className = 'ide-file-item' + (id === IDE.activeFile ? ' active' : '');
    el.innerHTML =
      `<span class="ide-file-icon">${getFileIcon(f.name)}</span>` +
      `<span class="ide-file-name">${escHtml(f.name)}</span>` +
      (f.saved ? '' : `<span class="ide-file-modified" title="Unsaved">●</span>`) +
      `<button class="ide-file-del" title="Delete file">✕</button>`;
    el.addEventListener('click', e => {
      if (!e.target.classList.contains('ide-file-del')) openFile(id);
    });
    el.querySelector('.ide-file-del').addEventListener('click', e => ideDeleteFile(id, e));
    list.appendChild(el);
  });
}

function renderFileTabs() {
  const list = document.getElementById('ide-tabs-list');
  list.innerHTML = '';
  Object.values(IDE.files).forEach(f => {
    const tab = document.createElement('button');
    tab.className = 'ide-tab' + (f.id === IDE.activeFile ? ' active' : '');
    tab.innerHTML =
      `<span>${getFileIcon(f.name)}</span>` +
      `<span class="ide-tab-name">${escHtml(f.name)}</span>` +
      (f.saved ? '' : `<span class="ide-tab-dot" title="Unsaved">●</span>`) +
      `<button class="ide-tab-close">×</button>`;

    tab.addEventListener('click', e => {
      if (!e.target.classList.contains('ide-tab-close')) openFile(f.id);
    });
    tab.querySelector('.ide-tab-close').addEventListener('click', e => {
      e.stopPropagation();
      // Auto-save before closing
      if (IDE.activeFile === f.id && IDE.cm) {
        f.content = IDE.cm.getValue();
        f.saved   = true;
      }
      delete IDE.files[f.id];
      if (IDE.activeFile === f.id) {
        const remaining = Object.keys(IDE.files);
        remaining.length ? openFile(remaining[remaining.length - 1]) : showWelcome();
      } else {
        renderFileTabs();
        renderFileTree();
      }
    });
    list.appendChild(tab);
  });
}

// ── Quick-start templates ──────────────────────────────────────────────────
function ideQuickStart(tpl) {
  const files = TEMPLATES[tpl];
  if (!files) return;
  if (Object.keys(IDE.files).length > 0 && !confirm('Load template? Files will be added to your project.')) return;
  files.forEach(f => {
    const id = crypto.randomUUID();
    IDE.files[id] = { id, name: f.name, content: f.content, language: getLang(f.name), saved: true };
  });
  renderFileTree();
  openFile(Object.keys(IDE.files)[0]);
  toast(`${tpl} template loaded!`);
}

// ── Run code ───────────────────────────────────────────────────────────────
function ideRunCode() {
  if (!IDE.activeFile || !IDE.cm) { toast('No file open', 'error'); return; }
  ideSaveFile();
  const f   = IDE.files[IDE.activeFile];
  const ext = f.name.split('.').pop().toLowerCase();
  const outDiv = document.getElementById('ide-output');
  const outPre = document.getElementById('ide-output-pre');
  const frame  = document.getElementById('ide-html-frame');
  outDiv.style.display = '';
  showOutTab(IDE.currentOutTab);

  const code = IDE.cm.getValue();

  if (['html', 'htm'].includes(ext)) {
    showOutTab('preview');
    outPre.style.display = 'none';
    frame.style.display  = '';
    frame.srcdoc = code;

  } else if (['js', 'mjs'].includes(ext)) {
    showOutTab('console');
    outPre.style.display = '';
    frame.style.display  = 'none';
    outPre.textContent   = '';
    const log = (...a) => {
      outPre.textContent += a
        .map(x => typeof x === 'object' ? JSON.stringify(x, null, 2) : String(x))
        .join(' ') + '\n';
    };
    try {
      const sandbox = document.createElement('iframe');
      sandbox.style.display = 'none';
      document.body.appendChild(sandbox);
      sandbox.contentWindow.console = { log, warn: log, error: log, info: log, debug: log };
      sandbox.contentWindow.eval(code);
      sandbox.remove();
      if (!outPre.textContent.trim()) outPre.textContent = '(no console output)';
    } catch (err) {
      outPre.textContent = '⚠ Error: ' + err.message;
    }

  } else {
    showOutTab('console');
    outPre.style.display = '';
    frame.style.display  = 'none';
    const hints = {
      py:  `Run in terminal:\n  python ${f.name}`,
      ts:  `Compile and run:\n  npx ts-node ${f.name}`,
      tsx: `Build with Vite:\n  npm run dev`,
      jsx: `Build with Vite:\n  npm run dev`,
    };
    outPre.textContent = (hints[ext] || `Cannot run .${ext} files in the browser.\nUse the appropriate runtime.`);
  }
}

function showOutTab(tab) {
  IDE.currentOutTab = tab;
  document.querySelectorAll('.ide-out-tab').forEach(t => t.classList.toggle('active', t.dataset.out === tab));
  const frame = document.getElementById('ide-html-frame');
  const pre   = document.getElementById('ide-output-pre');
  if (tab === 'preview') { frame.style.display = ''; pre.style.display   = 'none'; }
  else                   { frame.style.display = 'none'; pre.style.display = ''; }
}

// ── AI assistant ───────────────────────────────────────────────────────────
document.getElementById('ide-ai-send').addEventListener('click', ideAiSend);
document.getElementById('ide-ai-input').addEventListener('keydown', e => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); ideAiSend(); }
  // Auto-resize textarea
  e.target.style.height = 'auto';
  e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px';
});
document.getElementById('ide-ai-stop').addEventListener('click', () => { IDE.abortIde = true; });
document.getElementById('ide-ai-clear').addEventListener('click', () => {
  const msgs = document.getElementById('ide-ai-msgs');
  msgs.innerHTML = '';
  IDE.aiMessages = [];
  msgs.innerHTML =
    `<div class="ide-ai-welcome-msg">` +
      `<div class="ide-ai-welcome-icon">🤖</div>` +
      `<strong>AI Code Assistant</strong>` +
      `<p>Chat cleared. Ask me anything about your code.</p>` +
    `</div>`;
});
document.getElementById('ide-ai-close').addEventListener('click', () => {
  document.getElementById('ide-ai-panel').classList.add('hidden');
});

// Quick-action chips
document.querySelectorAll('.ide-ai-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.getElementById('ide-ai-input').value = chip.dataset.p;
    ideAiSend();
  });
});

function getIdeContext() {
  const include = document.getElementById('ide-include-code')?.checked;
  if (!include || !IDE.activeFile) return '';

  const f = IDE.files[IDE.activeFile];
  if (!f) return '';

  // Use live editor value if CM is ready, otherwise use stored content
  const code     = IDE.cm ? IDE.cm.getValue() : (f.content || '');
  const allFiles = Object.values(IDE.files).map(fl => fl.name).join(', ');

  return (
    `\n\n[Project files: ${allFiles}]` +
    `\n[Active file: ${f.name} (${f.language || 'text'})]` +
    `\n\`\`\`${f.language || 'text'}\n${code.slice(0, 8000)}\n\`\`\``
  );
}

async function ideAiSend() {
  if (IDE.ideBusy) return;
  const input = document.getElementById('ide-ai-input');
  const text  = input.value.trim();
  if (!text) return;
  input.value = '';
  input.style.height = 'auto';

  const msgsEl = document.getElementById('ide-ai-msgs');
  // Hide welcome message + chips on first send
  msgsEl.querySelector('.ide-ai-welcome-msg')?.remove();
  msgsEl.querySelector('.ide-ai-chips')?.remove();

  addIdeMsg('user', text);
  IDE.aiMessages.push({ role: 'user', content: text });

  IDE.ideBusy   = true;
  IDE.abortIde  = false;
  document.getElementById('ide-ai-send').style.display = 'none';
  document.getElementById('ide-ai-stop').style.display = '';

  const contextStr = getIdeContext();
  const sysPrompt  = [
    'You are an expert full-stack coding assistant embedded in a project IDE.',
    'Help the user write, debug, refactor, and deploy their code.',
    'Always use fenced code blocks with language identifiers (```language).',
    'When giving deployment or git instructions, provide exact terminal commands.',
    'When writing a complete file, write the full content.',
  ].join(' ');

  const chatMessages = [
    { role: 'system', content: sysPrompt },
    ...IDE.aiMessages.slice(-20).map((m, i, arr) => ({
      role: m.role,
      content: m.role === 'user' && i === arr.length - 1
        ? m.content + contextStr
        : m.content,
    })),
  ];

  // Thinking indicator
  const thinkEl = document.createElement('div');
  thinkEl.className = 'ide-ai-msg assistant';
  thinkEl.innerHTML =
    `<div style="display:flex;gap:5px;align-items:center;padding:4px 0">` +
      `<div class="dot"></div><div class="dot" style="animation-delay:.2s"></div><div class="dot" style="animation-delay:.4s"></div>` +
    `</div>`;
  msgsEl.appendChild(thinkEl);
  msgsEl.scrollTop = msgsEl.scrollHeight;

  let full = '';
  try {
    const resp = await puter.ai.chat(chatMessages, {
      model:       S.currentModel,
      stream:      true,
      temperature: S.temperature || 0.7,
    });
    thinkEl.remove();
    const bodyEl = addIdeMsg('assistant', '', true);

    if (resp && typeof resp[Symbol.asyncIterator] === 'function') {
      for await (const part of resp) {
        if (IDE.abortIde) break;
        const t = part?.text || part?.message?.content || '';
        if (t) { full += t; bodyEl.innerHTML = renderMarkdown(full); msgsEl.scrollTop = msgsEl.scrollHeight; }
      }
    } else if (resp?.message?.content) {
      full = resp.message.content;
      bodyEl.innerHTML = renderMarkdown(full);
    } else if (typeof resp === 'string') {
      full = resp;
      bodyEl.innerHTML = renderMarkdown(full);
    }

    bodyEl.classList.remove('streaming-cursor');
    bodyEl.querySelectorAll('pre code').forEach(b => { try { hljs.highlightElement(b); } catch (e) {} });

    // Add "Apply to editor" button on every code block
    bodyEl.querySelectorAll('pre').forEach(pre => {
      const code = pre.querySelector('code');
      if (!code) return;
      const applyBtn       = document.createElement('button');
      applyBtn.className   = 'ide-apply-btn';
      applyBtn.textContent = '⤵ Apply to editor';
      applyBtn.title       = 'Replace editor content with this code';
      applyBtn.addEventListener('click', () => {
        if (!IDE.cm) { toast('Open a file first', 'error'); return; }
        const codeText = code.textContent || '';
        IDE.cm.setValue(codeText);
        if (IDE.activeFile && IDE.files[IDE.activeFile]) {
          IDE.files[IDE.activeFile].content = codeText;
          IDE.files[IDE.activeFile].saved   = false;
          renderFileTabs();
          renderFileTree();
        }
        toast('Code applied to editor ✓');
      });
      pre.style.position = 'relative';
      pre.appendChild(applyBtn);
    });

    IDE.aiMessages.push({ role: 'assistant', content: full });

  } catch (err) {
    thinkEl.remove();
    if (!IDE.abortIde) {
      addIdeMsg('assistant', '⚠ ' + (err.message || 'Request failed'));
      toast('AI error: ' + (err.message || ''), 'error');
    }
  }

  IDE.ideBusy  = false;
  IDE.abortIde = false;
  document.getElementById('ide-ai-send').style.display = '';
  document.getElementById('ide-ai-stop').style.display = 'none';
}

/**
 * Append a message bubble to the IDE AI chat.
 * @param {'user'|'assistant'} role
 * @param {string} text
 * @param {boolean} streaming  Add streaming cursor class
 * @returns {HTMLElement} The message element (or body div for assistant)
 */
function addIdeMsg(role, text, streaming = false) {
  const msgsEl = document.getElementById('ide-ai-msgs');
  const wrap   = document.createElement('div');
  wrap.className = 'ide-ai-msg ' + role;
  if (streaming) wrap.classList.add('streaming-cursor');
  if (text) {
    if (role === 'assistant') { wrap.classList.add('md'); wrap.innerHTML = renderMarkdown(text); }
    else wrap.textContent = text;
  }
  msgsEl.appendChild(wrap);
  msgsEl.scrollTop = msgsEl.scrollHeight;
  return wrap;
}

// ── Wire up all IDE buttons ────────────────────────────────────────────────
document.getElementById('ide-new-btn').addEventListener('click', () => ideNewFile());
document.getElementById('ide-upload-btn').addEventListener('click', ideUploadFile);
document.getElementById('ide-zip-btn').addEventListener('click', ideDownloadZip);
document.getElementById('ide-tree-new-btn').addEventListener('click', () => ideNewFile());
document.getElementById('ide-tree-upload-btn').addEventListener('click', ideUploadFile);
document.getElementById('ide-save-btn').addEventListener('click', ideSaveFile);
document.getElementById('ide-dl-btn').addEventListener('click', ideDownloadFile);
document.getElementById('ide-run-btn').addEventListener('click', ideRunCode);

// Welcome screen cards + template chips
document.querySelectorAll('.ide-wlc-card[data-tpl]').forEach(card =>
  card.addEventListener('click', () => ideQuickStart(card.dataset.tpl))
);
document.querySelectorAll('.ide-tpl-chip[data-tpl]').forEach(chip =>
  chip.addEventListener('click', () => ideQuickStart(chip.dataset.tpl))
);

document.getElementById('ide-wlc-new').addEventListener('click', () => ideNewFile());
document.getElementById('ide-wlc-upload').addEventListener('click', ideUploadFile);

// Output panel controls
document.getElementById('ide-output-close').addEventListener('click', () => {
  document.getElementById('ide-output').style.display = 'none';
});
document.getElementById('ide-output-clear').addEventListener('click', () => {
  document.getElementById('ide-output-pre').textContent = '';
  document.getElementById('ide-html-frame').srcdoc = '';
});
document.getElementById('ide-output-rerun')?.addEventListener('click', ideRunCode);
document.querySelectorAll('.ide-out-tab').forEach(tab =>
  tab.addEventListener('click', () => showOutTab(tab.dataset.out))
);

// AI panel toggle
document.getElementById('ide-ai-toggle').addEventListener('click', () => {
  document.getElementById('ide-ai-panel').classList.toggle('hidden');
});

// Editable project name
document.getElementById('ide-project-name')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); }
});
