/**
 * ide-panels.js — Resizable & collapsible IDE panels
 *
 * Panels managed:
 *   • ide-explorer   (left)   — drag right edge, toggle with #ide-toggle-explorer
 *   • ide-ai-panel   (right)  — drag left edge,  toggle with #ide-toggle-ai
 *   • ide-output     (bottom, center col) — drag top edge,  toggle with #ide-toggle-output
 *   • ide-terminal-panel (bottom, center col) — drag top edge, toggle with #ide-terminal-btn
 *
 * Sizes are stored as CSS custom properties on .ide-layout and persisted
 * to localStorage under the key "nd_ide_panels".
 *
 * Load order: after ide.js, before closing </body>
 */

(function () {
  'use strict';

  // ── Defaults ────────────────────────────────────────────────────────────
  const DEFAULTS = {
    explorerW:  220,   // px
    aiW:        320,   // px
    outputH:    240,   // px
    termH:      280,   // px
    explorerOpen: true,
    aiOpen:       true,
    outputOpen:   false,
    termOpen:     false,
  };

  const MIN = { explorerW: 140, aiW: 220, outputH: 100, termH: 120 };
  const MAX = { explorerW: 480, aiW: 560, outputH: 600, termH: 500 };

  // ── State ────────────────────────────────────────────────────────────────
  let P = { ...DEFAULTS };

  function load() {
    try {
      const raw = localStorage.getItem('nd_ide_panels');
      if (raw) P = { ...DEFAULTS, ...JSON.parse(raw) };
    } catch(_) {}
  }

  function save() {
    try { localStorage.setItem('nd_ide_panels', JSON.stringify(P)); } catch(_) {}
  }

  // ── Apply sizes to DOM ───────────────────────────────────────────────────
  function applyAll() {
    const layout   = document.getElementById('ide-layout-root') || document.querySelector('.ide-layout');
    const explorer = document.getElementById('ide-explorer');
    const aiPanel  = document.getElementById('ide-ai-panel');
    const output   = document.getElementById('ide-output');
    const term     = document.getElementById('ide-terminal-panel');

    if (explorer) {
      if (P.explorerOpen) {
        explorer.style.width    = P.explorerW + 'px';
        explorer.style.minWidth = P.explorerW + 'px';
        explorer.classList.remove('ide-panel-hidden');
      } else {
        explorer.classList.add('ide-panel-hidden');
      }
    }

    if (aiPanel) {
      if (P.aiOpen) {
        aiPanel.style.width    = P.aiW + 'px';
        aiPanel.style.minWidth = P.aiW + 'px';
        aiPanel.classList.remove('ide-panel-hidden', 'hidden');
      } else {
        aiPanel.classList.add('ide-panel-hidden');
        aiPanel.classList.remove('hidden');
      }
    }

    if (output) {
      if (P.outputOpen) {
        output.style.height  = P.outputH + 'px';
        output.style.display = 'flex';
        output.classList.remove('ide-panel-hidden');
      } else {
        output.style.display = 'none';
      }
    }

    if (term) {
      if (P.termOpen) {
        term.style.height  = P.termH + 'px';
        term.style.display = 'flex';
        term.classList.remove('ide-panel-hidden');
      } else {
        term.style.display = 'none';
      }
    }

    refreshToggleBtns();
    deferCMRefresh();
  }

  function deferCMRefresh() {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (window.IDE?.cm) window.IDE.cm.refresh();
    }));
  }

  // ── Toggle buttons state ─────────────────────────────────────────────────
  function refreshToggleBtns() {
    _setActive('ide-toggle-explorer', P.explorerOpen);
    _setActive('ide-toggle-ai',       P.aiOpen);
    _setActive('ide-toggle-output',   P.outputOpen);
    _setActive('ide-terminal-btn',    P.termOpen);
  }

  function _setActive(id, active) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle('ide-panel-btn-active', active);
    const label = el.querySelector('.ide-panel-btn-label');
    if (label) label.style.opacity = active ? '1' : '0.55';
  }

  // ── Toggle panel open/closed ─────────────────────────────────────────────
  function toggleExplorer() {
    P.explorerOpen = !P.explorerOpen;
    applyAll();
    save();
  }

  function toggleAiPanel() {
    P.aiOpen = !P.aiOpen;
    applyAll();
    save();
  }

  function toggleOutput() {
    P.outputOpen = !P.outputOpen;
    applyAll();
    save();
  }

  // Public: called from ide.js toggleTerminal()
  window.panelsToggleTerm = function () {
    P.termOpen = !P.termOpen;
    applyAll();
    save();
    return P.termOpen;
  };

  // ── Drag-resize engine ───────────────────────────────────────────────────
  function makeDragHandle(handleEl, axis, onMove) {
    if (!handleEl) return;
    let startX, startY, startVal;

    handleEl.addEventListener('mousedown', e => {
      e.preventDefault();
      startX = e.clientX;
      startY = e.clientY;
      startVal = axis === 'x' ? P.explorerW : 0; // set per use-site

      document.body.classList.add('ide-dragging-' + axis);

      function onMouseMove(ev) { onMove(ev, startX, startY); }
      function onMouseUp() {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup',  onMouseUp);
        document.body.classList.remove('ide-dragging-x', 'ide-dragging-y');
        save();
        deferCMRefresh();
      }
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup',   onMouseUp);
    });
  }

  // ── Register all handles ─────────────────────────────────────────────────
  function registerHandles() {
    // Explorer right edge
    const exHandle = document.getElementById('ide-explorer-handle');
    if (exHandle) {
      let startX, startW;
      exHandle.addEventListener('mousedown', e => {
        e.preventDefault();
        startX = e.clientX;
        startW = P.explorerW;
        document.body.classList.add('ide-dragging-x');
        const move = ev => {
          const delta = ev.clientX - startX;
          P.explorerW = Math.max(MIN.explorerW, Math.min(MAX.explorerW, startW + delta));
          const ex = document.getElementById('ide-explorer');
          if (ex) { ex.style.width = P.explorerW + 'px'; ex.style.minWidth = P.explorerW + 'px'; }
          deferCMRefresh();
        };
        const up = () => {
          document.removeEventListener('mousemove', move);
          document.removeEventListener('mouseup', up);
          document.body.classList.remove('ide-dragging-x');
          save();
        };
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', up);
      });
    }

    // AI panel left edge
    const aiHandle = document.getElementById('ide-ai-handle');
    if (aiHandle) {
      let startX, startW;
      aiHandle.addEventListener('mousedown', e => {
        e.preventDefault();
        startX = e.clientX;
        startW = P.aiW;
        document.body.classList.add('ide-dragging-x');
        const move = ev => {
          const delta = startX - ev.clientX;  // drag left = wider
          P.aiW = Math.max(MIN.aiW, Math.min(MAX.aiW, startW + delta));
          const ai = document.getElementById('ide-ai-panel');
          if (ai) { ai.style.width = P.aiW + 'px'; ai.style.minWidth = P.aiW + 'px'; }
          deferCMRefresh();
        };
        const up = () => {
          document.removeEventListener('mousemove', move);
          document.removeEventListener('mouseup', up);
          document.body.classList.remove('ide-dragging-x');
          save();
        };
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', up);
      });
    }

    // Output top edge
    const outHandle = document.getElementById('ide-output-handle');
    if (outHandle) {
      let startY, startH;
      outHandle.addEventListener('mousedown', e => {
        e.preventDefault();
        startY = e.clientY;
        startH = P.outputH;
        document.body.classList.add('ide-dragging-y');
        const move = ev => {
          const delta = startY - ev.clientY;  // drag up = taller
          P.outputH = Math.max(MIN.outputH, Math.min(MAX.outputH, startH + delta));
          const out = document.getElementById('ide-output');
          if (out) out.style.height = P.outputH + 'px';
        };
        const up = () => {
          document.removeEventListener('mousemove', move);
          document.removeEventListener('mouseup', up);
          document.body.classList.remove('ide-dragging-y');
          save();
          deferCMRefresh();
        };
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', up);
      });
    }

    // Terminal top edge
    const termHandle = document.getElementById('ide-term-resize');
    if (termHandle) {
      let startY, startH;
      termHandle.addEventListener('mousedown', e => {
        e.preventDefault();
        startY = e.clientY;
        startH = P.termH;
        document.body.classList.add('ide-dragging-y');
        const move = ev => {
          const delta = startY - ev.clientY;
          P.termH = Math.max(MIN.termH, Math.min(MAX.termH, startH + delta));
          const term = document.getElementById('ide-terminal-panel');
          if (term) term.style.height = P.termH + 'px';
        };
        const up = () => {
          document.removeEventListener('mousemove', move);
          document.removeEventListener('mouseup', up);
          document.body.classList.remove('ide-dragging-y');
          save();
          deferCMRefresh();
        };
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', up);
      });
    }
  }

  // ── Wire toggle buttons ──────────────────────────────────────────────────
  function wireToggles() {
    document.getElementById('ide-toggle-explorer')?.addEventListener('click', toggleExplorer);
    document.getElementById('ide-toggle-ai')?.addEventListener('click',       toggleAiPanel);
    document.getElementById('ide-toggle-output')?.addEventListener('click',   toggleOutput);

    // Terminal toggle is now handled via panelsToggleTerm() called from ide.js
    // But we also wire the close button inside the terminal panel
    document.getElementById('ide-terminal-close')?.addEventListener('click', () => {
      P.termOpen = false;
      applyAll();
      save();
    });

    // Output close button (already exists in HTML)
    document.getElementById('ide-output-close')?.addEventListener('click', () => {
      P.outputOpen = false;
      applyAll();
      save();
    });

    // When ide.js runs code and sets output display:flex, sync our state
    const origRun = window.ideRunCode;
    if (typeof origRun === 'function') {
      window.ideRunCode = function() {
        origRun.apply(this, arguments);
        P.outputOpen = true;
        refreshToggleBtns();
        save();
      };
    }
  }

  // ── Public API ───────────────────────────────────────────────────────────
  window.idePanels = { toggleExplorer, toggleAiPanel, toggleOutput, applyAll };

  // ── Init ─────────────────────────────────────────────────────────────────
  function init() {
    load();
    applyAll();
    registerHandles();
    wireToggles();

    // Sync when ide.js calls toggleTerminal (override it to use our state)
    const _origToggleTerm = window.toggleTerminal;
    window.toggleTerminal = function () {
      const nowOpen = window.panelsToggleTerm();
      // If ide.js has _buildTerminal, call it on first open
      if (nowOpen && typeof window._buildTerminal === 'function') {
        const body = document.getElementById('ide-term-body');
        if (body && !document.getElementById('ide-terminal-panel').dataset.loaded) {
          document.getElementById('ide-terminal-panel').dataset.loaded = '1';
          window._buildTerminal(body);
        }
      }
    };

    // Re-apply on window resize to keep CodeMirror sharp
    window.addEventListener('resize', deferCMRefresh);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // Scripts load after DOMContentLoaded in this app
    setTimeout(init, 0);
  }
})();
