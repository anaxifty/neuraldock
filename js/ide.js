/**
 * ide.js — Project IDE: file management, CodeMirror editor, AI assistant
 *
 * BUGS FIXED:
 * - Delete button click propagating to openFile (e.target check was wrong)
 * - Uploaded file not showing: openFile called before tab visible → CM measures 0px
 * - Uploaded file not in AI context: readFileAsText failure, content not stored
 * - confirm/prompt use native dialogs → replaced with themed modal
 * - ideRunCode bailed when IDE.cm null even though file content exists
 * - renderFileTree would leave stale items when called rapidly
 * - Tab close didn't re-render file tree after removing last file
 * - ideDownloadZip used wrong project name when contenteditable empty
 *
 * Depends on: utils.js, config.js, state.js, markdown.js, ui.js
 */

'use strict';

const IDE = {
  files:         {},     // { [id]: {id, name, content, language, saved} }
  activeFile:    null,
  cm:            null,   // CodeMirror instance
  aiMessages:    [],
  ideBusy:       false,
  abortIde:      false,
  currentOutTab: 'preview',
};

// ── Themed modal (replaces native confirm/prompt) ─────────────────────────
function ideModal({ title, message, input = null, confirmLabel = 'OK', cancelLabel = 'Cancel' }) {
  return new Promise(resolve => {
    // Remove any existing modal
    document.getElementById('ide-modal-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'ide-modal-overlay';
    overlay.className = 'ide-modal-overlay';

    const inputHtml = input
      ? `<input id="ide-modal-input" class="ide-modal-input" type="text"
           value="${escHtml(input.default || '')}"
           placeholder="${escHtml(input.placeholder || '')}" autocomplete="off">`
      : '';

    overlay.innerHTML = `
      <div class="ide-modal">
        <div class="ide-modal-title">${escHtml(title)}</div>
        <div class="ide-modal-msg">${escHtml(message)}</div>
        ${inputHtml}
        <div class="ide-modal-btns">
          <button class="ide-modal-btn cancel" id="ide-modal-cancel">${escHtml(cancelLabel)}</button>
          <button class="ide-modal-btn confirm" id="ide-modal-confirm">${escHtml(confirmLabel)}</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    const inputEl   = document.getElementById('ide-modal-input');
    const confirmEl = document.getElementById('ide-modal-confirm');
    const cancelEl  = document.getElementById('ide-modal-cancel');

    if (inputEl) {
      inputEl.focus();
      inputEl.select();
      inputEl.addEventListener('keydown', e => {
        if (e.key === 'Enter')  { e.preventDefault(); confirmEl.click(); }
        if (e.key === 'Escape') { e.preventDefault(); cancelEl.click(); }
      });
    } else {
      confirmEl.focus();
    }

    const done = (value) => { overlay.remove(); resolve(value); };

    confirmEl.addEventListener('click', () =>
      done(input ? (inputEl?.value?.trim() || null) : true)
    );
    cancelEl.addEventListener('click', () => done(null));
    overlay.addEventListener('click', e => { if (e.target === overlay) done(null); });
  });
}

// ── CodeMirror initialisation ─────────────────────────────────────────────
function initCM(content = '', lang = 'null') {
  const container = document.getElementById('ide-monaco');
  const ta        = document.getElementById('ide-editor-ta');

  if (IDE.cm) {
    IDE.cm.setValue(content);
    IDE.cm.setOption('mode', lang || 'null');
    // Double rAF ensures the panel is painted before CM measures
    requestAnimationFrame(() => requestAnimationFrame(() => {
      IDE.cm.refresh();
      IDE.cm.focus();
    }));
    return;
  }

  container.style.display = '';

  IDE.cm = CodeMirror.fromTextArea(ta, {
    value:             content,
    mode:              lang || 'null',
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
      'Tab':    cm  => cm.execCommand('insertSoftTab'),
    },
  });

  IDE.cm.setValue(content);

  requestAnimationFrame(() => requestAnimationFrame(() => {
    IDE.cm.refresh();
    IDE.cm.focus();
  }));

  // Track unsaved changes
  IDE.cm.on('change', () => {
    if (IDE.activeFile && IDE.files[IDE.activeFile]) {
      IDE.files[IDE.activeFile].saved = false;
      renderFileTabs();
      renderFileTree();
    }
  });
}

// ── File management ───────────────────────────────────────────────────────
async function ideNewFile(suggestedName) {
  const name = suggestedName || await ideModal({
    title: 'New File',
    message: 'Enter a filename:',
    input: { default: 'index.html', placeholder: 'e.g. index.html, app.py, style.css' },
    confirmLabel: 'Create',
  });
  if (!name?.trim()) return;
  const id = crypto.randomUUID();
  IDE.files[id] = { id, name: name.trim(), content: '', language: getLang(name), saved: true };
  renderFileTree();
  _openFile(id);
  toast('Created ' + name.trim());
}

function ideUploadFile() {
  document.getElementById('ide-file-input').click();
}

document.getElementById('ide-file-input').addEventListener('change', async function (e) {
  const files = Array.from(e.target.files);
  e.target.value = '';
  if (!files.length) return;

  const newIds = [];
  for (const f of files) {
    try {
      const content = await readFileAsText(f);
      const id = crypto.randomUUID();
      IDE.files[id] = { id, name: f.name, content: content || '', language: getLang(f.name), saved: true };
      newIds.push(id);
    } catch (err) {
      toast(`Failed to read ${f.name}`, 'error');
    }
  }

  if (!newIds.length) return;
  renderFileTree();
  // Always open the last uploaded file
  _openFile(newIds[newIds.length - 1]);
  toast(`Uploaded ${newIds.length} file(s)`);
});

async function ideDeleteFile(id, e) {
  if (e) { e.stopPropagation(); e.preventDefault(); }
  const f = IDE.files[id];
  if (!f) return;

  const ok = await ideModal({
    title:        'Delete File',
    message:      `Delete "${f.name}"? This cannot be undone.`,
    confirmLabel: 'Delete',
    cancelLabel:  'Cancel',
  });
  if (!ok) return;

  delete IDE.files[id];

  if (IDE.activeFile === id) {
    IDE.activeFile = null;
    const remaining = Object.keys(IDE.files);
    remaining.length ? _openFile(remaining[remaining.length - 1]) : showWelcome();
  } else {
    renderFileTabs();
    renderFileTree();
  }
  toast('Deleted ' + f.name);
}

function ideSaveFile() {
  if (!IDE.activeFile) return;
  const f = IDE.files[IDE.activeFile];
  if (!f) return;
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
  URL.revokeObjectURL(a.href);
  toast('Downloaded ' + f.name);
}

async function ideDownloadZip() {
  const ids = Object.keys(IDE.files);
  if (!ids.length) { toast('No files to download', 'error'); return; }
  ideSaveFile();
  if (!window.JSZip) { toast('ZIP library not loaded', 'error'); return; }
  const zip     = new JSZip();
  const project = (document.getElementById('ide-project-name')?.textContent?.trim()) || 'project';
  for (const id of ids) {
    const f = IDE.files[id];
    zip.file(f.name, f.content || '');
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = project + '.zip';
  a.click();
  URL.revokeObjectURL(a.href);
  toast(`Downloaded ${project}.zip`);
}

/**
 * Open a file in the editor.
 * If the code tab is not currently active, just store the file as active
 * and defer the CM init until the tab is shown (avoids 0px measurement).
 */
function _openFile(id) {
  // Flush current CM content before switching
  if (IDE.cm && IDE.activeFile && IDE.files[IDE.activeFile]) {
    IDE.files[IDE.activeFile].content = IDE.cm.getValue();
  }

  IDE.activeFile = id;
  const f = IDE.files[id];
  if (!f) return;

  renderFileTree();
  renderFileTabs();

  // Check if code tab panel is actually visible
  const panel = document.getElementById('panel-code');
  const isVisible = panel && panel.classList.contains('active');

  if (!isVisible) {
    // Tab is hidden — don't init CM yet. ui.js activateTab will call IDE.cm.refresh()
    // when the tab becomes active. Just update the header breadcrumb.
    document.getElementById('ide-welcome').style.display = 'none';
    document.getElementById('ide-monaco').style.display  = '';
    return;
  }

  document.getElementById('ide-welcome').style.display = 'none';
  document.getElementById('ide-monaco').style.display  = '';
  initCM(f.content, f.language);
}

// Public alias used everywhere
function openFile(id) { _openFile(id); }

function showWelcome() {
  if (IDE.cm && IDE.activeFile && IDE.files[IDE.activeFile]) {
    IDE.files[IDE.activeFile].content = IDE.cm.getValue();
  }
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

  if (!ids.length) {
    // Remove all file items, show empty state
    Array.from(list.children).forEach(c => { if (c.id !== 'ide-empty-tree') c.remove(); });
    empty.style.display = '';
    return;
  }

  empty.style.display = 'none';
  // Remove old file items (keep ide-empty-tree in place)
  Array.from(list.children).forEach(c => { if (c.id !== 'ide-empty-tree') c.remove(); });

  ids.forEach(id => {
    const f  = IDE.files[id];
    const el = document.createElement('div');
    el.className = 'ide-file-item' + (id === IDE.activeFile ? ' active' : '');
    el.dataset.fileId = id;

    el.innerHTML =
      `<span class="ide-file-icon">${getFileIcon(f.name)}</span>` +
      `<span class="ide-file-name">${escHtml(f.name)}</span>` +
      (f.saved ? '' : `<span class="ide-file-modified" title="Unsaved changes">●</span>`) +
      `<button class="ide-file-del" data-id="${id}" title="Delete file">✕</button>`;

    // Use pointer-events on the del button and check dataset instead of classList
    el.addEventListener('click', e => {
      const delBtn = e.target.closest('.ide-file-del');
      if (delBtn) {
        ideDeleteFile(delBtn.dataset.id, e);
      } else {
        _openFile(id);
      }
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
      `<span class="ide-tab-icon">${getFileIcon(f.name)}</span>` +
      `<span class="ide-tab-name">${escHtml(f.name)}</span>` +
      (f.saved ? '' : `<span class="ide-tab-dot" title="Unsaved">●</span>`) +
      `<span class="ide-tab-close" data-id="${f.id}" title="Close">×</span>`;

    tab.addEventListener('click', e => {
      const closeBtn = e.target.closest('.ide-tab-close');
      if (closeBtn) {
        e.stopPropagation();
        _closeTab(closeBtn.dataset.id);
      } else {
        _openFile(f.id);
      }
    });

    list.appendChild(tab);
  });
}

function _closeTab(id) {
  const f = IDE.files[id];
  if (!f) return;
  // Auto-save content before closing
  if (IDE.activeFile === id && IDE.cm) {
    f.content = IDE.cm.getValue();
    f.saved   = true;
  }
  delete IDE.files[id];

  if (IDE.activeFile === id) {
    const remaining = Object.keys(IDE.files);
    remaining.length ? _openFile(remaining[remaining.length - 1]) : showWelcome();
  } else {
    renderFileTabs();
    renderFileTree();
  }
}

// ── Quick-start templates ─────────────────────────────────────────────────
async function ideQuickStart(tpl) {
  const files = TEMPLATES[tpl];
  if (!files) return;

  if (Object.keys(IDE.files).length > 0) {
    const ok = await ideModal({
      title:        'Load Template',
      message:      `Load the ${tpl} template? Files will be added to your project.`,
      confirmLabel: 'Load',
      cancelLabel:  'Cancel',
    });
    if (!ok) return;
  }

  files.forEach(f => {
    const id = crypto.randomUUID();
    IDE.files[id] = { id, name: f.name, content: f.content, language: getLang(f.name), saved: true };
  });

  renderFileTree();
  _openFile(Object.keys(IDE.files)[0]);
  toast(`${tpl} template loaded!`);
}

// ── Run code ──────────────────────────────────────────────────────────────
function ideRunCode() {
  if (!IDE.activeFile) { toast('No file open', 'error'); return; }

  const f = IDE.files[IDE.activeFile];
  if (!f) return;

  // Save and get latest content (works even if CM not initialised)
  if (IDE.cm) f.content = IDE.cm.getValue();
  f.saved = true;
  renderFileTabs();
  renderFileTree();

  const ext    = f.name.split('.').pop().toLowerCase();
  const code   = f.content || '';
  const outDiv = document.getElementById('ide-output');
  const outPre = document.getElementById('ide-output-pre');
  const frame  = document.getElementById('ide-html-frame');

  outDiv.style.display = '';

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
      outPre.textContent += a.map(x =>
        typeof x === 'object' ? JSON.stringify(x, null, 2) : String(x)
      ).join(' ') + '\n';
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
      rs:  `Build and run:\n  cargo run`,
      go:  `Run:\n  go run ${f.name}`,
      rb:  `Run:\n  ruby ${f.name}`,
      php: `Run:\n  php ${f.name}`,
    };
    outPre.textContent = hints[ext] || `Cannot run .${ext} files in the browser.\nUse the appropriate runtime.`;
  }
}

function showOutTab(tab) {
  IDE.currentOutTab = tab;
  document.querySelectorAll('.ide-out-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.out === tab)
  );
  const frame = document.getElementById('ide-html-frame');
  const pre   = document.getElementById('ide-output-pre');
  if (tab === 'preview') { frame.style.display = ''; pre.style.display   = 'none'; }
  else                   { frame.style.display = 'none'; pre.style.display = ''; }
}

// ── AI context ────────────────────────────────────────────────────────────
function getIdeContext() {
  const include = document.getElementById('ide-include-code')?.checked;
  if (!include || !IDE.activeFile) return '';

  const f = IDE.files[IDE.activeFile];
  if (!f) return '';

  // Use live editor content if CM is ready, otherwise use stored content
  const code     = IDE.cm ? IDE.cm.getValue() : (f.content || '');
  const allFiles = Object.values(IDE.files).map(fl => fl.name).join(', ');

  return (
    `\n\n[Project: ${document.getElementById('ide-project-name')?.textContent?.trim() || 'my-project'}]` +
    `\n[Files: ${allFiles}]` +
    `\n[Active file: ${f.name}]\n\`\`\`${f.language || 'text'}\n${code.slice(0, 8000)}\n\`\`\``
  );
}

// ── AI assistant ──────────────────────────────────────────────────────────
document.getElementById('ide-ai-send').addEventListener('click', ideAiSend);

document.getElementById('ide-ai-input').addEventListener('keydown', e => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); ideAiSend(); }
  // Auto-resize
  requestAnimationFrame(() => {
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  });
});

