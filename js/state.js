/**
 * state.js — Application state (S) and localStorage persistence
 * Depends on: nothing
 */

'use strict';

/** Global application state */
const S = {
  // Conversations
  conversations: JSON.parse(localStorage.getItem('aistudio_convs') || '{}'),
  activeConvId: null,
  chatMessages: [],

  // Model + generation
  currentModel: 'gpt-4o',
  deepThink: false,
  webSearch: false,
  temperature: 0.7,
  responseLength: 'balanced',

  // Memory / system
  memoryEnabled: true,
  systemPrompt: '',
  customInstructions: '',

  // Voice
  speakResponses: false,
  speakSpeed: 1.0,

  // UI
  fontSize: 'medium',
  pinnedConvs: [],

  // Runtime (never persisted)
  busy: false,
  abortStream: false,
  activeStyle: '',
  attachments: [],  // pending file attachments: [{name, type, dataUrl?, content?}]
};

// Restore persisted settings (runtime-only fields stay at defaults above)
try {
  const saved = localStorage.getItem('aistudio_settings');
  if (saved) {
    const cfg = JSON.parse(saved);
    const PERSIST_KEYS = [
      'currentModel', 'memoryEnabled', 'speakResponses', 'speakSpeed',
      'systemPrompt', 'customInstructions', 'temperature', 'fontSize',
      'responseLength', 'pinnedConvs',
    ];
    for (const key of PERSIST_KEYS) {
      if (key in cfg) S[key] = cfg[key];
    }
  }
} catch (e) {
  console.warn('[state] Failed to restore settings:', e);
}

/** Persist user preferences to localStorage (non-sensitive keys only) */
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
  };
  try {
    localStorage.setItem('aistudio_settings', JSON.stringify(cfg));
  } catch (e) {
    console.warn('[state] saveSettings failed:', e);
  }
}

/** Persist all conversations to localStorage */
function saveConvs() {
  try {
    localStorage.setItem('aistudio_convs', JSON.stringify(S.conversations));
  } catch (e) {
    console.warn('[state] saveConvs failed:', e);
  }
}

/** No-op stub — token counter was removed. Kept to avoid call-site errors. */
function updateCtxIndicator() {}
