/**
 * theme.js — Comprehensive theming system for NeuralDock
 *
 * WHAT THIS FILE DOES:
 *   - Defines 10 colour themes, 6 UI fonts, 6 heading fonts
 *   - Handles density, border radius, background texture, chat bubble style
 *   - Applies everything via CSS custom properties on <html> — zero layout risk
 *   - Lazy-loads Google Fonts only when selected
 *   - Rebuilds the Appearance section of the settings page with full UI
 *
 * ZERO RISK GUARANTEE:
 *   All changes go through document.documentElement.style.setProperty() and
 *   data-* attributes. Nothing in this file touches existing DOM structure,
 *   event listeners, or logic from other modules.
 *
 * Depends on: state.js (S, saveSettings), utils.js (toast, setFontSize)
 */

'use strict';

// ── Theme colour palettes ─────────────────────────────────────────────────
const THEMES = {
  'dark-gold': {
    label: 'Dark Gold', emoji: '✦',
    preview: { bg: '#0c0e0f', accent: '#d4a853', surface: '#141618' },
    vars: {
      '--bg':          '#0c0e0f',
      '--surface':     '#141618',
      '--surface2':    '#1a1c1e',
      '--border':      '#222527',
      '--border-focus':'#3a3d40',
      '--accent':      '#d4a853',
      '--accent2':     '#8b6b35',
      '--accent-dim':  'rgba(212,168,83,.1)',
      '--text':        '#e8e2d9',
      '--muted':       '#6b6560',
      '--err':         '#e07070',
      '--ok':          '#4caf82',
    },
  },
  'ocean': {
    label: 'Ocean', emoji: '◈',
    preview: { bg: '#060d1a', accent: '#38bdf8', surface: '#0c1525' },
    vars: {
      '--bg':          '#060d1a',
      '--surface':     '#0c1525',
      '--surface2':    '#121e30',
      '--border':      '#1a2a3d',
      '--border-focus':'#2a4060',
      '--accent':      '#38bdf8',
      '--accent2':     '#0284c7',
      '--accent-dim':  'rgba(56,189,248,.1)',
      '--text':        '#e2eeff',
      '--muted':       '#4a6a8a',
      '--err':         '#f87171',
      '--ok':          '#34d399',
    },
  },
  'forest': {
    label: 'Forest', emoji: '◉',
    preview: { bg: '#060e08', accent: '#4ade80', surface: '#0c1810' },
    vars: {
      '--bg':          '#060e08',
      '--surface':     '#0c1810',
      '--surface2':    '#101e14',
      '--border':      '#182a1e',
      '--border-focus':'#28503a',
      '--accent':      '#4ade80',
      '--accent2':     '#16a34a',
      '--accent-dim':  'rgba(74,222,128,.1)',
      '--text':        '#e2f0e8',
      '--muted':       '#4a6a52',
      '--err':         '#f87171',
      '--ok':          '#4ade80',
    },
  },
  'midnight': {
    label: 'Midnight', emoji: '⬡',
    preview: { bg: '#06040f', accent: '#a78bfa', surface: '#0e0b1e' },
    vars: {
      '--bg':          '#06040f',
      '--surface':     '#0e0b1e',
      '--surface2':    '#130f28',
      '--border':      '#1f1840',
      '--border-focus':'#362d6a',
      '--accent':      '#a78bfa',
      '--accent2':     '#7c3aed',
      '--accent-dim':  'rgba(167,139,250,.1)',
      '--text':        '#ede8ff',
      '--muted':       '#5a4a7a',
      '--err':         '#f87171',
      '--ok':          '#34d399',
    },
  },
  'rose': {
    label: 'Rose', emoji: '⊛',
    preview: { bg: '#0f0608', accent: '#fb7185', surface: '#1a0c10' },
    vars: {
      '--bg':          '#0f0608',
      '--surface':     '#1a0c10',
      '--surface2':    '#221015',
      '--border':      '#361820',
      '--border-focus':'#5c2838',
      '--accent':      '#fb7185',
      '--accent2':     '#be123c',
      '--accent-dim':  'rgba(251,113,133,.1)',
      '--text':        '#ffe4e8',
      '--muted':       '#6a4048',
      '--err':         '#fb7185',
      '--ok':          '#34d399',
    },
  },
  'carbon': {
    label: 'Carbon', emoji: '◼',
    preview: { bg: '#080808', accent: '#e4e4e7', surface: '#111111' },
    vars: {
      '--bg':          '#080808',
      '--surface':     '#111111',
      '--surface2':    '#181818',
      '--border':      '#242424',
      '--border-focus':'#383838',
      '--accent':      '#e4e4e7',
      '--accent2':     '#a1a1aa',
      '--accent-dim':  'rgba(228,228,231,.08)',
      '--text':        '#fafafa',
      '--muted':       '#525252',
      '--err':         '#f87171',
      '--ok':          '#4ade80',
    },
  },
  'nord': {
    label: 'Nord', emoji: '⬙',
    preview: { bg: '#2e3440', accent: '#88c0d0', surface: '#3b4252' },
    vars: {
      '--bg':          '#2e3440',
      '--surface':     '#3b4252',
      '--surface2':    '#434c5e',
      '--border':      '#4c566a',
      '--border-focus':'#616e88',
      '--accent':      '#88c0d0',
      '--accent2':     '#5e81ac',
      '--accent-dim':  'rgba(136,192,208,.1)',
      '--text':        '#eceff4',
      '--muted':       '#7a8698',
      '--err':         '#bf616a',
      '--ok':          '#a3be8c',
    },
  },
  'amber': {
    label: 'Amber', emoji: '◈',
    preview: { bg: '#0a0800', accent: '#f59e0b', surface: '#141000' },
    vars: {
      '--bg':          '#0a0800',
      '--surface':     '#141000',
      '--surface2':    '#1e1800',
      '--border':      '#2a2000',
      '--border-focus':'#453500',
      '--accent':      '#f59e0b',
      '--accent2':     '#b45309',
      '--accent-dim':  'rgba(245,158,11,.1)',
      '--text':        '#fef3c7',
      '--muted':       '#6a5a30',
      '--err':         '#f87171',
      '--ok':          '#34d399',
    },
  },
  'slate': {
    label: 'Slate', emoji: '▣',
    preview: { bg: '#0f172a', accent: '#94a3b8', surface: '#1e293b' },
    vars: {
      '--bg':          '#0f172a',
      '--surface':     '#1e293b',
      '--surface2':    '#263448',
      '--border':      '#334155',
      '--border-focus':'#475569',
      '--accent':      '#94a3b8',
      '--accent2':     '#64748b',
      '--accent-dim':  'rgba(148,163,184,.1)',
      '--text':        '#f1f5f9',
      '--muted':       '#64748b',
      '--err':         '#f87171',
      '--ok':          '#4ade80',
    },
  },
  'light': {
    label: 'Light', emoji: '◯', isLight: true,
    preview: { bg: '#f5f2ee', accent: '#c8860a', surface: '#faf8f5' },
    vars: {
      '--bg':          '#f5f2ee',
      '--surface':     '#faf8f5',
      '--surface2':    '#ede9e3',
      '--border':      '#d4cdc4',
      '--border-focus':'#b8af9e',
      '--accent':      '#c8860a',
      '--accent2':     '#9a6508',
      '--accent-dim':  'rgba(200,134,10,.1)',
      '--text':        '#2a2520',
      '--muted':       '#8a7e72',
      '--err':         '#c0392b',
      '--ok':          '#2e7d52',
    },
  },
};