document.getElementById('ide-ai-stop').addEventListener('click', () => {
  IDE.abortIde = true;
});

document.getElementById('ide-ai-clear').addEventListener('click', () => {
  const msgs = document.getElementById('ide-ai-msgs');
  msgs.innerHTML = `
    <div class="ide-ai-welcome-msg">
      <div class="ide-ai-welcome-icon">🤖</div>
      <strong>AI Code Assistant</strong>
      <p>Chat cleared. Ask me anything about your code.</p>
    </div>`;
  IDE.aiMessages = [];
});

document.getElementById('ide-ai-close').addEventListener('click', () => {
  document.getElementById('ide-ai-panel').classList.add('hidden');
});

document.querySelectorAll('.ide-ai-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    const inp = document.getElementById('ide-ai-input');
    inp.value = chip.dataset.p || '';
    inp.style.height = 'auto';
    inp.style.height = Math.min(inp.scrollHeight, 120) + 'px';
    ideAiSend();
  });
});

async function ideAiSend() {
  if (IDE.ideBusy) return;
  const input = document.getElementById('ide-ai-input');
  const text  = input.value.trim();
  if (!text) return;

  input.value = '';
  input.style.height = 'auto';

  const msgsEl = document.getElementById('ide-ai-msgs');
  // Remove welcome + chips on first message
  msgsEl.querySelector('.ide-ai-welcome-msg')?.remove();
  msgsEl.querySelector('.ide-ai-chips')?.remove();

  addIdeMsg('user', text);
  IDE.aiMessages.push({ role: 'user', content: text });

  IDE.ideBusy  = true;
  IDE.abortIde = false;
  document.getElementById('ide-ai-send').style.display = 'none';
  document.getElementById('ide-ai-stop').style.display = '';

  const contextStr = getIdeContext();
  const sysPrompt  = [
    'You are an expert full-stack coding assistant embedded in a project IDE.',
    'Help the user write, debug, refactor, and deploy their code.',
    'Always use fenced code blocks with language identifiers.',
    'For deployment or git instructions, provide exact copy-pasteable terminal commands.',
    'When writing a complete file, write the full content.',
  ].join(' ');

  const chatMessages = [
    { role: 'system', content: sysPrompt },
    ...IDE.aiMessages.slice(-20).map((m, i, arr) => ({
      role:    m.role,
      content: m.role === 'user' && i === arr.length - 1
        ? m.content + contextStr
        : m.content,
    })),
  ];

  // Thinking indicator
  const thinkEl = document.createElement('div');
  thinkEl.className = 'ide-ai-msg assistant';
  thinkEl.innerHTML = `<div class="ide-thinking-dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>`;
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
        if (t) {
          full += t;
          bodyEl.innerHTML = renderMarkdown(full);
          msgsEl.scrollTop = msgsEl.scrollHeight;
        }
      }
    } else if (resp?.message?.content) {
      full = resp.message.content;
      bodyEl.innerHTML = renderMarkdown(full);
    } else if (typeof resp === 'string') {
      full = resp;
      bodyEl.innerHTML = renderMarkdown(full);
    }

    bodyEl.classList.remove('streaming-cursor');
    bodyEl.querySelectorAll('pre code').forEach(b => { try { hljs.highlightElement(b); } catch (_) {} });

    // "Apply to editor" button on each code block
    bodyEl.querySelectorAll('pre').forEach(pre => {
      const code = pre.querySelector('code');
      if (!code) return;
      const btn       = document.createElement('button');
      btn.className   = 'ide-apply-btn';
      btn.textContent = '⤵ Apply to editor';
      btn.title       = 'Replace editor content with this code';
      btn.addEventListener('click', () => {
        const codeText = code.textContent || '';
        if (IDE.cm) {
          IDE.cm.setValue(codeText);
        }
        if (IDE.activeFile && IDE.files[IDE.activeFile]) {
          IDE.files[IDE.activeFile].content = codeText;
          IDE.files[IDE.activeFile].saved   = false;
          renderFileTabs();
          renderFileTree();
        }
        toast('Code applied to editor ✓');
      });
      pre.style.position = 'relative';
      pre.appendChild(btn);
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

function addIdeMsg(role, text, streaming = false) {
  const msgsEl = document.getElementById('ide-ai-msgs');
  const wrap   = document.createElement('div');
  wrap.className = 'ide-ai-msg ' + role;
  if (streaming) wrap.classList.add('streaming-cursor');
  if (text) {
    if (role === 'assistant') {
      wrap.classList.add('md');
      wrap.innerHTML = renderMarkdown(text);
    } else {
      wrap.textContent = text;
    }
  }
  msgsEl.appendChild(wrap);
  msgsEl.scrollTop = msgsEl.scrollHeight;
  return wrap;
}

// ── Button wiring ─────────────────────────────────────────────────────────
document.getElementById('ide-new-btn').addEventListener('click',    () => ideNewFile());
document.getElementById('ide-upload-btn').addEventListener('click',  ideUploadFile);
document.getElementById('ide-zip-btn').addEventListener('click',     ideDownloadZip);
document.getElementById('ide-tree-new-btn').addEventListener('click',    () => ideNewFile());
document.getElementById('ide-tree-upload-btn').addEventListener('click',  ideUploadFile);
document.getElementById('ide-save-btn').addEventListener('click',    ideSaveFile);
document.getElementById('ide-dl-btn').addEventListener('click',      ideDownloadFile);
document.getElementById('ide-run-btn').addEventListener('click',     ideRunCode);

document.querySelectorAll('.ide-wlc-card[data-tpl]').forEach(card =>
  card.addEventListener('click', () => ideQuickStart(card.dataset.tpl))
);
document.querySelectorAll('.ide-tpl-chip[data-tpl]').forEach(chip =>
  chip.addEventListener('click', () => ideQuickStart(chip.dataset.tpl))
);

document.getElementById('ide-wlc-new').addEventListener('click',    () => ideNewFile());
document.getElementById('ide-wlc-upload').addEventListener('click',  ideUploadFile);

document.getElementById('ide-output-close').addEventListener('click', () => {
  document.getElementById('ide-output').style.display = 'none';
});
document.getElementById('ide-output-clear').addEventListener('click', () => {
  document.getElementById('ide-output-pre').textContent = '';
  const frame = document.getElementById('ide-html-frame');
  frame.srcdoc = ''; frame.style.display = 'none';
});
document.getElementById('ide-output-rerun')?.addEventListener('click', ideRunCode);

document.querySelectorAll('.ide-out-tab').forEach(tab =>
  tab.addEventListener('click', () => showOutTab(tab.dataset.out))
);

document.getElementById('ide-ai-toggle').addEventListener('click', () => {
  document.getElementById('ide-ai-panel').classList.toggle('hidden');
});

document.getElementById('ide-project-name')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); }
});

// ── Called from ui.js activateTab('code') to init CM after tab becomes visible ──
function ideOnTabActivated() {
  if (IDE.activeFile && IDE.files[IDE.activeFile]) {
    const f = IDE.files[IDE.activeFile];
    document.getElementById('ide-welcome').style.display = 'none';
    document.getElementById('ide-monaco').style.display  = '';
    initCM(f.content, f.language);
  }
}
