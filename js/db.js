/**
 * db.js — All Supabase database operations
 * Conversations, settings, IDE projects, user profiles, generated images.
 * Falls back gracefully to localStorage if Supabase is not configured
 * or if the user is offline.
 *
 * Depends on: supabase.js, state.js, utils.js
 */

'use strict';

// ── Debounce helper for sync ──────────────────────────────────────────────
const _syncTimers = {};
function debounceSync(key, fn, delay = 1500) {
  clearTimeout(_syncTimers[key]);
  _syncTimers[key] = setTimeout(fn, delay);
}

// ══════════════════════════════════════════════════════════════════════════
//  PROFILE
// ══════════════════════════════════════════════════════════════════════════

/**
 * Upsert a profile row for the signed-in user.
 * Called once after authentication.
 */
async function dbUpsertProfile(user) {
  if (!supabaseConfigured()) return;
  try {
    const sb = await getSupabase();
    const { error } = await sb.from('profiles').upsert({
      id:         user.id,
      username:   user.user_metadata?.user_name || user.user_metadata?.name || null,
      full_name:  user.user_metadata?.full_name  || user.user_metadata?.name || null,
      avatar_url: user.user_metadata?.avatar_url || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });
    if (error) console.warn('[db] upsertProfile:', error.message);
  } catch (e) {
    console.warn('[db] upsertProfile failed:', e.message);
  }
}

// ══════════════════════════════════════════════════════════════════════════
//  SETTINGS
// ══════════════════════════════════════════════════════════════════════════

/** Load settings from Supabase and merge into S */
async function dbLoadSettings(userId) {
  if (!supabaseConfigured() || !userId) return;
  try {
    const sb = await getSupabase();
    const { data, error } = await sb
      .from('user_settings')
      .select('*')
      .eq('user_id', userId)
      .single();
    if (error || !data) return;
    // Merge into S — only keys that exist in settings
    const KEYS = [
      'current_model', 'temperature', 'response_length', 'memory_enabled',
      'speak_responses', 'speak_speed', 'font_size', 'system_prompt',
      'custom_instructions',
      'theme', 'font_ui', 'font_head', 'density', 'radius', 'bg_texture', 'bubble_style',
    ];
    for (const k of KEYS) {
      if (data[k] !== undefined) {
        // Convert snake_case → camelCase
        const camel = k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
        S[camel] = data[k];
      }
    }
  } catch (e) {
    console.warn('[db] loadSettings failed:', e.message);
  }
}

/** Save current S settings to Supabase (debounced) */
function dbSaveSettings() {
  if (!supabaseConfigured() || !S.currentUser) return;
  debounceSync('settings', async () => {
    try {
      const sb = await getSupabase();
      await sb.from('user_settings').upsert({
        user_id:             S.currentUser.id,
        current_model:       S.currentModel,
        temperature:         S.temperature,
        response_length:     S.responseLength,
        memory_enabled:      S.memoryEnabled,
        speak_responses:     S.speakResponses,
        speak_speed:         S.speakSpeed,
        font_size:           S.fontSize,
        system_prompt:       S.systemPrompt,
        custom_instructions: S.customInstructions,
        theme:               S.theme,
        font_ui:             S.fontUi,
        font_head:           S.fontHead,
        density:             S.density,
        radius:              S.radius,
        bg_texture:          S.bgTexture,
        bubble_style:        S.bubbleStyle,
        updated_at:          new Date().toISOString(),
      }, { onConflict: 'user_id' });
    } catch (e) {
      console.warn('[db] saveSettings failed:', e.message);
    }
  }, 2000);
}

// ══════════════════════════════════════════════════════════════════════════
//  CONVERSATIONS
// ══════════════════════════════════════════════════════════════════════════

