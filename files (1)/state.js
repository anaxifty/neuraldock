/**
 * STATE.JS PATCH
 * ─────────────────────────────────────────────────────────────────────────
 * In js/state.js, make TWO small edits:
 *
 * EDIT 1 — Add new fields to the S object (around line 30, after fontSize):
 *
 *   // Add these 6 lines alongside the existing S = { ... } block:
 *   theme:        'dark-gold',
 *   fontUi:       'dm-mono',
 *   fontHead:     'fraunces',
 *   density:      'comfortable',
 *   radius:       'default',
 *   bgTexture:    'grid',
 *   bubbleStyle:  'default',
 *
 *
 * EDIT 2 — Add new keys to the KEYS array in the "Restore persisted settings"
 *           block (around line 50):
 *
 *   Replace this line:
 *     'currentModel', 'memoryEnabled', 'speakResponses', 'speakSpeed',
 *     'systemPrompt', 'customInstructions', 'temperature', 'fontSize',
 *     'responseLength', 'pinnedConvs',
 *
 *   With:
 *     'currentModel', 'memoryEnabled', 'speakResponses', 'speakSpeed',
 *     'systemPrompt', 'customInstructions', 'temperature', 'fontSize',
 *     'responseLength', 'pinnedConvs',
 *     'theme', 'fontUi', 'fontHead', 'density', 'radius', 'bgTexture', 'bubbleStyle',
 *
 *
 * EDIT 3 — Add new keys to the cfg object in saveSettings() (around line 70):
 *
 *   Add these lines inside the cfg = { ... } object in saveSettings():
 *   theme:        S.theme,
 *   fontUi:       S.fontUi,
 *   fontHead:     S.fontHead,
 *   density:      S.density,
 *   radius:       S.radius,
 *   bgTexture:    S.bgTexture,
 *   bubbleStyle:  S.bubbleStyle,
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Below is a copy of the COMPLETE updated state.js for reference.
 * You can replace js/state.js entirely with this file.
 * ─────────────────────────────────────────────────────────────────────────
 */

'use strict';

const S = {
  // Auth
  currentUser: null,

  // Conversations
  conversations: JSON.parse(localStorage.getItem('aistudio_convs') || '{}'),
  activeConvId:  null,
  chatMessages:  [],

  // Model + generation
  currentModel:   'gpt-4o',
  deepThink:      false,
  webSearch:      false,
  temperature:    0.7,
  responseLength: 'balanced',

  // Memory / system
  memoryEnabled:      true,
  systemPrompt:       '',
  customInstructions: '',

  // Voice
  speakResponses: false,
  speakSpeed:     1.0,

  // UI — existing
  fontSize:    'medium',
  pinnedConvs: [],

  // ── NEW: Theme & appearance ──────────────────────────────────────────
  theme:       'dark-gold',
  fontUi:      'dm-mono',
  fontHead:    'fraunces',
  density:     'comfortable',
  radius:      'default',
  bgTexture:   'grid',
  bubbleStyle: 'default',
  // ────────────────────────────────────────────────────────────────────

  // Runtime (never persisted)
  busy:        false,
  abortStream: false,
  activeStyle: '',
  attachments: [],
};

// Restore persisted settings from localStorage on startup
try {
  const saved = localStorage.getItem('aistudio_settings');
  if (saved) {
    const cfg = JSON.parse(saved);
    const KEYS = [
      'currentModel', 'memoryEnabled', 'speakResponses', 'speakSpeed',
      'systemPrompt', 'customInstructions', 'temperature', 'fontSize',
      'responseLength', 'pinnedConvs',
      // NEW keys ↓
      'theme', 'fontUi', 'fontHead', 'density', 'radius', 'bgTexture', 'bubbleStyle',
    ];
    for (const k of KEYS) {
      if (k in cfg) S[k] = cfg[k];
    }
  }
} catch (e) {
  console.warn('[state] Failed to restore settings:', e);
}

function saveSettings() {
  const cfg = {
    currentModel:       S.currentModel,
    memoryEnabled:      S.memoryEnabled,
    speakResponses:     S.speakResponses,
    speakSpeed:         S.speakSpeed,
    systemPrompt:       S.systemPrompt,
    customInstructions: S.customInstructions,
    temperature:        S.temperature,
    fontSize:           S.fontSize,
    responseLength:     S.responseLength,
    pinnedConvs:        S.pinnedConvs,
    // NEW keys ↓
    theme:              S.theme,
    fontUi:             S.fontUi,
    fontHead:           S.fontHead,
    density:            S.density,
    radius:             S.radius,
    bgTexture:          S.bgTexture,
    bubbleStyle:        S.bubbleStyle,
  };
  try { localStorage.setItem('aistudio_settings', JSON.stringify(cfg)); } catch (e) {}
  if (typeof dbSaveSettings === 'function') dbSaveSettings();
}

function saveConvs(convId) {
  try { localStorage.setItem('aistudio_convs', JSON.stringify(S.conversations)); } catch (e) {}
  if (typeof dbSaveConversation === 'function') {
    const target = convId
      ? S.conversations[convId]
      : S.activeConvId ? S.conversations[S.activeConvId] : null;
    if (target) dbSaveConversation(target);
  }
}

function updateCtxIndicator() {}
