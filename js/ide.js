/**
 * ide.js — Project IDE logic
 * Simplified for New UI
 */

'use strict';

const IDE = {
  files: {},
  activeFileId: null,
  cm: null,
};

function ideOnTabActivated() {
  if (!IDE.cm) {
    const container = document.getElementById('editor-container');
    if (!container) return;
    IDE.cm = CodeMirror(container, {
      lineNumbers: true,
      theme: 'material-darker',
      mode: 'javascript',
      viewportMargin: Infinity,
      matchBrackets: true,
      autoCloseBrackets: true,
      indentUnit: 4,
      tabSize: 4,
    });

    IDE.cm.on('change', () => {
        if (IDE.activeFileId && IDE.files[IDE.activeFileId]) {
            IDE.files[IDE.activeFileId].content = IDE.cm.getValue();
            saveConvs(); // Re-using saveConvs for persistence for now
        }
    });
  }

  if (Object.keys(IDE.files).length === 0) {
      // Create a default file if none exist
      const id = crypto.randomUUID();
      IDE.files[id] = { id, name: 'main.js', content: '// Write your code here\nconsole.log("Hello NeuralDock!");' };
      IDE.activeFileId = id;
  }

  renderFileList();
  if (IDE.activeFileId) loadFile(IDE.activeFileId);
}

function renderFileList() {
    const list = document.getElementById('file-list');
    if (!list) return;
    list.innerHTML = '';

    Object.values(IDE.files).forEach(f => {
        const btn = document.createElement('div');
        btn.className = `px-3 py-1 text-[11px] font-mono cursor-pointer hover:bg-surface-elevated flex items-center gap-2 ${f.id === IDE.activeFileId ? 'text-accent bg-surface-elevated' : 'text-on-surface-variant/60'}`;
        btn.innerHTML = `<span class="material-symbols-outlined text-[14px]">description</span> ${f.name}`;
        btn.onclick = () => loadFile(f.id);
        list.appendChild(btn);
    });
}

function loadFile(id) {
    IDE.activeFileId = id;
    const f = IDE.files[id];
    if (f && IDE.cm) {
        IDE.cm.setValue(f.content || '');
        const nameEl = document.getElementById('active-file-name');
        if (nameEl) nameEl.textContent = f.name;

        const mode = getLang(f.name);
        IDE.cm.setOption('mode', mode);
    }
    renderFileList();
}

document.getElementById('ide-new-file')?.addEventListener('click', () => {
    const name = prompt('File name:', 'script.js');
    if (!name) return;
    const id = crypto.randomUUID();
    IDE.files[id] = { id, name, content: '' };
    loadFile(id);
});

document.getElementById('ide-save-btn')?.addEventListener('click', () => {
    toast('File saved ✓');
    saveConvs();
});

document.getElementById('ide-run-btn')?.addEventListener('click', () => {
    const f = IDE.files[IDE.activeFileId];
    if (!f) return;

    const output = document.getElementById('terminal-output');
    if (!output) return;

    output.textContent = `> Running ${f.name}...\n`;

    const log = (...args) => {
        output.textContent += args.join(' ') + '\n';
        output.scrollTop = output.scrollHeight;
    };

    try {
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        document.body.appendChild(iframe);
        iframe.contentWindow.console = { log, warn: log, error: log, info: log };
        iframe.contentWindow.eval(f.content);
        iframe.remove();
        log('\n[Process exited successfully]');
    } catch (err) {
        log('\n⚠ Runtime Error: ' + err.message);
    }
});

document.getElementById('clear-terminal')?.addEventListener('click', () => {
    const output = document.getElementById('terminal-output');
    if (output) output.textContent = '';
});

function getLang(name) {
  const ext = name.split('.').pop().toLowerCase();
  const map = { js: 'javascript', ts: 'javascript', py: 'python', html: 'htmlmixed', css: 'css', md: 'markdown' };
  return map[ext] || 'javascript';
}