// ── Font registry ─────────────────────────────────────────────────────────
const UI_FONTS = {
  'dm-mono':     { label: 'DM Mono',        family: "'DM Mono', monospace",        googleId: null,                                               sample: 'fn run() → 42' },
  'jetbrains':   { label: 'JetBrains Mono', family: "'JetBrains Mono', monospace", googleId: 'JetBrains+Mono:wght@400;500',                      sample: 'fn run() → 42' },
  'fira-code':   { label: 'Fira Code',      family: "'Fira Code', monospace",      googleId: 'Fira+Code:wght@400;500',                           sample: 'fn run() → 42' },
  'ibm-plex':    { label: 'IBM Plex Mono',  family: "'IBM Plex Mono', monospace",  googleId: 'IBM+Plex+Mono:wght@400;500',                       sample: 'fn run() → 42' },
  'space-mono':  { label: 'Space Mono',     family: "'Space Mono', monospace",     googleId: 'Space+Mono:ital,wght@0,400;0,700',                 sample: 'fn run() → 42' },
  'inconsolata': { label: 'Inconsolata',    family: "'Inconsolata', monospace",    googleId: 'Inconsolata:wght@400;500',                         sample: 'fn run() → 42' },
};

const HEADING_FONTS = {
  'fraunces':    { label: 'Fraunces',           family: "'Fraunces', serif",           googleId: null,                                            sample: 'NeuralDock' },
  'playfair':    { label: 'Playfair Display',   family: "'Playfair Display', serif",   googleId: 'Playfair+Display:wght@400;600',                 sample: 'NeuralDock' },
  'dm-serif':    { label: 'DM Serif Display',   family: "'DM Serif Display', serif",   googleId: 'DM+Serif+Display',                              sample: 'NeuralDock' },
  'cormorant':   { label: 'Cormorant Garamond', family: "'Cormorant Garamond', serif", googleId: 'Cormorant+Garamond:ital,wght@0,300;0,600;1,300',sample: 'NeuralDock' },
  'lora':        { label: 'Lora',               family: "'Lora', serif",               googleId: 'Lora:ital,wght@0,400;0,600;1,400',              sample: 'NeuralDock' },
  'libre':       { label: 'Libre Baskerville',  family: "'Libre Baskerville', serif",  googleId: 'Libre+Baskerville:ital,wght@0,400;0,700;1,400', sample: 'NeuralDock' },
};

