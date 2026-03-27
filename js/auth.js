/**
 * auth.js — Supabase + Puter authentication logic
 * Refactored for New UI
 */

'use strict';

let _puterAuthed = false;
let authPollInterval = null;

async function initAuth() {
  if (supabaseConfigured()) {
    const client = getSupabaseClient();
    const { data: { session } } = await client.auth.getSession();
    if (session) {
      triggerPuterAuth(session.user);
    } else {
      setupSupabaseUI();
    }
    // Listen for auth changes
    client.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) triggerPuterAuth(session.user);
      if (event === 'SIGNED_OUT') window.location.reload();
    });
  } else {
    setupPuterOnlyUI();
  }
}

function triggerPuterAuth(supabaseUser) {
  try {
    if (puter.auth.isSignedIn()) {
      _puterAuthed = true;
      onFullyAuthed(supabaseUser);
    } else {
      // Puter AI requires sign-in, but we can load the app if Supabase is authed
      onFullyAuthed(supabaseUser);
    }
  } catch (e) {
    onFullyAuthed(supabaseUser);
  }
}

function setupPuterOnlyUI() {
  document.getElementById('login-btn')?.addEventListener('click', startPuterLogin);
  document.getElementById('login-fallback')?.addEventListener('click', manualPuterCheck);
}

function startPuterLogin() {
  const statusEl = document.getElementById('login-status');
  const fallbackEl = document.getElementById('login-fallback');
  if (statusEl) statusEl.textContent = 'Opening sign-in window...';

  puter.auth.signIn();

  if (authPollInterval) clearInterval(authPollInterval);
  authPollInterval = setInterval(async () => {
    try {
      if (puter.auth.isSignedIn()) {
        clearInterval(authPollInterval);
        const user = await puter.auth.getUser();
        _puterAuthed = true;
        onFullyAuthed({ id: user.username, username: user.username, email: user.email });
      }
    } catch (e) {}
  }, 1000);
}

async function manualPuterCheck() {
  if (puter.auth.isSignedIn()) {
    const user = await puter.auth.getUser();
    _puterAuthed = true;
    onFullyAuthed({ id: user.username, username: user.username, email: user.email });
  }
}

function onFullyAuthed(user) {
  if (authPollInterval) clearInterval(authPollInterval);
  S.currentUser = user;

  document.getElementById('login-screen').style.display = 'none';

  // Update UI
  const displayName = user.username || user.user_metadata?.user_name || user.email?.split('@')[0] || 'User';
  const initial = displayName[0].toUpperCase();
  const avatarEl = document.getElementById('user-avatar');
  const nameEl = document.getElementById('user-name');

  if (avatarEl) avatarEl.textContent = initial;
  if (nameEl) nameEl.textContent = displayName;

  // Bootstrap subsystems
  renderSidebar();
  updateModelDisplay();
  applySettingsUI();

  if (typeof fetchAndMergeModels === 'function') fetchAndMergeModels();
}

function setupSupabaseUI() {
  document.getElementById('login-btn')?.addEventListener('click', startPuterLogin);
  document.getElementById('login-github-btn')?.addEventListener('click', () => signInWithGitHub());
  document.getElementById('login-google-btn')?.addEventListener('click', () => signInWithGoogle());

  const emailToggle = document.getElementById('login-email-toggle');
  const emailForm = document.getElementById('login-email-form');
  emailToggle?.addEventListener('click', () => {
    emailForm.style.display = emailForm.style.display === 'none' ? 'block' : 'none';
  });

  document.getElementById('login-email-submit')?.addEventListener('click', () => {
    const email = document.getElementById('login-email-input')?.value;
    const password = document.getElementById('login-password-input')?.value;
    const isSignUp = document.getElementById('login-mode-toggle')?.dataset.mode === 'signup';
    signInWithEmail(email, password, isSignUp);
  });

  const modeToggle = document.getElementById('login-mode-toggle');
  modeToggle?.addEventListener('click', () => {
    const isSignUp = modeToggle.dataset.mode !== 'signup';
    modeToggle.dataset.mode = isSignUp ? 'signup' : 'signin';
    modeToggle.textContent = isSignUp ? 'Already have an account? Sign in' : 'No account? Sign up';
    document.getElementById('login-email-submit').textContent = isSignUp ? 'Create Account' : 'Sign In';
  });

  document.getElementById('sp-signout-btn')?.addEventListener('click', async () => {
      if (supabaseConfigured()) await dbSignOut();
      try { puter.auth.signOut(); } catch(e) {}
      localStorage.clear();
      window.location.reload();
  });
}

function setLoginStatus(msg, isError = false) {
  const el = document.getElementById('login-status');
  if (el) {
      el.textContent = msg;
      el.style.color = isError ? '#ff6e84' : 'inherit';
  }
}

// Start auth on load
window.addEventListener('DOMContentLoaded', initAuth);
