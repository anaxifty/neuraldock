/**
 * ide-terminal.js — In-browser terminal using xterm.js
 *
 * Features:
 *   • Proper terminal UI (xterm.js 5.x from CDN)
 *   • Runs JavaScript via sandboxed iframe — `node script.js` / `node -e "…"`
 *   • Basic shell commands: clear, echo, ls, cat, pwd, help, open
 *   • `puter open` — launches the real Puter Terminal overlay
 *   • Command history (↑/↓)
 *   • Colour-coded output (green=ok, red=error, yellow=warning)
 *
 * Depends on: xterm.js CDN (added to index.html), ide.js (IDE object)
 */

(function () {
  'use strict';

  // ── xterm.js CDN loader ──────────────────────────────────────────────────
  function loadXterm() {
    return new Promise((resolve, reject) => {
      if (window.Terminal) { resolve(); return; }

      const link = document.createElement('link');
      link.rel  = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/npm/xterm@5.3.0/css/xterm.css';
      document.head.appendChild(link);

      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/xterm@5.3.0/lib/xterm.js';
      s.onload  = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function loadFitAddon() {
    return new Promise((resolve, reject) => {
      if (window.FitAddon) { resolve(); return; }
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@xterm/addon-fit@0.10.0/lib/addon-fit.js';
      s.onload  = resolve;
      s.onerror = () => resolve(); // non-critical
      document.head.appendChild(s);
    });
  }

  // ── Shell state ───────────────────────────────────────────────────────────
  let term       = null;
  let fitAddon   = null;
  let inputBuf   = '';
  let cmdHistory = [];
  let histIdx    = -1;
  let _termInited = false;

  const PROMPT = '\r\n\x1b[38;5;178m❯\x1b[0m ';
  const PROJECT = () => (window.IDE?.projectName || 'my-project');
  const CWD     = () => `~/NeuralDock-IDE/${PROJECT()}`;

  // ── Colour helpers ────────────────────────────────────────────────────────
  const C = {
    reset:  s => `\x1b[0m${s}\x1b[0m`,
    green:  s => `\x1b[32m${s}\x1b[0m`,
    yellow: s => `\x1b[33m${s}\x1b[0m`,
    red:    s => `\x1b[31m${s}\x1b[0m`,
    cyan:   s => `\x1b[36m${s}\x1b[0m`,
    dim:    s => `\x1b[2m${s}\x1b[0m`,
    bold:   s => `\x1b[1m${s}\x1b[0m`,
    gold:   s => `\x1b[38;5;178m${s}\x1b[0m`,
  };

  function writeln(text = '') { term.writeln(text); }
  function prompt()           { term.write(PROMPT); inputBuf = ''; histIdx = -1; }

  // ── Built-in commands ─────────────────────────────────────────────────────
  const COMMANDS = {
    help() {
      writeln('');
      writeln(C.bold('  NeuralDock Terminal — Available Commands'));
      writeln(C.dim('  ─────────────────────────────────────────'));
      writeln(`  ${C.cyan('help')}            Show this help`);
      writeln(`  ${C.cyan('clear')}           Clear the terminal`);
      writeln(`  ${C.cyan('ls')}              List project files`);
      writeln(`  ${C.cyan('cat <file>')}      Print file contents`);
      writeln(`  ${C.cyan('pwd')}             Print working directory`);
      writeln(`  ${C.cyan('echo <text>')}     Print text`);
      writeln(`  ${C.cyan('node -e "<js>"')}  Run JavaScript inline`);
      writeln(`  ${C.cyan('node <file>')}     Run a .js file from project`);
      writeln(`  ${C.cyan('open')}            Open Puter Terminal (full shell)`);
      writeln(`  ${C.cyan('puter')}           Open Puter Terminal (full shell)`);
      writeln('');
      writeln(C.dim('  Tip: Use the Puter Terminal for Python, npm, git, etc.'));
    },

    clear() { term.clear(); },

    ls(args) {
      const files = Object.values(window.IDE?.files || {});
      if (!files.length) { writeln(C.yellow('  (no files in project)')); return; }
      writeln('');
      files.forEach(f => writeln(`  ${C.green(f.name)}  ${C.dim(f.saved ? '✓' : '●')}`));
    },

    pwd() { writeln(`\r\n  ${CWD()}`); },

    echo(args) { writeln('\r\n  ' + args.join(' ')); },

    cat(args) {
      const name = args[0];
      if (!name) { writeln(C.red('\r\n  Usage: cat <filename>')); return; }
      const f = Object.values(window.IDE?.files || {}).find(f => f.name === name);
      if (!f) { writeln(C.red(`\r\n  cat: ${name}: No such file`)); return; }
      const content = (window.IDE?.cm && window.IDE.activeFile === f.id)
        ? window.IDE.cm.getValue()
        : f.content;
      writeln('');
      content.split('\n').forEach((line, i) => {
        term.writeln(`  ${C.dim((i + 1).toString().padStart(3, ' '))}  ${line}`);
      });
    },

    node(args) {
      if (args[0] === '-e' && args[1]) {
        _runJs(args.slice(1).join(' '));
        return;
      }
      const name = args[0];
      if (!name) { writeln(C.red('\r\n  Usage: node <file> or node -e "<js>"')); return; }
      const f = Object.values(window.IDE?.files || {}).find(f => f.name === name);
      if (!f) { writeln(C.red(`\r\n  node: ${name}: No such file`)); return; }
      const content = (window.IDE?.cm && window.IDE.activeFile === f.id)
        ? window.IDE.cm.getValue()
        : f.content;
      _runJs(content, name);
    },

    open: _openPuterTerm,
    puter: _openPuterTerm,

    // Friendly messages for unsupported runtimes
    python(args)  { _notSupported('Python', 'python ' + args.join(' ')); },
    python3(args) { _notSupported('Python 3', 'python3 ' + args.join(' ')); },
    pip(args)     { _notSupported('pip', 'pip ' + args.join(' ')); },
    npm(args)     { _notSupported('npm', 'npm ' + args.join(' ')); },
    npx(args)     { _notSupported('npx', 'npx ' + args.join(' ')); },
    git(args)     { _notSupported('git', 'git ' + args.join(' ')); },
    cargo(args)   { _notSupported('cargo', 'cargo ' + args.join(' ')); },
    go(args)      { _notSupported('go', 'go ' + args.join(' ')); },
  };

  function _notSupported(runtime, cmd) {
    writeln('');
    writeln(C.yellow(`  ${runtime} is not available in the browser terminal.`));
    writeln(`  Run ${C.cyan(`\`${cmd}\``)} in the ${C.bold('Puter Terminal')} instead.`);
    writeln(`  Type ${C.cyan('open')} to launch it.`);
  }

  function _openPuterTerm() {
    writeln('');
    writeln(C.green('  Launching Puter Terminal…'));
    writeln(C.dim(`  Your files are at: ${CWD()}`));
    try {
      puter.ui.launchApp('terminal');
    } catch(e) {
      writeln(C.yellow('  Puter UI not available — opening in new tab.'));
      window.open('https://puter.com/app/terminal', '_blank');
    }
  }

  // ── JavaScript runner ─────────────────────────────────────────────────────
  function _runJs(code, label) {
    writeln('');
    if (label) writeln(C.dim(`  ▶ Running ${label}…`));
    const logs = [];

    try {
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      document.body.appendChild(iframe);
      const iw = iframe.contentWindow;

      const mkLog = type => (...args) => {
        const line = args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ');
        logs.push({ type, line });
      };

      iw.console = {
        log:   mkLog('log'),
        warn:  mkLog('warn'),
        error: mkLog('error'),
        info:  mkLog('info'),
        debug: mkLog('debug'),
      };

      iw.eval(code);
      iframe.remove();

      if (!logs.length) {
        writeln(C.dim('  (no output)'));
      } else {
        logs.forEach(({ type, line }) => {
          const colored = type === 'error' ? C.red(line)
                        : type === 'warn'  ? C.yellow(line)
                        : line;
          line.split('\n').forEach(l => writeln('  ' + colored));
        });
      }
    } catch(err) {
      writeln(C.red(`  ⚠ ${err.constructor.name}: ${err.message}`));
      if (err.stack) {
        const frames = err.stack.split('\n').slice(1, 3);
        frames.forEach(f => writeln(C.dim('  ' + f.trim())));
      }
    }
  }

  // ── Command executor ──────────────────────────────────────────────────────
  function exec(raw) {
    const trimmed = raw.trim();
    if (!trimmed) { prompt(); return; }

    // History
    if (cmdHistory[0] !== trimmed) cmdHistory.unshift(trimmed);
    if (cmdHistory.length > 50) cmdHistory.pop();
    histIdx = -1;

    const parts  = trimmed.split(/\s+/);
    const cmd    = parts[0].toLowerCase();
    const args   = parts.slice(1);

    writeln(''); // newline after input

    if (COMMANDS[cmd]) {
      COMMANDS[cmd](args);
    } else {
      writeln(C.red(`  command not found: ${cmd}`));
      writeln(C.dim(`  Type ${C.cyan('help')} for available commands.`));
    }

    prompt();
  }

  // ── Keyboard input handler ────────────────────────────────────────────────
  function handleKey({ key, domEvent }) {
    const code = domEvent.keyCode;

    if (domEvent.key === 'Enter') {
      exec(inputBuf);
      return;
    }

    if (domEvent.key === 'Backspace') {
      if (inputBuf.length > 0) {
        inputBuf = inputBuf.slice(0, -1);
        term.write('\b \b');
      }
      return;
    }

    // History navigation
    if (domEvent.key === 'ArrowUp') {
      if (histIdx < cmdHistory.length - 1) {
        histIdx++;
        _replaceInput(cmdHistory[histIdx]);
      }
      return;
    }
    if (domEvent.key === 'ArrowDown') {
      if (histIdx > 0) {
        histIdx--;
        _replaceInput(cmdHistory[histIdx]);
      } else if (histIdx === 0) {
        histIdx = -1;
        _replaceInput('');
      }
      return;
    }

    // Tab completion
    if (domEvent.key === 'Tab') {
      domEvent.preventDefault();
      _tabComplete();
      return;
    }

    // Ctrl+C
    if (domEvent.ctrlKey && domEvent.key === 'c') {
      term.write('^C');
      inputBuf = '';
      prompt();
      return;
    }

    // Ctrl+L = clear
    if (domEvent.ctrlKey && domEvent.key === 'l') {
      term.clear();
      prompt();
      return;
    }

    // Printable chars
    if (key && !domEvent.ctrlKey && !domEvent.altKey && !domEvent.metaKey) {
      inputBuf += key;
      term.write(key);
    }
  }

  function _replaceInput(text) {
    // Erase current input
    term.write('\r' + PROMPT + ' '.repeat(inputBuf.length) + '\r' + PROMPT);
    inputBuf = text;
    term.write(text);
  }

  function _tabComplete() {
    if (!inputBuf) return;
    const parts  = inputBuf.split(' ');
    const last   = parts[parts.length - 1];
    const files  = Object.values(window.IDE?.files || {}).map(f => f.name);
    const cmds   = Object.keys(COMMANDS);
    const pool   = parts.length === 1 ? [...cmds, ...files] : files;
    const matches = pool.filter(s => s.startsWith(last));
    if (matches.length === 1) {
      const completion = matches[0].slice(last.length);
      inputBuf += completion;
      term.write(completion);
    } else if (matches.length > 1) {
      writeln('');
      writeln('  ' + matches.join('  '));
      prompt();
      term.write(inputBuf);
    }
  }

  // ── Init terminal in a container ──────────────────────────────────────────
  async function buildTerminal(containerEl) {
    if (_termInited && term) {
      // Already built — just refit
      try { fitAddon?.fit(); } catch(_) {}
      term.focus();
      return;
    }

    containerEl.innerHTML = `<div id="ide-xterm-container" style="width:100%;height:100%;padding:4px 0;box-sizing:border-box;"></div>`;

    try {
      await loadXterm();
      await loadFitAddon();
    } catch(e) {
      containerEl.innerHTML = `
        <div class="ide-term-placeholder">
          <div class="ide-term-ph-icon">⬛</div>
          <p>Could not load terminal library. <button class="ide-tool-btn" id="ide-term-fallback-open">Open Puter Terminal ↗</button></p>
        </div>`;
      document.getElementById('ide-term-fallback-open')?.addEventListener('click', () => {
        try { puter.ui.launchApp('terminal'); } catch(_) { window.open('https://puter.com/app/terminal','_blank'); }
      });
      return;
    }

    _termInited = true;

    term = new window.Terminal({
      theme: {
        background:  '#0a0b0c',
        foreground:  '#e8e2d9',
        cursor:      '#d4a853',
        cursorAccent:'#0c0e0f',
        black:       '#1a1c1e',
        red:         '#e07070',
        green:       '#4caf82',
        yellow:      '#d4a853',
        blue:        '#61afef',
        magenta:     '#c678dd',
        cyan:        '#56b6c2',
        white:       '#e8e2d9',
        brightBlack: '#3a3d40',
      },
      fontFamily:  "'DM Mono', 'Cascadia Code', 'Fira Code', monospace",
      fontSize:    13,
      lineHeight:  1.5,
      cursorBlink: true,
      cursorStyle: 'bar',
      scrollback:  2000,
      allowTransparency: false,
    });

    if (window.FitAddon) {
      fitAddon = new window.FitAddon.FitAddon();
      term.loadAddon(fitAddon);
    }

    const xtermEl = document.getElementById('ide-xterm-container');
    term.open(xtermEl);
    try { fitAddon?.fit(); } catch(_) {}

    // Re-fit on resize
    const ro = new ResizeObserver(() => {
      try { fitAddon?.fit(); } catch(_) {}
      if (window.IDE?.cm) window.IDE.cm.refresh();
    });
    ro.observe(containerEl);

    term.onKey(handleKey);

    // Welcome banner
    term.writeln(C.gold('  ██╗  ██╗███████╗██╗   ██╗██████╗  █████╗ ██╗      ██████╗  ██████╗ ██╗  ██╗'));
    term.writeln(C.dim('  NeuralDock Terminal — JavaScript shell + Puter launcher'));
    term.writeln(C.dim(`  Project: ${C.cyan(PROJECT())}   Path: ${C.dim(CWD())}`));
    term.writeln(C.dim('  Type ' + C.cyan('help') + ' for commands  ·  Type ' + C.cyan('open') + ' for the real Puter shell'));
    prompt();
    term.focus();
  }

  // ── Expose to ide.js ──────────────────────────────────────────────────────
  window.buildIdeTerminal    = buildTerminal;
  window._buildTerminal      = buildTerminal; // alias used by ide-panels.js

  // Patch ide.js's toggleTerminal to use our builder
  const _earlyToggle = window.toggleTerminal;
  window.toggleTerminal = function () {
    const termPanel = document.getElementById('ide-terminal-panel');
    if (!termPanel) { if (_earlyToggle) _earlyToggle(); return; }

    // Delegate open/close to ide-panels.js
    const nowOpen = typeof window.panelsToggleTerm === 'function'
      ? window.panelsToggleTerm()
      : (termPanel.style.display === 'none' ? true : false);

    if (nowOpen && !termPanel.dataset.termBuilt) {
      termPanel.dataset.termBuilt = '1';
      const body = document.getElementById('ide-term-body');
      if (body) buildTerminal(body);
    }

    if (nowOpen) {
      requestAnimationFrame(() => { try { fitAddon?.fit(); term?.focus(); } catch(_) {} });
    }
  };

  // Also expose for direct calls
  window.ideTermBuild = buildTerminal;

})();
