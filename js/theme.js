/**
 * theme.js — Complete Theming System for NeuralDock
 *
 * SAFE TO REMOVE: Deleting this file and its <script src="js/theme.js"> tag
 * restores original appearance with zero breakage elsewhere.
 *
 * All changes go through:
 *   document.documentElement.style.setProperty()  (CSS custom properties)
 *   document.documentElement.setAttribute()        (data-* attributes)
 * Nothing else in the codebase is touched.
 *
 * Depends on: state.js (S, saveSettings), utils.js (toast, setFontSize)
 */

'use strict';

// ─── oklch helpers ────────────────────────────────────────────────────────────

function _L(s)  { const m = s.match(/oklch\(\s*([\d.]+)%/);               return m ? +m[1] : 0; }
function _C(s)  { const m = s.match(/oklch\(\s*[\d.]+%\s+([\d.]+)/);      return m ? +m[1] : 0; }
function _H(s)  { const m = s.match(/oklch\(\s*[\d.]+%\s+[\d.]+\s+([\d.]+)/); return m ? +m[1] : 0; }

function _mod(s, l, c) {
  const m = s.match(/oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)/);
  if (!m) return s;
  const nl = l !== undefined ? Math.max(0, Math.min(100, l)).toFixed(2) : m[1];
  const nc = c !== undefined ? Math.max(0, c).toFixed(4)                 : m[2];
  return `oklch(${nl}% ${nc} ${m[3]} / 1)`;
}

function _dim(s, a = 0.12) {
  return s.replace(/\s*\/\s*[\d.]+\s*\)/, ` / ${a})`);
}

/**
 * Generate all 12 CSS custom properties from 3 palette colors.
 * Handles both dark and light themes.
 */
function deriveThemeVars(bg, main, sec, isLight) {
  const bgL = _L(bg);
  let surface, surface2, border, bFocus, text, muted;

  if (isLight) {
    surface     = _mod(bg, bgL - 3);
    surface2    = _mod(bg, bgL - 8);
    border      = _mod(bg, bgL - 18);
    bFocus      = _mod(bg, bgL - 28);
    text        = 'oklch(16.00% 0.006 260.00 / 1)';
    muted       = 'oklch(44.00% 0.010 260.00 / 1)';
  } else {
    const s = bgL < 15 ? 5 : 4;
    surface     = _mod(bg, bgL + s);
    surface2    = _mod(bg, bgL + s * 2);
    border      = _mod(bg, bgL + s * 3.2);
    bFocus      = _mod(bg, bgL + s * 5);
    text        = 'oklch(92.00% 0.008 260.00 / 1)';
    muted       = _mod(bg, bgL + 36, 0.008);
  }

  const mainL  = _L(main);
  const mainC  = _C(main);
  const accent2 = _mod(main, Math.max(mainL - 22, 28), Math.max(mainC - 0.04, 0));

  return {
    '--bg':           bg,
    '--surface':      surface,
    '--surface2':     surface2,
    '--border':       border,
    '--border-focus': bFocus,
    '--accent':       main,
    '--accent2':      accent2,
    '--accent-dim':   _dim(main, 0.12),
    '--text':         text,
    '--muted':        muted,
    '--err':          'oklch(65.00% 0.19 28.00 / 1)',
    '--ok':           'oklch(68.00% 0.18 142.00 / 1)',
  };
}

// ─── Raw theme data ───────────────────────────────────────────────────────────
// Format: { label?, bg, main, sec, isLight? }
// Or:     { label?, manual: { ...all vars } }  (skip deriveThemeVars)

const _T = {

  // ── Default (exact colours — never change this) ───────────────────────────
  'dark-gold': { label: 'Dark Gold', manual: {
    '--bg':'#0c0e0f','--surface':'#141618','--surface2':'#1a1c1e',
    '--border':'#222527','--border-focus':'#3a3d40',
    '--accent':'#d4a853','--accent2':'#8b6b35','--accent-dim':'rgba(212,168,83,.1)',
    '--text':'#e8e2d9','--muted':'#6b6560','--err':'#e07070','--ok':'#4caf82',
  }},

  // ── Original extras (kept from v1) ───────────────────────────────────────
  'ocean':    { label:'Ocean',    bg:'oklch(7.00% 0.025 250.00 / 1)', main:'oklch(72.00% 0.165 217.00 / 1)', sec:'oklch(60.00% 0.12 268.00 / 1)' },
  'forest':   { label:'Forest',   bg:'oklch(8.00% 0.030 155.00 / 1)', main:'oklch(70.00% 0.165 145.00 / 1)', sec:'oklch(55.00% 0.12 142.00 / 1)' },
  'midnight': { label:'Midnight', bg:'oklch(7.00% 0.028 285.00 / 1)', main:'oklch(72.00% 0.165 295.00 / 1)', sec:'oklch(55.00% 0.12 280.00 / 1)' },
  'rose':     { label:'Rose',     bg:'oklch(9.00% 0.030 10.00 / 1)',  main:'oklch(72.00% 0.185 5.00 / 1)',   sec:'oklch(55.00% 0.14 355.00 / 1)' },
  'carbon':   { label:'Carbon',   bg:'oklch(8.50% 0.003 270.00 / 1)', main:'oklch(82.00% 0.006 270.00 / 1)', sec:'oklch(60.00% 0.003 260.00 / 1)' },
  'amber':    { label:'Amber',    bg:'oklch(9.00% 0.018 85.00 / 1)',  main:'oklch(78.00% 0.155 80.00 / 1)',  sec:'oklch(58.00% 0.10 74.00 / 1)' },
  'slate':    { label:'Slate',    bg:'oklch(17.00% 0.025 252.00 / 1)',main:'oklch(72.00% 0.055 228.00 / 1)', sec:'oklch(52.00% 0.035 240.00 / 1)' },

  // ── Base ──────────────────────────────────────────────────────────────────
  'base-dark':  { label:'Dark',  bg:'oklch(22.67% 0.0000 89.88 / 1)',  main:'oklch(100.00% 0.0000 89.88 / 1)', sec:'oklch(80.54% 0.0000 89.88 / 1)' },
  'base-light': { label:'Light', isLight:true, bg:'oklch(100.00% 0.0000 89.88 / 1)', main:'oklch(0.00% 0.0000 0.00 / 1)',   sec:'oklch(46.49% 0.0000 89.88 / 1)' },

  // ── Classic Dark ─────────────────────────────────────────────────────────
  'monkeytype':   { label:'monkeytype',    bg:'oklch(33.94% 0.0062 248.01 / 1)', main:'oklch(81.03% 0.1625 94.11 / 1)',  sec:'oklch(86.53% 0.0153 96.38 / 1)' },
  'nord':         { label:'Nord',          bg:'oklch(30.81% 0.0237 264.19 / 1)', main:'oklch(77.09% 0.0747 130.82 / 1)', sec:'oklch(72.67% 0.0638 335.82 / 1)' },
  'catppuccin':   { label:'Catppuccin',    bg:'oklch(24.38% 0.0305 283.91 / 1)', main:'oklch(82.07% 0.0990 299.48 / 1)', sec:'oklch(87.84% 0.0426 272.09 / 1)' },
  'wabisabi':     { label:'Wabi-Sabi',     bg:'oklch(19.00% 0.0220 260.00 / 1)', main:'oklch(76.00% 0.1100 40.00 / 1)',  sec:'oklch(65.00% 0.0400 148.00 / 1)' },
  'old-library':  { label:'Old Library',   bg:'oklch(24.40% 0.0136 74.48 / 1)',  main:'oklch(86.40% 0.1653 93.75 / 1)',  sec:'oklch(71.19% 0.0756 66.11 / 1)' },
  'incognito':    { label:'Incognito',     bg:'oklch(15.79% 0.0000 89.88 / 1)',  main:'oklch(78.54% 0.1978 62.50 / 1)',  sec:'oklch(67.60% 0.1117 74.79 / 1)' },
  'liquid-graphite':{ label:'Liquid Graphite', bg:'oklch(19.94% 0.0081 267.13 / 1)', main:'oklch(76.61% 0.1036 222.57 / 1)', sec:'oklch(76.33% 0.1672 57.87 / 1)' },
  'cosmic-charcoal':{ label:'Cosmic Charcoal', bg:'oklch(22.41% 0.0104 248.29 / 1)', main:'oklch(70.54% 0.1799 38.53 / 1)',  sec:'oklch(74.54% 0.1778 55.17 / 1)' },
  'dusk-voyager': { label:'Dusk Voyager',  bg:'oklch(21.71% 0.0239 258.33 / 1)', main:'oklch(80.65% 0.0930 227.43 / 1)', sec:'oklch(87.28% 0.1705 94.99 / 1)' },
  'dreamwave-mirage':{ label:'Dreamwave Mirage', bg:'oklch(19.69% 0.0908 288.04 / 1)', main:'oklch(66.39% 0.2381 359.36 / 1)', sec:'oklch(83.18% 0.1354 212.90 / 1)' },

  // ── Monochrome ────────────────────────────────────────────────────────────
  'noir':     { label:'Noir',            bg:'oklch(0.00% 0.0000 0.00 / 1)',    main:'oklch(100.00% 0.0000 89.88 / 1)', sec:'oklch(80.54% 0.0000 89.88 / 1)' },
  'matrix':   { label:'Matrix',          bg:'oklch(0.00% 0.0000 0.00 / 1)',    main:'oklch(95.50% 0.2946 142.50 / 1)', sec:'oklch(71.30% 0.1968 141.94 / 1)' },
  'absolute-darkness':{ label:'Absolute Darkness', bg:'oklch(13.77% 0.0125 304.02 / 1)', main:'oklch(65.85% 0.1592 53.69 / 1)', sec:'oklch(59.04% 0.2430 304.10 / 1)' },

  // ── Japanese Aesthetic ────────────────────────────────────────────────────
  'yukata':            { label:'Yukata',         bg:'oklch(20.83% 0.0367 263.24 / 1)', main:'oklch(65.16% 0.1943 14.70 / 1)',  sec:'oklch(68.92% 0.1657 313.51 / 1)' },
  'aizome':            { label:'Aizome',          bg:'oklch(21.50% 0.0352 256.92 / 1)', main:'oklch(65.35% 0.1437 250.97 / 1)', sec:'oklch(80.45% 0.0461 76.23 / 1)' },
  'fuji':              { label:'Fuji',            bg:'oklch(22.26% 0.0193 248.71 / 1)', main:'oklch(81.68% 0.0590 229.99 / 1)', sec:'oklch(93.89% 0.0000 89.88 / 1)' },
  'arashiyama':        { label:'Arashiyama',      bg:'oklch(23.30% 0.0273 161.53 / 1)', main:'oklch(76.25% 0.2262 143.95 / 1)', sec:'oklch(79.81% 0.1006 126.94 / 1)' },
  'moonlit-waterfall': { label:'Moonlit Waterfall',bg:'oklch(23.46% 0.0439 256.98 / 1)', main:'oklch(77.77% 0.1371 304.09 / 1)', sec:'oklch(96.20% 0.0564 196.25 / 1)' },
  'kyoto-lanterns':    { label:'Kyoto Lanterns',  bg:'oklch(22.10% 0.0310 265.00 / 1)', main:'oklch(78.90% 0.1820 50.00 / 1)',  sec:'oklch(84.20% 0.1200 90.00 / 1)' },
  'koi-pond':          { label:'Koi Pond',        bg:'oklch(20.0% 0.048 240.0 / 1)',    main:'oklch(80.0% 0.175 55.0 / 1)',    sec:'oklch(70.0% 0.130 220.0 / 1)' },
  'yume-mori':         { label:'Yume Mori',       bg:'oklch(20.0% 0.040 190.0 / 1)',    main:'oklch(86.0% 0.140 180.0 / 1)',   sec:'oklch(74.0% 0.090 150.0 / 1)' },
  'neon-sakura':       { label:'Neon Sakura',     bg:'oklch(14.0% 0.040 310.0 / 1)',    main:'oklch(78.0% 0.230 340.0 / 1)',   sec:'oklch(68.0% 0.180 285.0 / 1)' },
  'plum-blossom':      { label:'Plum Blossom',    bg:'oklch(23.0% 0.042 340.0 / 1)',    main:'oklch(78.0% 0.165 350.0 / 1)',   sec:'oklch(88.0% 0.095 85.0 / 1)' },
  'vending-glow':      { label:'Vending Glow',    bg:'oklch(16.0% 0.025 280.0 / 1)',    main:'oklch(85.0% 0.125 220.0 / 1)',   sec:'oklch(78.0% 0.165 45.0 / 1)' },
  'sakura-tsuki':      { label:'Sakura Tsuki',    bg:'oklch(18.5% 0.030 250.0 / 1)',    main:'oklch(88.0% 0.120 210.0 / 1)',   sec:'oklch(76.0% 0.090 165.0 / 1)' },
  'wisteria-dream':    { label:'Wisteria Dream',  bg:'oklch(20.0% 0.048 290.0 / 1)',    main:'oklch(72.0% 0.175 295.0 / 1)',   sec:'oklch(80.0% 0.125 320.0 / 1)' },
  'bamboo-forest':     { label:'Bamboo Forest',   bg:'oklch(21.0% 0.045 155.0 / 1)',    main:'oklch(70.0% 0.145 150.0 / 1)',   sec:'oklch(78.0% 0.095 140.0 / 1)' },
  'firefly-field':     { label:'Firefly Field',   bg:'oklch(16.0% 0.038 150.0 / 1)',    main:'oklch(88.0% 0.175 110.0 / 1)',   sec:'oklch(65.0% 0.125 145.0 / 1)' },
  'hanabi-festival':   { label:'Hanabi Festival', bg:'oklch(14.0% 0.055 275.0 / 1)',    main:'oklch(85.0% 0.200 35.0 / 1)',    sec:'oklch(78.0% 0.215 310.0 / 1)' },
  'vaporwave-shrine':  { label:'Vaporwave Shrine',bg:'oklch(17.0% 0.072 305.0 / 1)',    main:'oklch(75.0% 0.175 195.0 / 1)',   sec:'oklch(80.0% 0.195 330.0 / 1)' },
  'tsukimi-night':     { label:'Tsukimi Night',   bg:'oklch(14.0% 0.030 260.0 / 1)',    main:'oklch(88.0% 0.050 230.0 / 1)',   sec:'oklch(68.0% 0.075 260.0 / 1)' },
  'kage':              { label:'Kage',            bg:'oklch(17.5% 0.045 285.0 / 1)',    main:'oklch(80.5% 0.210 328.0 / 1)',   sec:'oklch(82.0% 0.130 210.0 / 1)' },
  'hanatsuki':         { label:'Hanatsuki',       bg:'oklch(18.0% 0.038 295.0 / 1)',    main:'oklch(82.0% 0.185 340.0 / 1)',   sec:'oklch(76.0% 0.145 80.0 / 1)' },
  'kagewabi':          { label:'Kagewabi',        bg:'oklch(17.0% 0.032 270.0 / 1)',    main:'oklch(87.0% 0.135 215.0 / 1)',   sec:'oklch(74.0% 0.110 305.0 / 1)' },
  'sabikuro':          { label:'Sabikuro',        bg:'oklch(15.0% 0.022 255.0 / 1)',    main:'oklch(65.0% 0.085 240.0 / 1)',   sec:'oklch(58.0% 0.045 260.0 / 1)' },
  'kumo':              { label:'Kumo',            bg:'oklch(19.2% 0.026 230.0 / 1)',    main:'oklch(95.0% 0.125 260.0 / 1)',   sec:'oklch(82.0% 0.129 300.0 / 1)' },
  'yozakura':          { label:'Yozakura',        bg:'oklch(16.0% 0.035 295.0 / 1)',    main:'oklch(82.0% 0.195 345.0 / 1)',   sec:'oklch(70.0% 0.120 270.0 / 1)' },
  'akebono':           { label:'Akebono',         bg:'oklch(18.0% 0.030 280.0 / 1)',    main:'oklch(94.0% 0.160 25.0 / 1)',    sec:'oklch(88.0% 0.140 305.0 / 1)' },
  'ruri':              { label:'Ruri',            bg:'oklch(13.0% 0.034 255.0 / 1)',    main:'oklch(93.0% 0.047 256.0 / 1)',   sec:'oklch(81.0% 0.164 305.0 / 1)' },

  // ── City Nights ───────────────────────────────────────────────────────────
  'neon-tokyo':    { label:'Neon Tokyo',    bg:'oklch(22.71% 0.0340 319.46 / 1)', main:'oklch(70.51% 0.2067 349.65 / 1)', sec:'oklch(76.88% 0.1491 229.14 / 1)' },
  'nyc-midnight':  { label:'NYC Midnight',  bg:'oklch(21.05% 0.0241 272.25 / 1)', main:'oklch(88.35% 0.1514 90.24 / 1)',  sec:'oklch(80.43% 0.1296 218.65 / 1)' },
  'paris-metro':   { label:'Paris Metro',   bg:'oklch(24.24% 0.0137 258.37 / 1)', main:'oklch(66.40% 0.1844 1.84 / 1)',   sec:'oklch(94.43% 0.1789 109.39 / 1)' },
  'london-fog':    { label:'London Fog',    bg:'oklch(26.98% 0.0079 234.94 / 1)', main:'oklch(80.86% 0.0632 119.23 / 1)', sec:'oklch(79.21% 0.0976 244.15 / 1)' },
  'shibuya-nights':{ label:'Shibuya Nights',bg:'oklch(12.0% 0.045 290.0 / 1)',    main:'oklch(78.0% 0.225 330.0 / 1)',    sec:'oklch(82.0% 0.180 200.0 / 1)' },
  'akihabara-glow':{ label:'Akihabara Glow',bg:'oklch(15.0% 0.065 300.0 / 1)',    main:'oklch(80.0% 0.210 180.0 / 1)',    sec:'oklch(85.0% 0.190 320.0 / 1)' },
  'tokyo-metro':   { label:'Tokyo Metro',   bg:'oklch(20.0% 0.025 260.0 / 1)',    main:'oklch(70.0% 0.180 145.0 / 1)',    sec:'oklch(80.0% 0.120 50.0 / 1)' },

  // ── Vivid & Neon ──────────────────────────────────────────────────────────
  'synthwave-night':   { label:'Synthwave Night',  bg:'oklch(22.85% 0.0341 302.93 / 1)', main:'oklch(71.26% 0.2322 338.26 / 1)', sec:'oklch(89.39% 0.1507 182.75 / 1)' },
  'vaporpop':          { label:'Vaporpop',         bg:'oklch(27.52% 0.0194 190.93 / 1)', main:'oklch(81.91% 0.1399 338.07 / 1)', sec:'oklch(96.69% 0.1969 110.57 / 1)' },
  'neon-dusk':         { label:'Neon Dusk',        bg:'oklch(17.57% 0.0580 286.44 / 1)', main:'oklch(80.54% 0.1459 219.21 / 1)', sec:'oklch(81.54% 0.1673 84.27 / 1)' },
  'electric-phantasm': { label:'Electric Phantasm',bg:'oklch(16.84% 0.0840 312.74 / 1)', main:'oklch(78.00% 0.1466 226.62 / 1)', sec:'oklch(88.69% 0.2657 137.42 / 1)' },
  'cosmic-dream':      { label:'Cosmic Dream',     bg:'oklch(18.85% 0.0666 294.49 / 1)', main:'oklch(71.93% 0.2621 323.58 / 1)', sec:'oklch(92.30% 0.0609 214.79 / 1)' },
  'midnight-blossom':  { label:'Midnight Blossom', bg:'oklch(22.87% 0.0552 301.41 / 1)', main:'oklch(65.03% 0.2011 353.35 / 1)', sec:'oklch(67.48% 0.1719 317.18 / 1)' },
  'velvet-night':      { label:'Velvet Night',     bg:'oklch(23.59% 0.0238 263.95 / 1)', main:'oklch(56.39% 0.2560 301.81 / 1)', sec:'oklch(60.45% 0.2182 7.97 / 1)' },
  'coral-abyss':       { label:'Coral Abyss',      bg:'oklch(21.08% 0.0399 250.21 / 1)', main:'oklch(71.96% 0.1494 39.01 / 1)',  sec:'oklch(88.63% 0.1367 194.97 / 1)' },
  'citrus-dream':      { label:'Citrus Dream',     bg:'oklch(22.81% 0.0444 309.31 / 1)', main:'oklch(90.30% 0.1538 95.00 / 1)',  sec:'oklch(72.77% 0.1706 41.25 / 1)' },
  'velvet-abyss':      { label:'Velvet Abyss',     bg:'oklch(16.24% 0.0498 294.14 / 1)', main:'oklch(64.44% 0.1950 34.93 / 1)',  sec:'oklch(87.65% 0.1319 182.76 / 1)' },
  'luminous-tide':     { label:'Luminous Tide',    bg:'oklch(22.28% 0.0328 247.92 / 1)', main:'oklch(86.48% 0.1570 89.55 / 1)',  sec:'oklch(78.54% 0.1352 212.60 / 1)' },

  // ── Cosmic & Celestial ────────────────────────────────────────────────────
  'luminous-nebula':  { label:'Luminous Nebula',  bg:'oklch(15.68% 0.0646 275.10 / 1)', main:'oklch(71.79% 0.2345 319.14 / 1)', sec:'oklch(83.78% 0.1014 229.56 / 1)' },
  'andromeda-dream':  { label:'Andromeda Dream',  bg:'oklch(18.70% 0.0520 299.85 / 1)', main:'oklch(75.15% 0.1685 335.07 / 1)', sec:'oklch(83.38% 0.1191 221.07 / 1)' },
  'seraphic-aurora':  { label:'Seraphic Aurora',  bg:'oklch(22.15% 0.0424 259.54 / 1)', main:'oklch(88.48% 0.1989 157.31 / 1)', sec:'oklch(71.37% 0.1905 307.67 / 1)' },
  'nebula-veil':      { label:'Nebula Veil',      bg:'oklch(20.05% 0.0344 289.02 / 1)', main:'oklch(76.15% 0.1814 322.77 / 1)', sec:'oklch(84.57% 0.1067 216.31 / 1)' },
  'galaxy-oracle':    { label:'Galaxy Oracle',    bg:'oklch(16.40% 0.0417 259.26 / 1)', main:'oklch(79.95% 0.1588 324.56 / 1)', sec:'oklch(71.36% 0.1484 265.31 / 1)' },
  'ultraviolet-oracle':{ label:'Ultraviolet Oracle', bg:'oklch(16.82% 0.0727 297.93 / 1)', main:'oklch(74.03% 0.1392 250.23 / 1)', sec:'oklch(70.60% 0.1901 307.64 / 1)' },
  'opaline-zodiac':   { label:'Opaline Zodiac',   bg:'oklch(26.41% 0.0350 226.27 / 1)', main:'oklch(91.01% 0.1388 185.50 / 1)', sec:'oklch(95.51% 0.1496 105.14 / 1)' },
  'polaris-veil':     { label:'Polaris Veil',     bg:'oklch(21.62% 0.0410 265.53 / 1)', main:'oklch(83.66% 0.1106 224.33 / 1)', sec:'oklch(97.38% 0.1589 109.02 / 1)' },
  'hyperion-skies':   { label:'Hyperion Skies',   bg:'oklch(22.30% 0.0359 248.20 / 1)', main:'oklch(79.59% 0.1207 231.06 / 1)', sec:'oklch(88.72% 0.1622 92.81 / 1)' },
  'oceanic-aurora':   { label:'Oceanic Aurora',   bg:'oklch(24.46% 0.0436 241.01 / 1)', main:'oklch(87.55% 0.1607 168.05 / 1)', sec:'oklch(75.70% 0.1479 313.81 / 1)' },
  'ethereal-dawn':    { label:'Ethereal Dawn',    bg:'oklch(20.35% 0.0615 298.46 / 1)', main:'oklch(86.20% 0.1411 83.89 / 1)',  sec:'oklch(86.02% 0.1234 183.17 / 1)' },
  'azure-twilight':   { label:'Azure Twilight',   bg:'oklch(21.29% 0.0290 262.37 / 1)', main:'oklch(84.26% 0.1387 209.07 / 1)', sec:'oklch(75.40% 0.1203 299.61 / 1)' },
  'astral-mirage':    { label:'Astral Mirage',    bg:'oklch(18.00% 0.055 278.0 / 1)',   main:'oklch(82.00% 0.175 255.0 / 1)',   sec:'oklch(76.00% 0.160 310.0 / 1)' },
  'nebulous-maw':     { label:'Nebulous Maw',     bg:'oklch(15.98% 0.0489 288.97 / 1)', main:'oklch(89.75% 0.1441 92.30 / 1)',  sec:'oklch(79.15% 0.1581 341.83 / 1)' },
  'twilight-oracle':  { label:'Twilight Oracle',  bg:'oklch(20.48% 0.0501 293.80 / 1)', main:'oklch(69.17% 0.1819 27.93 / 1)',  sec:'oklch(75.61% 0.0937 245.86 / 1)' },
  'amethyst-nightfall':{ label:'Amethyst Nightfall', bg:'oklch(21.95% 0.0432 311.57 / 1)', main:'oklch(66.69% 0.2159 319.91 / 1)', sec:'oklch(68.80% 0.1314 255.70 / 1)' },
  'fathom-frost':     { label:'Fathom Frost',     bg:'oklch(22.55% 0.0320 232.35 / 1)', main:'oklch(83.21% 0.2489 143.51 / 1)', sec:'oklch(79.37% 0.1483 339.93 / 1)' },
  'lapis-solara':     { label:'Lapis Solara',     bg:'oklch(19.00% 0.0468 268.47 / 1)', main:'oklch(96.43% 0.1338 105.98 / 1)', sec:'oklch(77.85% 0.1273 297.95 / 1)' },
  'arcane-fathoms':   { label:'Arcane Fathoms',   bg:'oklch(21.67% 0.0429 245.91 / 1)', main:'oklch(85.76% 0.1843 135.05 / 1)', sec:'oklch(79.04% 0.1466 314.59 / 1)' },
  'melancholy-halo':  { label:'Melancholy Halo',  bg:'oklch(19.30% 0.0200 266.53 / 1)', main:'oklch(68.33% 0.1789 294.23 / 1)', sec:'oklch(88.93% 0.1602 165.64 / 1)' },
  'zephyrite-dream':  { label:'Zephyrite Dream',  bg:'oklch(24.42% 0.0251 168.14 / 1)', main:'oklch(81.58% 0.1131 224.68 / 1)', sec:'oklch(85.83% 0.2104 136.05 / 1)' },
  'celestial-grove':  { label:'Celestial Grove',  bg:'oklch(23.71% 0.0245 182.34 / 1)', main:'oklch(82.23% 0.1888 129.99 / 1)', sec:'oklch(85.46% 0.1464 86.88 / 1)' },

  // ── Ocean & Blue ──────────────────────────────────────────────────────────
  'sapphire-bloom':  { label:'Sapphire Bloom',  bg:'oklch(23.44% 0.0432 267.85 / 1)', main:'oklch(79.09% 0.1242 299.66 / 1)', sec:'oklch(89.39% 0.1672 171.49 / 1)' },
  'sapphire-frost':  { label:'Sapphire Frost',  bg:'oklch(21.22% 0.0365 248.44 / 1)', main:'oklch(81.72% 0.1224 225.37 / 1)', sec:'oklch(82.37% 0.0918 182.03 / 1)' },
  'cobalt-lumen':    { label:'Cobalt Lumen',    bg:'oklch(19.79% 0.0422 241.46 / 1)', main:'oklch(82.82% 0.1215 219.38 / 1)', sec:'oklch(71.03% 0.2822 327.32 / 1)' },
  'lapis-cascade':   { label:'Lapis Cascade',   bg:'oklch(21.47% 0.0366 256.94 / 1)', main:'oklch(70.00% 0.1570 273.18 / 1)', sec:'oklch(81.56% 0.1374 207.64 / 1)' },
  'cyanic-wisdom':   { label:'Cyanic Wisdom',   bg:'oklch(21.86% 0.0305 226.59 / 1)', main:'oklch(86.20% 0.1078 216.26 / 1)', sec:'oklch(75.50% 0.1398 350.60 / 1)' },
  'nautilus-star':   { label:'Nautilus Star',   bg:'oklch(19.37% 0.0229 240.54 / 1)', main:'oklch(72.83% 0.1420 246.20 / 1)', sec:'oklch(82.85% 0.1123 65.21 / 1)' },
  'arctic-inferno':  { label:'Arctic Inferno',  bg:'oklch(24.29% 0.0410 259.59 / 1)', main:'oklch(69.62% 0.1864 29.03 / 1)',  sec:'oklch(90.62% 0.1382 196.68 / 1)' },
  'celestite-frost': { label:'Celestite Frost', bg:'oklch(26.22% 0.0304 223.60 / 1)', main:'oklch(90.72% 0.0634 222.26 / 1)', sec:'oklch(78.12% 0.1599 336.29 / 1)' },
  'lucid-dusk':      { label:'Lucid Dusk',      bg:'oklch(20.83% 0.0537 285.29 / 1)', main:'oklch(70.85% 0.1490 27.94 / 1)',  sec:'oklch(90.41% 0.1302 198.38 / 1)' },
  'midnight-fjord':  { label:'Midnight Fjord',  bg:'oklch(22.37% 0.0385 258.28 / 1)', main:'oklch(89.81% 0.1593 94.71 / 1)',  sec:'oklch(80.50% 0.1237 229.36 / 1)' },
  'prairie-star':    { label:'Prairie Star',    bg:'oklch(20.92% 0.0367 263.32 / 1)', main:'oklch(62.77% 0.1885 260.52 / 1)', sec:'oklch(66.30% 0.2056 24.71 / 1)' },

  // ── Nature ────────────────────────────────────────────────────────────────
  'mystic-forest':   { label:'Mystic Forest',   bg:'oklch(25.62% 0.0314 158.36 / 1)', main:'oklch(69.45% 0.2065 141.03 / 1)', sec:'oklch(77.00% 0.1352 133.99 / 1)' },
  'jungle-twilight': { label:'Jungle Twilight', bg:'oklch(23.37% 0.0231 175.48 / 1)', main:'oklch(78.06% 0.1476 57.34 / 1)',  sec:'oklch(64.23% 0.1482 284.44 / 1)' },
  'rainforest-mist': { label:'Rainforest Mist', bg:'oklch(24.08% 0.0271 155.33 / 1)', main:'oklch(76.05% 0.0706 200.04 / 1)', sec:'oklch(83.86% 0.1351 87.45 / 1)' },
  'jade-mirage':     { label:'Jade Mirage',     bg:'oklch(26.31% 0.0204 175.21 / 1)', main:'oklch(78.16% 0.1692 156.42 / 1)', sec:'oklch(78.87% 0.1288 179.07 / 1)' },
  'haunted-lagoon':  { label:'Haunted Lagoon',  bg:'oklch(23.02% 0.0371 221.64 / 1)', main:'oklch(84.05% 0.1487 175.10 / 1)', sec:'oklch(76.62% 0.1215 143.15 / 1)' },
  'topaz-drift':     { label:'Topaz Drift',     bg:'oklch(24.96% 0.0256 184.90 / 1)', main:'oklch(89.58% 0.1336 91.10 / 1)',  sec:'oklch(72.65% 0.1523 43.04 / 1)' },
  'wasabi-garden':   { label:'Wasabi Garden',   bg:'oklch(20.0% 0.048 160.0 / 1)',    main:'oklch(72.0% 0.185 145.0 / 1)',   sec:'oklch(82.0% 0.145 130.0 / 1)' },
  'dragon-scale':    { label:'Dragon Scale',    bg:'oklch(19.0% 0.055 165.0 / 1)',    main:'oklch(68.0% 0.175 160.0 / 1)',   sec:'oklch(78.0% 0.145 140.0 / 1)' },

  // ── Halloween 🎃 ──────────────────────────────────────────────────────────
  'pumpkin-night':   { label:'Pumpkin Night',  bg:'oklch(18.52% 0.0184 314.34 / 1)', main:'oklch(74.61% 0.1715 51.56 / 1)',  sec:'oklch(63.26% 0.2293 339.96 / 1)' },
  'spooky-glow':     { label:'Spooky Glow',   bg:'oklch(15.70% 0.0034 248.05 / 1)', main:'oklch(88.07% 0.1974 131.90 / 1)', sec:'oklch(67.13% 0.2017 304.62 / 1)' },

  // ── Christmas 🎄 ──────────────────────────────────────────────────────────
  'santa-night':       { label:'Santa Night',       bg:'oklch(21.77% 0.0430 263.13 / 1)', main:'oklch(61.42% 0.2261 23.63 / 1)',  sec:'oklch(85.33% 0.1706 86.75 / 1)' },
  'winter-wonderland': { label:'Winter Wonderland',  bg:'oklch(94.76% 0.0133 185.08 / 1)', main:'oklch(58.04% 0.2202 24.52 / 1)',  sec:'oklch(70.13% 0.1252 171.56 / 1)', isLight:true },
  'christmas-eve':     { label:'Christmas Eve',      bg:'oklch(23.26% 0.0557 272.84 / 1)', main:'oklch(85.68% 0.1599 89.08 / 1)',  sec:'oklch(61.95% 0.1489 150.29 / 1)' },
  'northern-lights':   { label:'Northern Lights',    bg:'oklch(21.92% 0.0178 230.20 / 1)', main:'oklch(86.12% 0.1660 169.64 / 1)', sec:'oklch(65.57% 0.2272 312.53 / 1)' },
  'mariah-carey':      { label:'Mariah Carey',       bg:'oklch(18.50% 0.0150 15.00 / 1)',  main:'oklch(92.00% 0.0450 95.00 / 1)',  sec:'oklch(64.00% 0.2100 28.00 / 1)' },

};

// ─── Build THEMES map ─────────────────────────────────────────────────────────

function _fmtLabel(id) {
  return id.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

const THEMES = {};
for (const [id, raw] of Object.entries(_T)) {
  THEMES[id] = {
    label:   raw.label || _fmtLabel(id),
    isLight: raw.isLight || false,
    preview: { bg: raw.bg || '#0c0e0f', accent: raw.main || '#d4a853', sec: raw.sec || '#888' },
    vars:    raw.manual ? raw.manual : deriveThemeVars(raw.bg, raw.main, raw.sec, raw.isLight || false),
  };
}

// ─── Group definitions ────────────────────────────────────────────────────────

const THEME_GROUPS = [
  {
    id: 'base', label: 'Base', emoji: '◎',
    ids: ['dark-gold','base-dark','base-light','carbon','slate','amber'],
  },
  {
    id: 'classic', label: 'Classic Dark', emoji: '◆',
    ids: ['monkeytype','nord','catppuccin','wabisabi','old-library','incognito','liquid-graphite','cosmic-charcoal','dusk-voyager','dreamwave-mirage'],
  },
  {
    id: 'mono', label: 'Monochrome', emoji: '▣',
    ids: ['noir','matrix','absolute-darkness'],
  },
  {
    id: 'japanese', label: 'Japanese', emoji: '⛩',
    ids: ['yukata','aizome','fuji','arashiyama','moonlit-waterfall','kyoto-lanterns','koi-pond',
          'yume-mori','neon-sakura','plum-blossom','vending-glow','wisteria-dream',
          'bamboo-forest','firefly-field','hanabi-festival','vaporwave-shrine','tsukimi-night',
          'kage','hanatsuki','kagewabi','sabikuro','kumo','yozakura','akebono','ruri','sakura-tsuki'],
  },
  {
    id: 'city', label: 'City Nights', emoji: '🌆',
    ids: ['neon-tokyo','nyc-midnight','paris-metro','london-fog','shibuya-nights','akihabara-glow','tokyo-metro'],
  },
  {
    id: 'vivid', label: 'Vivid & Neon', emoji: '⚡',
    ids: ['synthwave-night','vaporpop','neon-dusk','electric-phantasm','cosmic-dream',
          'midnight-blossom','velvet-night','coral-abyss','citrus-dream','velvet-abyss','luminous-tide'],
  },
  {
    id: 'cosmic', label: 'Cosmic', emoji: '✦',
    ids: ['luminous-nebula','andromeda-dream','seraphic-aurora','nebula-veil','galaxy-oracle',
          'ultraviolet-oracle','opaline-zodiac','polaris-veil','hyperion-skies','oceanic-aurora',
          'ethereal-dawn','azure-twilight','astral-mirage','nebulous-maw','twilight-oracle',
          'amethyst-nightfall','fathom-frost','lapis-solara','arcane-fathoms','melancholy-halo',
          'zephyrite-dream','celestial-grove'],
  },
  {
    id: 'ocean', label: 'Ocean & Blue', emoji: '◈',
    ids: ['ocean','sapphire-bloom','sapphire-frost','cobalt-lumen','lapis-cascade','cyanic-wisdom',
          'nautilus-star','arctic-inferno','celestite-frost','lucid-dusk','midnight-fjord','prairie-star'],
  },
  {
    id: 'nature', label: 'Nature', emoji: '◉',
    ids: ['forest','mystic-forest','jungle-twilight','rainforest-mist','jade-mirage',
          'haunted-lagoon','topaz-drift','wasabi-garden','dragon-scale'],
  },
  {
    id: 'other', label: 'Other', emoji: '◦',
    ids: ['midnight','rose','ocean'],
  },
  {
    id: 'halloween', label: '🎃 Halloween', emoji: '🎃',
    ids: ['pumpkin-night','spooky-glow'],
  },
  {
    id: 'christmas', label: '🎄 Christmas', emoji: '🎄',
    ids: ['santa-night','winter-wonderland','christmas-eve','northern-lights','mariah-carey'],
  },
];

// Remove duplicates: if a theme already appeared in an earlier group, skip it in later groups
(function dedup() {
  const seen = new Set();
  THEME_GROUPS.forEach(g => {
    g.ids = g.ids.filter(id => {
      if (seen.has(id) || !THEMES[id]) return false;
      seen.add(id);
      return true;
    });
  });
  // Catch any themes not assigned to a group — add to 'other'
  const otherGroup = THEME_GROUPS.find(g => g.id === 'other');
  for (const id of Object.keys(THEMES)) {
    if (!seen.has(id)) otherGroup.ids.push(id);
  }
  // Remove empty groups
  THEME_GROUPS.splice(0, THEME_GROUPS.length, ...THEME_GROUPS.filter(g => g.ids.length));
})();

// ─── Font registries ──────────────────────────────────────────────────────────

const UI_FONTS = {
  'dm-mono':     { label:'DM Mono',        family:"'DM Mono', monospace",        gid:null },
  'jetbrains':   { label:'JetBrains Mono', family:"'JetBrains Mono', monospace", gid:'JetBrains+Mono:wght@400;500' },
  'fira-code':   { label:'Fira Code',      family:"'Fira Code', monospace",      gid:'Fira+Code:wght@400;500' },
  'ibm-plex':    { label:'IBM Plex Mono',  family:"'IBM Plex Mono', monospace",  gid:'IBM+Plex+Mono:wght@400;500' },
  'space-mono':  { label:'Space Mono',     family:"'Space Mono', monospace",     gid:'Space+Mono:wght@400;700' },
  'inconsolata': { label:'Inconsolata',    family:"'Inconsolata', monospace",    gid:'Inconsolata:wght@400;500' },
};

const HEADING_FONTS = {
  'fraunces':  { label:'Fraunces',           family:"'Fraunces', serif",           gid:null },
  'playfair':  { label:'Playfair Display',   family:"'Playfair Display', serif",   gid:'Playfair+Display:wght@400;600' },
  'dm-serif':  { label:'DM Serif Display',   family:"'DM Serif Display', serif",   gid:'DM+Serif+Display' },
  'cormorant': { label:'Cormorant Garamond', family:"'Cormorant Garamond', serif", gid:'Cormorant+Garamond:ital,wght@0,300;0,600;1,300' },
  'lora':      { label:'Lora',               family:"'Lora', serif",               gid:'Lora:ital,wght@0,400;0,600;1,400' },
  'libre':     { label:'Libre Baskerville',  family:"'Libre Baskerville', serif",  gid:'Libre+Baskerville:ital,wght@0,400;0,700;1,400' },
};

const _loadedFonts = new Set(['dm-mono','fraunces']);

// ─── Apply functions ──────────────────────────────────────────────────────────

function applyTheme(id) {
  const t = THEMES[id];
  if (!t) return;
  const root = document.documentElement;
  root.setAttribute('data-theme', id);
  Object.entries(t.vars).forEach(([k, v]) => root.style.setProperty(k, v));
  t.isLight ? root.setAttribute('data-light-theme','1') : root.removeAttribute('data-light-theme');
}

function applyFontUi(id) {
  const f = UI_FONTS[id]; if (!f) return;
  document.documentElement.setAttribute('data-font-ui', id);
  document.documentElement.style.setProperty('--font-ui', f.family);
  _loadFont(id, f.gid);
}

function applyFontHead(id) {
  const f = HEADING_FONTS[id]; if (!f) return;
  document.documentElement.setAttribute('data-font-head', id);
  document.documentElement.style.setProperty('--font-head', f.family);
  _loadFont(id, f.gid);
}

function applyDensity(id) { document.documentElement.setAttribute('data-density', id); }
function applyRadius(id) {
  const map = { sharp:'2px', default:'10px', pill:'20px' };
  document.documentElement.setAttribute('data-radius', id);
  if (map[id]) document.documentElement.style.setProperty('--radius', map[id]);
}
function applyBgTexture(id)   { document.documentElement.setAttribute('data-bg-texture', id); }
function applyBubbleStyle(id) { document.documentElement.setAttribute('data-bubble', id); }

function _loadFont(id, gid) {
  if (!gid || _loadedFonts.has(id)) return;
  _loadedFonts.add(id);
  if (document.querySelector(`link[data-gfont="${gid}"]`)) return;
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = `https://fonts.googleapis.com/css2?family=${gid}&display=swap`;
  l.dataset.gfont = gid;
  document.head.appendChild(l);
}

function applyAllThemeSettings() {
  applyTheme(S.theme         || 'dark-gold');
  applyFontUi(S.fontUi       || 'dm-mono');
  applyFontHead(S.fontHead   || 'fraunces');
  applyDensity(S.density     || 'comfortable');
  applyRadius(S.radius       || 'default');
  applyBgTexture(S.bgTexture || 'grid');
  applyBubbleStyle(S.bubbleStyle || 'default');
}

// ─── Appearance section builder ───────────────────────────────────────────────

function buildAppearanceUI() {
  const section = document.getElementById('sp-appearance');
  if (!section) return;

  const cur = {
    theme:      S.theme       || 'dark-gold',
    fontUi:     S.fontUi      || 'dm-mono',
    fontHead:   S.fontHead    || 'fraunces',
    density:    S.density     || 'comfortable',
    radius:     S.radius      || 'default',
    texture:    S.bgTexture   || 'grid',
    bubble:     S.bubbleStyle || 'default',
    fontSize:   S.fontSize    || 'medium',
  };

  section.innerHTML = `
    <div class="sp-section-header">
      <h2>Appearance</h2>
      <p>All changes apply instantly. Your selection is saved automatically.</p>
    </div>

    <!-- THEME PICKER -->
    <div class="sp-card-header-label">Theme</div>
    <div class="sp-card sp-card-flush">
      <div class="nd-search-row">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input id="nd-theme-search" type="text" placeholder="Search themes…" autocomplete="off">
        <span id="nd-theme-count" class="nd-search-count"></span>
      </div>
      <div id="nd-theme-groups"></div>
    </div>

    <!-- UI FONT -->
    <div class="sp-card-header-label">Code &amp; UI Font</div>
    <div class="sp-card sp-card-flush">
      <div class="nd-font-grid" id="nd-font-ui-grid"></div>
    </div>

    <!-- HEADING FONT -->
    <div class="sp-card-header-label">Heading Font</div>
    <div class="sp-card sp-card-flush">
      <div class="nd-font-grid" id="nd-font-head-grid"></div>
    </div>

    <!-- FONT SIZE -->
    <div class="sp-card-header-label">Text Size</div>
    <div class="sp-card">
      <div class="sp-card-row sp-no-border">
        <div class="sp-card-label"><span>Base Font Size</span><small>Controls text size throughout the interface</small></div>
        <div class="sp-font-picker" id="nd-size-picker">
          <button class="sp-font-btn${cur.fontSize==='small' ?' active':''}" data-size="small"><span style="font-size:10px">Aa</span><span>Small</span></button>
          <button class="sp-font-btn${cur.fontSize==='medium'?' active':''}" data-size="medium"><span style="font-size:14px">Aa</span><span>Medium</span></button>
          <button class="sp-font-btn${cur.fontSize==='large' ?' active':''}" data-size="large"><span style="font-size:18px">Aa</span><span>Large</span></button>
        </div>
      </div>
    </div>

    <!-- DENSITY -->
    <div class="sp-card-header-label">Density</div>
    <div class="sp-card sp-card-flush">
      <div class="nd-option-row" id="nd-density-row">
        ${['compact','comfortable','spacious'].map(d => `
          <button class="nd-option-btn${cur.density===d?' active':''}" data-density="${d}">
            <div class="nd-density-preview nd-preview-${d}"><span></span><span></span><span></span></div>
            <span>${d.charAt(0).toUpperCase()+d.slice(1)}</span>
          </button>`).join('')}
      </div>
    </div>

    <!-- CORNER STYLE -->
    <div class="sp-card-header-label">Corner Style</div>
    <div class="sp-card sp-card-flush">
      <div class="nd-option-row" id="nd-radius-row">
        ${[['sharp','Sharp','1px'],['default','Rounded','10px'],['pill','Pill','24px']].map(([r,l,br]) => `
          <button class="nd-option-btn${cur.radius===r?' active':''}" data-radius="${r}">
            <div class="nd-radius-preview" style="border-radius:${br}"></div>
            <span>${l}</span>
          </button>`).join('')}
      </div>
    </div>

    <!-- BACKGROUND TEXTURE -->
    <div class="sp-card-header-label">Background Texture</div>
    <div class="sp-card sp-card-flush">
      <div class="nd-option-row" id="nd-texture-row">
        ${[['grid','Grid'],['dots','Dots'],['cross','Cross'],['none','None']].map(([t,l]) => `
          <button class="nd-option-btn${cur.texture===t?' active':''}" data-texture="${t}">
            <div class="nd-texture-preview nd-tex-${t}"></div>
            <span>${l}</span>
          </button>`).join('')}
      </div>
    </div>

    <!-- CHAT BUBBLE STYLE -->
    <div class="sp-card-header-label">Chat Bubble Style</div>
    <div class="sp-card sp-card-flush">
      <div class="nd-option-row" id="nd-bubble-row">
        ${[['default','Default'],['minimal','Minimal'],['bordered','Bordered']].map(([b,l]) => `
          <button class="nd-option-btn${cur.bubble===b?' active':''}" data-bubble="${b}">
            <div class="nd-bubble-preview nd-bub-${b}">
              <div class="nd-bub-msg nd-bub-user">You</div>
              <div class="nd-bub-msg nd-bub-ai">AI</div>
            </div>
            <span>${l}</span>
          </button>`).join('')}
      </div>
    </div>
  `;

  // ── Build theme groups ────────────────────────────────────────────────────
  _buildThemeGroups(cur.theme);

  // ── Search ────────────────────────────────────────────────────────────────
  document.getElementById('nd-theme-search').addEventListener('input', function() {
    _filterThemes(this.value.trim().toLowerCase(), cur.theme);
  });

  // ── Font grids ────────────────────────────────────────────────────────────
  _buildFontGrid('nd-font-ui-grid',   UI_FONTS,      cur.fontUi,   'fontUi',   applyFontUi,   "'fn()→42'");
  _buildFontGrid('nd-font-head-grid', HEADING_FONTS, cur.fontHead, 'fontHead', applyFontHead, 'NeuralDock');

  // ── Font size ─────────────────────────────────────────────────────────────
  section.querySelectorAll('#nd-size-picker .sp-font-btn').forEach(btn =>
    btn.addEventListener('click', () => {
      setFontSize(btn.dataset.size);
      section.querySelectorAll('#nd-size-picker .sp-font-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.size === btn.dataset.size));
    })
  );

  // ── Generic option pickers (density/radius/texture/bubble) ───────────────
  [['data-density','density',applyDensity,'density'],
   ['data-radius',  'radius',  applyRadius,  'radius'],
   ['data-texture', 'bgTexture',applyBgTexture,'bgTexture'],
   ['data-bubble',  'bubbleStyle',applyBubbleStyle,'bubble'],
  ].forEach(([attr, sKey, applyFn, rowKey]) => {
    section.querySelectorAll(`[${attr}]`).forEach(btn =>
      btn.addEventListener('click', () => {
        const val = btn.getAttribute(attr);
        S[sKey] = val; applyFn(val); saveSettings();
        section.querySelectorAll(`[${attr}]`).forEach(b =>
          b.classList.toggle('active', b.getAttribute(attr) === val));
      })
    );
  });
}

// ─── Theme group renderer ─────────────────────────────────────────────────────

function _buildThemeGroups(activeId, filterQ = '') {
  const container = document.getElementById('nd-theme-groups');
  if (!container) return;
  container.innerHTML = '';
  let totalVisible = 0;

  THEME_GROUPS.forEach(group => {
    const matches = filterQ
      ? group.ids.filter(id => {
          const t = THEMES[id];
          return t && (id.includes(filterQ) || t.label.toLowerCase().includes(filterQ));
        })
      : group.ids.filter(id => THEMES[id]);

    if (!matches.length) return;
    totalVisible += matches.length;

    const groupEl = document.createElement('div');
    groupEl.className = 'nd-group';
    groupEl.dataset.groupId = group.id;

    // Header
    const hdr = document.createElement('button');
    hdr.className = 'nd-group-hdr';
    hdr.innerHTML = `
      <span class="nd-group-emoji">${group.emoji}</span>
      <span class="nd-group-name">${group.label}</span>
      <span class="nd-group-count">${matches.length}</span>
      <svg class="nd-group-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>`;

    const grid = document.createElement('div');
    grid.className = 'nd-theme-grid';

    // Expand/collapse
    hdr.addEventListener('click', () => {
      const collapsed = groupEl.classList.toggle('nd-group-collapsed');
      grid.style.display = collapsed ? 'none' : '';
    });

    matches.forEach(id => {
      const t = THEMES[id];
      const btn = document.createElement('button');
      btn.className = 'nd-theme-swatch' + (id === activeId ? ' active' : '');
      btn.dataset.themeId = id;
      btn.title = t.label;

      // Single inline-gradient div — avoids flex-child-in-button height collapse bug
      const previewBg = `linear-gradient(to right, ${t.preview.bg} 55%, ${t.preview.sec} 82%, ${t.preview.accent} 100%)`;
      btn.innerHTML = `
        <div class="nd-ts-preview" style="background:${previewBg}"></div>
        <div class="nd-ts-name">${t.label}</div>`;

      btn.addEventListener('click', () => {
        S.theme = id;
        applyTheme(id);
        saveSettings();
        // Update all swatches
        document.querySelectorAll('.nd-theme-swatch').forEach(b =>
          b.classList.toggle('active', b.dataset.themeId === id));
      });
      grid.appendChild(btn);
    });

    groupEl.appendChild(hdr);
    groupEl.appendChild(grid);
    container.appendChild(groupEl);
  });

  // Update count badge
  const countEl = document.getElementById('nd-theme-count');
  if (countEl) {
    countEl.textContent = filterQ ? `${totalVisible} found` : `${Object.keys(THEMES).length} themes`;
  }
}

function _filterThemes(q, activeId) {
  _buildThemeGroups(activeId, q);
  // Auto-expand all groups when searching
  if (q) {
    document.querySelectorAll('.nd-group-collapsed').forEach(el => {
      el.classList.remove('nd-group-collapsed');
      const grid = el.querySelector('.nd-theme-grid');
      if (grid) grid.style.display = '';
    });
  }
}

// ─── Font grid builder ────────────────────────────────────────────────────────

function _buildFontGrid(containerId, fonts, currentId, sKey, applyFn, sample) {
  const grid = document.getElementById(containerId);
  if (!grid) return;
  // Preload all fonts for live preview
  Object.entries(fonts).forEach(([id, f]) => { if (f.gid) _loadFont(id, f.gid); });

  Object.entries(fonts).forEach(([id, f]) => {
    const btn = document.createElement('button');
    btn.className = 'nd-font-card' + (id === currentId ? ' active' : '');
    btn.dataset.fontId = id;
    btn.innerHTML = `
      <span class="nd-fc-sample" style="font-family:${f.family}">${sample}</span>
      <span class="nd-fc-label">${f.label}</span>`;
    btn.addEventListener('click', () => {
      S[sKey] = id; applyFn(id); saveSettings();
      grid.querySelectorAll('.nd-font-card').forEach(b =>
        b.classList.toggle('active', b.dataset.fontId === id));
    });
    grid.appendChild(btn);
  });
}
