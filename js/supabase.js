/**
 * supabase.js — Supabase client initialisation
 */

'use strict';

const SUPABASE_URL  = 'https://oxlqyzdbsmltiiiqaife.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94bHF5emRic21sdGlpaXFhaWZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5MDIwOTUsImV4cCI6MjA4OTQ3ODA5NX0.NdT7BHowggjTf4K7hDuDlwRFMJncuxSzXghy8ZW-VjU';

let _supabase_client = null;

function getSupabaseClient() {
    if (_supabase_client) return _supabase_client;
    if (window.supabase) {
        _supabase_client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
    }
    return _supabase_client;
}

function supabaseConfigured() {
  return !!getSupabaseClient();
}

async function signInWithGitHub() {
    const client = getSupabaseClient();
    if (!client) return;
    const { error } = await client.auth.signInWithOAuth({ provider: 'github' });
    if (error) setLoginStatus('GitHub error: ' + error.message, true);
}

async function signInWithGoogle() {
    const client = getSupabaseClient();
    if (!client) return;
    const { error } = await client.auth.signInWithOAuth({ provider: 'google' });
    if (error) setLoginStatus('Google error: ' + error.message, true);
}

async function signInWithEmail(email, password, isSignUp) {
    const client = getSupabaseClient();
    if (!client) return;
    let result;
    if (isSignUp) result = await client.auth.signUp({ email, password });
    else result = await client.auth.signInWithPassword({ email, password });

    if (result.error) setLoginStatus('Auth error: ' + result.error.message, true);
}

async function dbSignOut() {
    const client = getSupabaseClient();
    if (client) await client.auth.signOut();
}
