/**
 * db.js — Supabase DB synchronization logic
 */

'use strict';

async function dbSaveConversation(conv) {
  if (!supabaseConfigured() || !S.currentUser) return;
  const client = getSupabaseClient();
  const { error } = await client.from('conversations').upsert({
    id: conv.id,
    user_id: S.currentUser.id,
    title: conv.title,
    messages: conv.messages,
    model: conv.model,
    updated_at: new Date(conv.updatedAt).toISOString()
  });
  if (error) console.error('DB Error:', error);
}

async function dbDeleteConversation(id) {
  if (!supabaseConfigured() || !S.currentUser) return;
  const client = getSupabaseClient();
  const { error } = await client.from('conversations').delete().eq('id', id);
  if (error) console.error('DB Error:', error);
}

async function dbSaveSettings() {
    // Stub
}
