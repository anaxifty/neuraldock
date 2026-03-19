/**
 * state.js — Application state (S) and persistence
 * Hybrid: localStorage (instant) + Supabase (cloud sync, debounced)
 * Depends on: nothing (db.js functions called conditionally after load)
 */

'use strict';

const S = {
  // Auth
  currentUser: null,   // Supabase user object once authed

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

  // UI
  fontSize:    'medium',
  pinnedConvs: [],

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
    ];
    for (const k of KEYS) {
      if (k in cfg) S[k] = cfg[k];
    }
  }
} catch (e) {
  console.warn('[state] Failed to restore settings:', e);
}

/**
 * Save settings to localStorage immediately, then sync to Supabase (debounced).
 */
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
  try { localStorage.setItem('aistudio_settings', JSON.stringify(cfg)); } catch (e) {}
  // Sync to Supabase if available
  if (typeof dbSaveSettings === 'function') dbSaveSettings();
}

/**
 * Save all conversations to localStorage immediately, then sync active conv to Supabase.
 * @param {string} [convId]  If provided, only syncs that conversation to Supabase.
 */
function saveConvs(convId) {
  try { localStorage.setItem('aistudio_convs', JSON.stringify(S.conversations)); } catch (e) {}
  // Sync to Supabase
  if (typeof dbSaveConversation === 'function') {
    const target = convId
      ? S.conversations[convId]
      : S.activeConvId ? S.conversations[S.activeConvId] : null;
    if (target) dbSaveConversation(target);
  }
}

/** No-op stub — token counter was removed. Kept to avoid call-site errors. */
function updateCtxIndicator() {}
