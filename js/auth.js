/**
 * auth.js — Authentication layer
 *
 * Two auth systems work together:
 *   1. Supabase Auth  → NeuralDock account (GitHub / Google / Email)
 *                       Stores conversations, settings, IDE projects
 *   2. Puter Auth     → AI model calls (happens after Supabase auth)
 *                       Users need a free Puter account for AI usage
 *
 * If Supabase is not configured, falls back to Puter-only mode (original behaviour).
 *
 * Depends on: supabase.js, db.js, state.js, utils.js, ui.js
 */

'use strict';

// ── State ──────────────────────────────────────────────────────────────────
let authPollInterval = null;
let _puterAuthed     = false;

// ══════════════════════════════════════════════════════════════════════════
//  ENTRY POINT — run on page load
// ══════════════════════════════════════════════════════════════════════════

window.addEventListener('load', async () => {
  const stopBtn = document.getElementById('chatStopBtn');
  if (stopBtn) stopBtn.style.display = 'none';

  if (!supabaseConfigured()) {
    // ── Fallback: Puter-only mode (no Supabase credentials yet) ──────────
    console.info('[auth] Supabase not configured — running in Puter-only mode');
    setupPuterOnlyUI();
    try {
      if (puter.auth.isSignedIn()) {
        const user = await puter.auth.getUser();
        _puterAuthed = true;
        onFullyAuthed({ id: user.username, username: user.username, email: user.email });
      }
    } catch (e) { /* not authed */ }
    return;
  }

  // ── Supabase mode ─────────────────────────────────────────────────────
  setupSupabaseUI();

  const sb = await getSupabase();

  // Listen for auth state changes (handles OAuth redirects automatically)
  sb.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session?.user) {
      await handleSupabaseUser(session.user);
    } else if (event === 'SIGNED_OUT') {
      showLoginScreen();
    } else if (event === 'TOKEN_REFRESHED') {
      // Session refreshed silently — nothing to do
    }
  });

  // Check for existing session
  const { data: { session } } = await sb.auth.getSession();
  if (session?.user) {
    await handleSupabaseUser(session.user);
  } else {
    showLoginScreen();
  }
});

// ══════════════════════════════════════════════════════════════════════════
//  SUPABASE AUTH HANDLERS
// ══════════════════════════════════════════════════════════════════════════

async function handleSupabaseUser(user) {
  S.currentUser = user;
  await dbUpsertProfile(user);
  await dbLoadSettings(user.id);
  await dbLoadConversations(user.id);
  // Now trigger Puter auth in the background for AI calls
  triggerPuterAuth(user);
}

/** Sign in with GitHub */
async function signInWithGitHub() {
  setLoginStatus('Redirecting to GitHub…', false);
  const sb = await getSupabase();
  const { error } = await sb.auth.signInWithOAuth({
    provider: 'github',
    options:  { redirectTo: window.location.origin },
  });
  if (error) setLoginStatus('GitHub sign-in failed: ' + error.message, true);
}

/** Sign in with Google */
async function signInWithGoogle() {
  setLoginStatus('Redirecting to Google…', false);
  const sb = await getSupabase();
  const { error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options:  { redirectTo: window.location.origin },
  });
  if (error) setLoginStatus('Google sign-in failed: ' + error.message, true);
}

/** Sign in or sign up with email + password */
async function signInWithEmail(email, password, isSignUp) {
  setLoginStatus(isSignUp ? 'Creating account…' : 'Signing in…', false);
  const sb = await getSupabase();
  let result;
  if (isSignUp) {
    result = await sb.auth.signUp({ email, password });
    if (!result.error && result.data?.user && !result.data.session) {
      // Email confirmation required
      setLoginStatus('Check your email to confirm your account, then sign in.', false);
      return;
    }
  } else {
    result = await sb.auth.signInWithPassword({ email, password });
  }
  if (result.error) {
    setLoginStatus(result.error.message, true);
    shakeForm();
  }
}

/** Send a password reset email */
async function sendPasswordReset(email) {
  if (!email) { setLoginStatus('Enter your email first.', true); return; }
  const sb = await getSupabase();
  const { error } = await sb.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + '/?reset=1',
  });
  setLoginStatus(error ? error.message : 'Reset email sent! Check your inbox.', !!error);
}

// ══════════════════════════════════════════════════════════════════════════
//  PUTER AUTH (for AI calls)
// ══════════════════════════════════════════════════════════════════════════

