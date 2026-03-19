/**
 * supabase.js — Supabase client initialisation
 *
 * ┌─────────────────────────────────────────────────────────┐
 * │  SETUP REQUIRED — fill in your project credentials      │
 * │  1. Go to https://supabase.com → your project           │
 * │  2. Settings → API                                      │
 * │  3. Copy "Project URL" and "anon public" key below      │
 * └─────────────────────────────────────────────────────────┘
 */

'use strict';

const SUPABASE_URL  = 'https://oxlqyzdbsmltiiiqaife.supabase.co';   // e.g. https://xxxx.supabase.co
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94bHF5emRic21sdGlpaXFhaWZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5MDIwOTUsImV4cCI6MjA4OTQ3ODA5NX0.NdT7BHowggjTf4K7hDuDlwRFMJncuxSzXghy8ZW-VjU';      // starts with eyJ...

// ── Load Supabase SDK dynamically ─────────────────────────────────────────
let _supabase = null;

async function getSupabase() {
  if (_supabase) return _supabase;
  if (!window.supabase) {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
      s.onload  = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
    auth: {
      persistSession:     true,
      autoRefreshToken:   true,
      detectSessionInUrl: true,
    },
  });
  return _supabase;
}

/**
 * Returns true if credentials have been filled in.
 * Falls back to localStorage-only mode if not configured.
 */
function supabaseConfigured() {
  return (
    SUPABASE_URL  !== 'YOUR_SUPABASE_PROJECT_URL' &&
    SUPABASE_ANON !== 'YOUR_SUPABASE_ANON_KEY'    &&
    SUPABASE_URL.startsWith('https://')
  );
}
