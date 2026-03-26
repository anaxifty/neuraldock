/**
 * supabase.js — Supabase client initialisation
 */

'use strict';

const SUPABASE_URL  = 'https://oxlqyzdbsmltiiiqaife.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94bHF5emRic21sdGlpaXFhaWZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5MDIwOTUsImV4cCI6MjA4OTQ3ODA5NX0.NdT7BHowggjTf4K7hDuDlwRFMJncuxSzXghy8ZW-VjU';

const supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON) : null;

function supabaseConfigured() {
  return !!supabase;
}

async function signInWithGitHub() {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'github' });
    if (error) setLoginStatus('GitHub error: ' + error.message, true);
}

async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
    if (error) setLoginStatus('Google error: ' + error.message, true);
}

async function signInWithEmail(email, password, isSignUp) {
    let result;
    if (isSignUp) result = await supabase.auth.signUp({ email, password });
    else result = await supabase.auth.signInWithPassword({ email, password });

    if (result.error) setLoginStatus('Auth error: ' + result.error.message, true);
}

async function dbSignOut() {
    await supabase.auth.signOut();
}