function triggerPuterAuth(supabaseUser) {
  try {
    if (puter.auth.isSignedIn()) {
      _puterAuthed = true;
      onFullyAuthed(supabaseUser);
    } else {
      // Show the Puter connect banner, don't block the app
      showPuterBanner();
      onFullyAuthed(supabaseUser); // App loads immediately, AI requires Puter
    }
  } catch (e) {
    showPuterBanner();
    onFullyAuthed(supabaseUser);
  }
}

function setupPuterOnlyUI() {
  // Show original Puter-only login button
  const card = document.querySelector('.login-card');
  if (!card) return;
  const puterBtn = document.getElementById('login-btn');
  if (puterBtn) {
    puterBtn.addEventListener('click', startPuterLogin);
    puterBtn.style.display = '';
  }
  const fallbackBtn = document.getElementById('login-fallback');
  if (fallbackBtn) fallbackBtn.addEventListener('click', manualPuterCheck);

  // Hide Supabase auth buttons if they exist
  ['login-github-btn','login-google-btn','login-email-form'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
}

function startPuterLogin() {
  const statusEl   = document.getElementById('login-status');
  const fallbackEl = document.getElementById('login-fallback');
  statusEl.innerHTML = 'Opening sign-in window<span class="polling-dots"></span>';
  fallbackEl.classList.remove('visible');
  puter.auth.signIn();
  let ticks = 0;
  if (authPollInterval) clearInterval(authPollInterval);
  authPollInterval = setInterval(async () => {
    ticks++;
    try {
      if (puter.auth.isSignedIn()) {
        clearInterval(authPollInterval);
        const user = await puter.auth.getUser();
        _puterAuthed = true;
        onFullyAuthed({ id: user.username, username: user.username, email: user.email });
        return;
      }
    } catch (e) {}
    if (ticks === 6) fallbackEl.classList.add('visible');
    if (ticks >= 150) {
      clearInterval(authPollInterval);
      statusEl.textContent = 'Sign-in timed out. Please try again.';
    }
  }, 800);
}

async function manualPuterCheck() {
  try {
    if (puter.auth.isSignedIn()) {
      const user = await puter.auth.getUser();
      _puterAuthed = true;
      onFullyAuthed({ id: user.username, username: user.username, email: user.email });
    } else {
      document.getElementById('login-status').textContent = 'Not signed in yet.';
    }
  } catch (e) {
    document.getElementById('login-status').textContent = 'Error checking auth.';
  }
}

// ══════════════════════════════════════════════════════════════════════════
//  PUTER CONNECT BANNER (shown when user is Supabase-authed but not Puter)
// ══════════════════════════════════════════════════════════════════════════

function showPuterBanner() {
  const existing = document.getElementById('puter-banner');
  if (existing) return;
  const banner = document.createElement('div');
  banner.id = 'puter-banner';
  banner.className = 'puter-banner';
  banner.innerHTML = `
    <div class="puter-banner-inner">
      <span class="puter-banner-icon">⚡</span>
      <span class="puter-banner-text">
        <strong>Connect your Puter account</strong> to unlock AI features — it's free.
      </span>
      <button class="puter-banner-btn" id="puter-connect-btn">Connect Puter</button>
      <button class="puter-banner-dismiss" id="puter-banner-dismiss" title="Dismiss">×</button>
    </div>
  `;
  document.getElementById('app')?.prepend(banner);

  document.getElementById('puter-connect-btn')?.addEventListener('click', () => {
    puter.auth.signIn();
    let ticks = 0;
    const iv = setInterval(async () => {
      ticks++;
      try {
        if (puter.auth.isSignedIn()) {
          clearInterval(iv);
          _puterAuthed = true;
          banner.remove();
          toast('Puter connected — AI features unlocked! ✓');
          return;
        }
      } catch (e) {}
      if (ticks > 150) clearInterval(iv);
    }, 800);
  });

  document.getElementById('puter-banner-dismiss')?.addEventListener('click', () => {
    banner.remove();
    sessionStorage.setItem('puter_banner_dismissed', '1');
  });
}

// ══════════════════════════════════════════════════════════════════════════
//  FULLY AUTHED — bootstrap the app
// ══════════════════════════════════════════════════════════════════════════

function onFullyAuthed(user) {
  if (authPollInterval) clearInterval(authPollInterval);

  document.getElementById('login-screen').style.display = 'none';

  // Update sidebar user display
  const displayName = user.username || user.user_metadata?.user_name || user.email?.split('@')[0] || 'User';
  const initial     = displayName[0].toUpperCase();
  const avatarUrl   = user.user_metadata?.avatar_url || null;
  const avatarEl    = document.getElementById('user-avatar');
  const nameEl      = document.getElementById('user-name');

  if (avatarEl) {
    if (avatarUrl) {
      avatarEl.style.backgroundImage = `url(${avatarUrl})`;
      avatarEl.style.backgroundSize  = 'cover';
      avatarEl.style.backgroundPosition = 'center';
      avatarEl.textContent = '';
    } else {
      avatarEl.textContent = initial;
    }
  }
  if (nameEl) nameEl.textContent = displayName;

  // Add sign-out button to sidebar
  addSignOutButton();

  // Bootstrap all app subsystems
  renderSidebar();
  buildModelDropdown();
  updateModelDisplay();
  applyFontSize(S.fontSize);
  populateSettingsModel();
  applySettingsUI();
  updateImageModels();
  updateVoiceOptions();
  applyLengthUI();
  fetchAndMergeModels();
}

// ══════════════════════════════════════════════════════════════════════════
//  UI HELPERS
// ══════════════════════════════════════════════════════════════════════════

function setupSupabaseUI() {
  // GitHub button
  document.getElementById('login-github-btn')?.addEventListener('click', signInWithGitHub);
  // Google button
  document.getElementById('login-google-btn')?.addEventListener('click', signInWithGoogle);

  // Email form toggle
  const emailToggle = document.getElementById('login-email-toggle');
  const emailForm   = document.getElementById('login-email-form');
  emailToggle?.addEventListener('click', () => {
    const open = emailForm.style.display !== 'none';
    emailForm.style.display = open ? 'none' : '';
    emailToggle.textContent = open ? 'Sign in with Email ↓' : 'Hide email form ↑';
  });

  // Email form submit
  document.getElementById('login-email-submit')?.addEventListener('click', () => {
    const email    = document.getElementById('login-email-input')?.value?.trim();
    const password = document.getElementById('login-password-input')?.value;
    const isSignUp = document.getElementById('login-mode-toggle')?.dataset.mode === 'signup';
    if (!email || !password) { setLoginStatus('Enter your email and password.', true); return; }
    if (isSignUp && password.length < 8) { setLoginStatus('Password must be at least 8 characters.', true); return; }
    signInWithEmail(email, password, isSignUp);
  });

  // Allow Enter key in password field
  document.getElementById('login-password-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('login-email-submit')?.click();
  });

  // Sign in / Sign up mode toggle
  const modeToggle = document.getElementById('login-mode-toggle');
  modeToggle?.addEventListener('click', () => {
    const isSignUp = modeToggle.dataset.mode !== 'signup';
    modeToggle.dataset.mode    = isSignUp ? 'signup' : 'signin';
    modeToggle.textContent     = isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up";
    const submitBtn = document.getElementById('login-email-submit');
    if (submitBtn) submitBtn.textContent = isSignUp ? 'Create Account' : 'Sign In';
  });

  // Forgot password
  document.getElementById('login-forgot-btn')?.addEventListener('click', () => {
    const email = document.getElementById('login-email-input')?.value?.trim();
    sendPasswordReset(email);
  });
}

