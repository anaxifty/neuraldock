/**
 * state.js — Application state (S) and persistence
 * Refactored for New UI
 */

'use strict';

const S = {
  // Auth
  currentUser: null,

  // Conversations
  conversations: JSON.parse(localStorage.getItem('nd_convs') || '{}'),
  activeConvId:  null,
  chatMessages:  [],

  // Model + generation
  currentModel:   'gpt-4o',
  length:         'balanced',
  systemPrompt:   '',

  // UI
  fontSize:    '14',
  busy:        false,
  abortStream: false,
  attachments: [],
};

// Restore persisted settings
try {
  const saved = localStorage.getItem('nd_settings');
  if (saved) {
    const cfg = JSON.parse(saved);
    const KEYS = ['currentModel', 'systemPrompt', 'fontSize', 'length'];
    for (const k of KEYS) if (k in cfg) S[k] = cfg[k];
  }
} catch (e) {}

function saveSettings() {
  const cfg = {
    currentModel: S.currentModel,
    systemPrompt: S.systemPrompt,
    fontSize:     S.fontSize,
    length:       S.length,
  };
  localStorage.setItem('nd_settings', JSON.stringify(cfg));
}

function saveConvs() {
  localStorage.setItem('nd_convs', JSON.stringify(S.conversations));
}