const _loadedFonts = new Set(['dm-mono', 'fraunces']); // already in HTML <link>

// ── Apply functions — all work via CSS custom props, zero layout risk ──────

function applyTheme(themeId) {
  const theme = THEMES[themeId];
  if (!theme) return;
  const root = document.documentElement;
  root.setAttribute('data-theme', themeId);
  Object.entries(theme.vars).forEach(([k, v]) => root.style.setProperty(k, v));
  // Light theme needs inverted grid overlay and body text
  if (theme.isLight) {
    root.setAttribute('data-light-theme', '1');
  } else {
    root.removeAttribute('data-light-theme');
  }
}

function applyFontUi(fontId) {
  const font = UI_FONTS[fontId];
  if (!font) return;
  document.documentElement.setAttribute('data-font-ui', fontId);
  document.documentElement.style.setProperty('--font-ui', font.family);
  if (font.googleId && !_loadedFonts.has(fontId)) {
    _loadedFonts.add(fontId);
    _injectGoogleFont(font.googleId);
  }
}

function applyFontHead(fontId) {
  const font = HEADING_FONTS[fontId];
  if (!font) return;
  document.documentElement.setAttribute('data-font-head', fontId);
  document.documentElement.style.setProperty('--font-head', font.family);
  if (font.googleId && !_loadedFonts.has(fontId)) {
    _loadedFonts.add(fontId);
    _injectGoogleFont(font.googleId);
  }
}

function applyDensity(density) {
  document.documentElement.setAttribute('data-density', density);
}

function applyRadius(radius) {
  const radiusMap = { sharp: '2px', default: '10px', pill: '20px' };
  document.documentElement.setAttribute('data-radius', radius);
  if (radiusMap[radius]) {
    document.documentElement.style.setProperty('--radius', radiusMap[radius]);
  }
}

function applyBgTexture(texture) {
  document.documentElement.setAttribute('data-bg-texture', texture);
}

function applyBubbleStyle(style) {
  document.documentElement.setAttribute('data-bubble', style);
}