function showLoginScreen() {
  document.getElementById('login-screen').style.display = '';
}

function setLoginStatus(msg, isError = false) {
  const el = document.getElementById('login-status');
  if (!el) return;
  el.textContent  = msg;
  el.style.color  = isError ? 'var(--err)' : 'var(--muted)';
}

function shakeForm() {
  const card = document.querySelector('.login-card');
  if (!card) return;
  card.classList.add('shake');
  setTimeout(() => card.classList.remove('shake'), 500);
}

function addSignOutButton() {
  const footer = document.querySelector('.sidebar-footer');
  if (!footer || document.getElementById('sign-out-btn')) return;
  const btn = document.createElement('button');
  btn.id        = 'sign-out-btn';
  btn.className = 'sidebar-settings-btn';
  btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg> Sign Out`;
  btn.addEventListener('click', async () => {
    if (!confirm('Sign out of NeuralDock?')) return;
    if (supabaseConfigured()) await dbSignOut();
    try { puter.auth.signOut?.(); } catch (e) {}
    S.currentUser   = null;
    S.conversations = {};
    S.chatMessages  = [];
    S.activeConvId  = null;
    localStorage.clear();
    window.location.reload();
  });
  footer.insertBefore(btn, footer.querySelector('.sidebar-user'));
}