/** Load all conversations from Supabase into S.conversations */
async function dbLoadConversations(userId) {
  if (!supabaseConfigured() || !userId) return;
  try {
    const sb = await getSupabase();
    const { data, error } = await sb
      .from('conversations')
      .select('id, title, model, messages, pinned, created_at, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(200);
    if (error) { console.warn('[db] loadConversations:', error.message); return; }
    if (!data?.length) return;
    // Merge into S.conversations (cloud wins over localStorage)
    for (const row of data) {
      S.conversations[row.id] = {
        id:        row.id,
        title:     row.title || '',
        model:     row.model || 'gpt-4o',
        messages:  row.messages || [],
        pinned:    row.pinned || false,
        createdAt: new Date(row.created_at).getTime(),
        updatedAt: new Date(row.updated_at).getTime(),
      };
    }
    if (typeof renderSidebar === 'function') renderSidebar();
  } catch (e) {
    console.warn('[db] loadConversations failed:', e.message);
  }
}

/** Upsert a single conversation to Supabase (debounced per conv id) */
function dbSaveConversation(conv) {
  if (!supabaseConfigured() || !S.currentUser || !conv) return;
  debounceSync('conv_' + conv.id, async () => {
    try {
      const sb = await getSupabase();
      await sb.from('conversations').upsert({
        id:         conv.id,
        user_id:    S.currentUser.id,
        title:      conv.title || '',
        model:      conv.model || S.currentModel,
        messages:   conv.messages || [],
        pinned:     conv.pinned || false,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });
    } catch (e) {
      console.warn('[db] saveConversation failed:', e.message);
    }
  }, 1500);
}

/** Delete a conversation from Supabase */
async function dbDeleteConversation(convId) {
  if (!supabaseConfigured() || !S.currentUser) return;
  try {
    const sb = await getSupabase();
    await sb.from('conversations').delete().eq('id', convId).eq('user_id', S.currentUser.id);
  } catch (e) {
    console.warn('[db] deleteConversation failed:', e.message);
  }
}

// ══════════════════════════════════════════════════════════════════════════
//  IDE PROJECTS
// ══════════════════════════════════════════════════════════════════════════

/** Load all IDE projects from Supabase */
async function dbLoadIdeProjects(userId) {
  if (!supabaseConfigured() || !userId) return;
  try {
    const sb = await getSupabase();
    const { data, error } = await sb
      .from('ide_projects')
      .select('id, name, files, created_at, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(50);
    if (error) { console.warn('[db] loadIdeProjects:', error.message); return; }
    return data || [];
  } catch (e) {
    console.warn('[db] loadIdeProjects failed:', e.message);
    return [];
  }
}

/** Save the current IDE project to Supabase (debounced) */
function dbSaveIdeProject(projectId, name, files) {
  if (!supabaseConfigured() || !S.currentUser) return;
  debounceSync('ide_' + projectId, async () => {
    try {
      const sb = await getSupabase();
      await sb.from('ide_projects').upsert({
        id:         projectId,
        user_id:    S.currentUser.id,
        name:       name || 'my-project',
        files:      files || {},
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });
    } catch (e) {
      console.warn('[db] saveIdeProject failed:', e.message);
    }
  }, 2000);
}

// ══════════════════════════════════════════════════════════════════════════
//  GENERATED IMAGES
// ══════════════════════════════════════════════════════════════════════════

/** Save a generated image record */
async function dbSaveGeneratedImage({ prompt, provider, model, imageUrl, width, height }) {
  if (!supabaseConfigured() || !S.currentUser) return;
  try {
    const sb = await getSupabase();
    await sb.from('generated_images').insert({
      user_id:   S.currentUser.id,
      prompt:    prompt || '',
      provider:  provider || '',
      model:     model || '',
      image_url: imageUrl || '',
      width:     width || null,
      height:    height || null,
    });
  } catch (e) {
    console.warn('[db] saveGeneratedImage failed:', e.message);
  }
}

/** Load recent generated images for the current user */
async function dbLoadGeneratedImages(limit = 50) {
  if (!supabaseConfigured() || !S.currentUser) return [];
  try {
    const sb = await getSupabase();
    const { data, error } = await sb
      .from('generated_images')
      .select('*')
      .eq('user_id', S.currentUser.id)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) return [];
    return data || [];
  } catch (e) {
    console.warn('[db] loadGeneratedImages failed:', e.message);
    return [];
  }
}

// ══════════════════════════════════════════════════════════════════════════
//  SIGN OUT
// ══════════════════════════════════════════════════════════════════════════

async function dbSignOut() {
  if (!supabaseConfigured()) return;
  try {
    const sb = await getSupabase();
    await sb.auth.signOut();
  } catch (e) {
    console.warn('[db] signOut failed:', e.message);
  }
}