function _injectGoogleFont(googleId) {
  if (document.querySelector(`link[data-gfont="${googleId}"]`)) return;
  const link = document.createElement('link');
  link.rel           = 'stylesheet';
  link.href          = `https://fonts.googleapis.com/css2?family=${googleId}&display=swap`;
  link.dataset.gfont = googleId;
  document.head.appendChild(link);
}

// ── Apply all on boot (call once from auth.js onFullyAuthed) ──────────────
function applyAllThemeSettings() {
  applyTheme(S.theme           || 'dark-gold');
  applyFontUi(S.fontUi         || 'dm-mono');
  applyFontHead(S.fontHead     || 'fraunces');
  applyDensity(S.density       || 'comfortable');
  applyRadius(S.radius         || 'default');
  applyBgTexture(S.bgTexture   || 'grid');
  applyBubbleStyle(S.bubbleStyle || 'default');
}

// ── Build the Appearance settings section ─────────────────────────────────
function buildAppearanceUI() {
  const section = document.getElementById('sp-appearance');
  if (!section) return;

  // Helpers
  const currentTheme      = S.theme       || 'dark-gold';
  const currentFontUi     = S.fontUi      || 'dm-mono';
  const currentFontHead   = S.fontHead    || 'fraunces';
  const currentDensity    = S.density     || 'comfortable';
  const currentRadius     = S.radius      || 'default';
  const currentTexture    = S.bgTexture   || 'grid';
  const currentBubble     = S.bubbleStyle || 'default';
  const currentFontSize   = S.fontSize    || 'medium';

  section.innerHTML = `
    <div class="sp-section-header">
      <h2>Appearance</h2>
      <p>Themes, fonts, density, and visual style — all changes are instant and saved automatically.</p>
    </div>

    <!-- ── THEMES ── -->
    <div class="sp-card-header-label">Theme</div>
    <div class="sp-card sp-card-flush">
      <div class="nd-theme-grid" id="nd-theme-grid"></div>
    </div>

    <!-- ── UI FONT ── -->
    <div class="sp-card-header-label">Code &amp; UI Font</div>
    <div class="sp-card sp-card-flush">
      <div class="nd-font-grid" id="nd-font-ui-grid"></div>
    </div>

    <!-- ── HEADING FONT ── -->
    <div class="sp-card-header-label">Heading Font</div>
    <div class="sp-card sp-card-flush">
      <div class="nd-font-grid" id="nd-font-head-grid"></div>
    </div>

    <!-- ── FONT SIZE ── -->
    <div class="sp-card-header-label">Text Size</div>
    <div class="sp-card">
      <div class="sp-card-row sp-no-border">
        <div class="sp-card-label">
          <span>Base Font Size</span>
          <small>Controls text size throughout the interface</small>
        </div>
        <div class="sp-font-picker" id="nd-size-picker">
          <button class="sp-font-btn${currentFontSize === 'small'  ? ' active' : ''}" data-size="small"><span style="font-size:10px">Aa</span><span>Small</span></button>
          <button class="sp-font-btn${currentFontSize === 'medium' ? ' active' : ''}" data-size="medium"><span style="font-size:14px">Aa</span><span>Medium</span></button>
          <button class="sp-font-btn${currentFontSize === 'large'  ? ' active' : ''}" data-size="large"><span style="font-size:18px">Aa</span><span>Large</span></button>
        </div>
      </div>
    </div>

    <!-- ── DENSITY ── -->
    <div class="sp-card-header-label">Density</div>
    <div class="sp-card sp-card-flush">
      <div class="nd-option-row nd-density-row" id="nd-density-row">
        <button class="nd-option-btn${currentDensity === 'compact'     ? ' active' : ''}" data-density="compact">
          <div class="nd-density-preview nd-preview-compact"><span></span><span></span><span></span></div>
          <span>Compact</span>
        </button>
        <button class="nd-option-btn${currentDensity === 'comfortable' ? ' active' : ''}" data-density="comfortable">
          <div class="nd-density-preview nd-preview-comfortable"><span></span><span></span><span></span></div>
          <span>Comfortable</span>
        </button>
        <button class="nd-option-btn${currentDensity === 'spacious'    ? ' active' : ''}" data-density="spacious">
          <div class="nd-density-preview nd-preview-spacious"><span></span><span></span></div>
          <span>Spacious</span>
        </button>
      </div>
    </div>

    <!-- ── BORDER RADIUS ── -->
    <div class="sp-card-header-label">Corner Style</div>
    <div class="sp-card sp-card-flush">
      <div class="nd-option-row" id="nd-radius-row">
        <button class="nd-option-btn${currentRadius === 'sharp'   ? ' active' : ''}" data-radius="sharp">
          <div class="nd-radius-preview" style="border-radius:1px"></div>
          <span>Sharp</span>
        </button>
        <button class="nd-option-btn${currentRadius === 'default' ? ' active' : ''}" data-radius="default">
          <div class="nd-radius-preview" style="border-radius:10px"></div>
          <span>Rounded</span>
        </button>
        <button class="nd-option-btn${currentRadius === 'pill'    ? ' active' : ''}" data-radius="pill">
          <div class="nd-radius-preview" style="border-radius:24px"></div>
          <span>Pill</span>
        </button>
      </div>
    </div>

    <!-- ── BACKGROUND TEXTURE ── -->
    <div class="sp-card-header-label">Background Texture</div>
    <div class="sp-card sp-card-flush">
      <div class="nd-option-row" id="nd-texture-row">
        <button class="nd-option-btn${currentTexture === 'grid'  ? ' active' : ''}" data-texture="grid">
          <div class="nd-texture-preview nd-tex-grid"></div>
          <span>Grid</span>
        </button>
        <button class="nd-option-btn${currentTexture === 'dots'  ? ' active' : ''}" data-texture="dots">
          <div class="nd-texture-preview nd-tex-dots"></div>
          <span>Dots</span>
        </button>
        <button class="nd-option-btn${currentTexture === 'cross' ? ' active' : ''}" data-texture="cross">
          <div class="nd-texture-preview nd-tex-cross"></div>
          <span>Cross</span>
        </button>
        <button class="nd-option-btn${currentTexture === 'none'  ? ' active' : ''}" data-texture="none">
          <div class="nd-texture-preview nd-tex-none"></div>
          <span>None</span>
        </button>
      </div>
    </div>

    <!-- ── CHAT BUBBLE STYLE ── -->
    <div class="sp-card-header-label">Chat Bubble Style</div>
    <div class="sp-card sp-card-flush">
      <div class="nd-option-row nd-bubble-row" id="nd-bubble-row">
        <button class="nd-option-btn${currentBubble === 'default'  ? ' active' : ''}" data-bubble="default">
          <div class="nd-bubble-preview nd-bub-default">
            <div class="nd-bub-msg nd-bub-user">You</div>
            <div class="nd-bub-msg nd-bub-ai">AI</div>
          </div>
          <span>Default</span>
        </button>
        <button class="nd-option-btn${currentBubble === 'minimal'  ? ' active' : ''}" data-bubble="minimal">
          <div class="nd-bubble-preview nd-bub-minimal">
            <div class="nd-bub-msg nd-bub-user">You</div>
            <div class="nd-bub-msg nd-bub-ai">AI</div>
          </div>
          <span>Minimal</span>
        </button>
        <button class="nd-option-btn${currentBubble === 'bordered' ? ' active' : ''}" data-bubble="bordered">
          <div class="nd-bubble-preview nd-bub-bordered">
            <div class="nd-bub-msg nd-bub-user">You</div>
            <div class="nd-bub-msg nd-bub-ai">AI</div>
          </div>
          <span>Bordered</span>
        </button>
      </div>
    </div>
  `;

  // ── Build theme swatches ──────────────────────────────────────────────
  const themeGrid = document.getElementById('nd-theme-grid');
  Object.entries(THEMES).forEach(([id, t]) => {
    const btn = document.createElement('button');
    btn.className     = 'nd-theme-swatch' + (id === currentTheme ? ' active' : '');
    btn.dataset.theme = id;
    btn.innerHTML = `
      <div class="nd-ts-colors">
        <div style="background:${t.preview.bg}; flex:2"></div>
        <div style="background:${t.preview.surface}; flex:1"></div>
        <div class="nd-ts-accent" style="background:${t.preview.accent}"></div>
      </div>
      <div class="nd-ts-label">
        <span class="nd-ts-emoji">${t.emoji}</span>
        <span>${t.label}</span>
      </div>`;
    btn.addEventListener('click', () => {
      S.theme = id;
      applyTheme(id);
      saveSettings();
      document.querySelectorAll('.nd-theme-swatch').forEach(b =>
        b.classList.toggle('active', b.dataset.theme === id)
      );
    });
    themeGrid.appendChild(btn);
  });

  // ── Build font grids ──────────────────────────────────────────────────
  const buildFontGrid = (containerId, fonts, currentId, stateKey, applyFn) => {
    const grid = document.getElementById(containerId);
    if (!grid) return;
    Object.entries(fonts).forEach(([id, f]) => {
      // Preload font if not already loaded
      if (f.googleId && !_loadedFonts.has(id)) {
        _loadedFonts.add(id);
        _injectGoogleFont(f.googleId);
      }
      const btn = document.createElement('button');
      btn.className   = 'nd-font-card' + (id === currentId ? ' active' : '');
      btn.dataset.fontId = id;
      btn.innerHTML = `
        <span class="nd-fc-sample" style="font-family:${f.family}">${f.sample}</span>
        <span class="nd-fc-label">${f.label}</span>`;
      btn.addEventListener('click', () => {
        S[stateKey] = id;
        applyFn(id);
        saveSettings();
        document.querySelectorAll(`#${containerId} .nd-font-card`).forEach(b =>
          b.classList.toggle('active', b.dataset.fontId === id)
        );
      });
      grid.appendChild(btn);
    });
  };

  buildFontGrid('nd-font-ui-grid',   UI_FONTS,      currentFontUi,   'fontUi',   applyFontUi);
  buildFontGrid('nd-font-head-grid', HEADING_FONTS, currentFontHead, 'fontHead', applyFontHead);

  // ── Wire font size buttons ─────────────────────────────────────────────
  document.querySelectorAll('#nd-size-picker .sp-font-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setFontSize(btn.dataset.size);
      document.querySelectorAll('#nd-size-picker .sp-font-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.size === btn.dataset.size)
      );
    });
  });

  // ── Wire density ───────────────────────────────────────────────────────
  document.querySelectorAll('[data-density]').forEach(btn => {
    btn.addEventListener('click', () => {
      S.density = btn.dataset.density;
      applyDensity(btn.dataset.density);
      saveSettings();
      document.querySelectorAll('[data-density]').forEach(b =>
        b.classList.toggle('active', b === btn)
      );
    });
  });

  // ── Wire radius ────────────────────────────────────────────────────────
  document.querySelectorAll('[data-radius]').forEach(btn => {
    btn.addEventListener('click', () => {
      S.radius = btn.dataset.radius;
      applyRadius(btn.dataset.radius);
      saveSettings();
      document.querySelectorAll('[data-radius]').forEach(b =>
        b.classList.toggle('active', b === btn)
      );
    });
  });

  // ── Wire texture ───────────────────────────────────────────────────────
  document.querySelectorAll('[data-texture]').forEach(btn => {
    btn.addEventListener('click', () => {
      S.bgTexture = btn.dataset.texture;
      applyBgTexture(btn.dataset.texture);
      saveSettings();
      document.querySelectorAll('[data-texture]').forEach(b =>
        b.classList.toggle('active', b === btn)
      );
    });
  });

  // ── Wire bubble style ──────────────────────────────────────────────────
  document.querySelectorAll('[data-bubble]').forEach(btn => {
    btn.addEventListener('click', () => {
      S.bubbleStyle = btn.dataset.bubble;
      applyBubbleStyle(btn.dataset.bubble);
      saveSettings();
      document.querySelectorAll('[data-bubble]').forEach(b =>
        b.classList.toggle('active', b === btn)
      );
    });
  });
}
