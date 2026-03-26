/**
 * utils.js — Shared helper functions
 */

'use strict';

function escHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function md(s) {
  if (typeof marked === 'undefined') return s;
  return marked.parse(s);
}

function relativeTime(ms) {
  const d = new Date(ms);
  const now = new Date();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString();
}

async function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

function saveState() {
    if (typeof saveSettings === 'function') saveSettings();
}

function applyAllThemeSettings() {
    document.documentElement.classList.add('dark');
}

// Full MODELS registry from old config.js
const MODELS = [
  {
    provider: 'OpenAI',
    color: '#10a37f',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o Production' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
    ]
  },
  {
    provider: 'Anthropic',
    color: '#d97706',
    models: [
      { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet' },
      { id: 'claude-3-opus', name: 'Claude 3 Opus' },
    ]
  },
  {
    provider: 'Google',
    color: '#4285f4',
    models: [
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
    ]
  }
];

// Full VOICE_REGISTRY from old config.js
const VOICE_REGISTRY = {
  'openai': {
    voices: [['alloy','Alloy'],['ash','Ash'],['ballad','Ballad'],['coral','Coral'],['echo','Echo'],['fable','Fable'],['nova','Nova'],['onyx','Onyx'],['sage','Sage'],['shimmer','Shimmer']],
  },
  'aws-polly': {
    voices: [['Joanna','Joanna'],['Matthew','Matthew'],['Salli','Salli'],['Ivy','Ivy'],['Kendra','Kendra'],['Kimberly','Kimberly']],
  },
  'elevenlabs': {
    voices: [['21m00Tcm4TlvDq8ikWAM','Rachel'],['EXAVITQu4vr4xnSDxMaL','Bella'],['MF3mGyEYCl7XYWbV9V6O','Elli']],
  }
};
