/**
 * auth.js — Puter sign-in flow and post-auth initialisation
 * Depends on: state.js, config.js, utils.js
 * Calls: onAuthed (defined here, calls functions from ui.js, image.js, voice.js, settings.js)
 */

'use strict';

let authPollInterval = null;

document.getElementById('login-btn').addEventListener('click', startLogin);
document.getElementById('login-fallback').addEventListener('click', manualLoginCheck);

/** Open Puter sign-in popup and poll until auth succeeds */
function startLogin() {
  const statusEl  = document.getElementById('login-status');
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
        onAuthed(user);
        return;
      }
    } catch (e) { /* puter not ready yet */ }

    // Show "already signed in?" link after a few seconds
    if (ticks === 6)  fallbackEl.classList.add('visible');
    if (ticks >= 150) {
      clearInterval(authPollInterval);
      statusEl.textContent = 'Sign-in timed out. Please try again.';
    }
  }, 800);
}

/** Manual fallback check — user already has a Puter session */
async function manualLoginCheck() {
  try {
    if (puter.auth.isSignedIn()) {
      const user = await puter.auth.getUser();
      onAuthed(user);
    } else {
      document.getElementById('login-status').textContent = 'Not signed in yet.';
    }
  } catch (e) {
    document.getElementById('login-status').textContent = 'Error checking auth.';
  }
}

/**
 * Called once authentication succeeds.
 * Hides login screen and bootstraps the entire app.
 * @param {object} user  Puter user object
 */
function onAuthed(user) {
  if (authPollInterval) clearInterval(authPollInterval);

  document.getElementById('login-screen').style.display = 'none';

  if (user) {
    const initial = (user.username || user.email || '?')[0].toUpperCase();
    document.getElementById('user-avatar').textContent = initial;
    document.getElementById('user-name').textContent   = user.username || user.email || 'User';
  }

  // Bootstrap app subsystems
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

// Auto-login if session already exists on page load
window.addEventListener('load', async () => {
  try {
    if (puter.auth.isSignedIn()) {
      const user = await puter.auth.getUser();
      onAuthed(user);
    }
  } catch (e) { /* not authed */ }

  // Hide stop button on load
  const stopBtn = document.getElementById('chatStopBtn');
  if (stopBtn) stopBtn.style.display = 'none';
});
