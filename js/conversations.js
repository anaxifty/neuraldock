/**
 * conversations.js — CRUD + sidebar rendering
 * Writes to localStorage (instant) and Supabase (debounced via db.js).
 *
 * Depends on: utils.js, state.js, ui.js, db.js
 */

'use strict';

document.getElementById('new-chat-btn').addEventListener('click', newChat);
document.getElementById('sidebar-search').addEventListener('input', function () {
  renderSidebar(this.value);
});

function newChat() {
  const conv = {
    id:        crypto.randomUUID(),
    title:     '',
    model:     S.currentModel,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages:  [],
    pinned:    false,
  };
  S.conversations[conv.id] = conv;
  S.activeConvId  = conv.id;
  S.chatMessages  = [];
  saveConvs();

  // Clear search when starting a new chat
  const searchInput = document.getElementById('sidebar-search');
  if (searchInput) searchInput.value = '';

  renderSidebar();
  if (typeof renderChatMessages === 'function') renderChatMessages();
  document.getElementById('chatInput').focus();
  activateTab('chat');
  if (window.innerWidth <= 768) {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('active');
  }
}

function loadConv(id) {
  S.activeConvId = id;
  const conv = S.conversations[id];
  if (conv) {
    S.currentModel = conv.model || S.currentModel;
    S.chatMessages = conv.messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ ...m }));
    updateModelDisplay();
    buildModelDropdown();
  }
  renderSidebar();
  if (typeof renderChatMessages === 'function') renderChatMessages();
  activateTab('chat');
  if (window.innerWidth <= 768) {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('active');
  }
}

function deleteConv(id) {
  delete S.conversations[id];
  if (S.activeConvId === id) {
    S.activeConvId = null;
    S.chatMessages = [];
    if (typeof renderChatMessages === 'function') renderChatMessages();
  }
  saveConvs();
  // Sync deletion to Supabase
  if (typeof dbDeleteConversation === 'function') dbDeleteConversation(id);
  renderSidebar();
  toast('Conversation deleted');
}

function togglePinConv(id) {
  const conv = S.conversations[id];
  if (!conv) return;
  conv.pinned = !conv.pinned;
  conv.updatedAt = Date.now();
  saveConvs();
  if (typeof dbSaveConversation === 'function') dbSaveConversation(conv);
  renderSidebar();
}

function persistConversation(userText, assistantText) {
  if (!S.activeConvId) newChat();
  const conv = S.conversations[S.activeConvId];
  if (!conv) return;

  if (!conv.title && userText) {
    conv.title = userText.length > 42 ? userText.substring(0, 42) + '…' : userText;
  }
  conv.messages  = S.chatMessages.map(m => ({ ...m }));
  conv.model     = S.currentModel;
  conv.updatedAt = Date.now();

  saveConvs();
  // Save to Supabase (debounced)
  if (typeof dbSaveConversation === 'function') dbSaveConversation(conv);
  renderSidebar();

  const userMsgCount = conv.messages.filter(m => m.role === 'user').length;
  if (userMsgCount === 1 && userText) {
    autoTitleConv(S.activeConvId, userText);
  }
}

async function autoTitleConv(convId, userText) {
  try {
    const prompt = `Generate a very short (3-6 words) title for a conversation that started with: "${userText.slice(0, 300)}". Reply with ONLY the title, no quotes or punctuation.`;
    const resp   = await puter.ai.chat([{ role: 'user', content: prompt }], { model: 'gpt-4o-mini', stream: false });
    const title  = (typeof resp === 'string' ? resp : resp?.message?.content || '').trim().slice(0, 60);
    if (title && S.conversations[convId]) {
      S.conversations[convId].title = title;
      saveConvs();
      if (typeof dbSaveConversation === 'function') dbSaveConversation(S.conversations[convId]);
      renderSidebar();
    }
  } catch (e) {}
}

// ── Sidebar rendering ──────────────────────────────────────────────────────
function renderSidebar(searchQuery = '') {
  const container = document.getElementById('sidebar-conversations');
  container.innerHTML = '';

  const q   = searchQuery.toLowerCase().trim();
  let arr   = Object.values(S.conversations).sort((a, b) => b.updatedAt - a.updatedAt);

  if (q) {
    arr = arr.filter(c =>
      (c.title || '').toLowerCase().includes(q) ||
      (c.messages || []).some(m => (m.content || '').toLowerCase().includes(q))
    );
  }

  if (q && arr.length === 0) {
    const none = document.createElement('div');
    none.className = 'model-no-results';
    none.textContent = 'No matches found';
    container.appendChild(none);
    return;
  }

  const pinned   = arr.filter(c =>  c.pinned);
  const unpinned = arr.filter(c => !c.pinned);

  if (pinned.length) {
    appendGroupLabel(container, '📌 Pinned');
    pinned.forEach(c => container.appendChild(makeConvEl(c)));
  }

  const todayMs = new Date().setHours(0, 0, 0, 0);
  const yestMs  = todayMs - 86_400_000;
  const weekMs  = todayMs - 7 * 86_400_000;
  const groups  = { 'Today': [], 'Yesterday': [], 'Last 7 Days': [], 'Older': [] };

  for (const c of unpinned) {
    if      (c.updatedAt >= todayMs) groups['Today'].push(c);
    else if (c.updatedAt >= yestMs)  groups['Yesterday'].push(c);
    else if (c.updatedAt >= weekMs)  groups['Last 7 Days'].push(c);
    else                             groups['Older'].push(c);
  }

  for (const [label, items] of Object.entries(groups)) {
    if (!items.length) continue;
    appendGroupLabel(container, label);
    items.forEach(c => container.appendChild(makeConvEl(c)));
  }
}

function appendGroupLabel(container, text) {
  const el = document.createElement('div');
  el.className   = 'conv-group-label';
  el.textContent = text;
  container.appendChild(el);
}

function makeConvEl(c) {
  const info = getModelInfo(c.model || S.currentModel);
  const el   = document.createElement('div');
  el.className = 'conv-item' + (c.id === S.activeConvId ? ' active' : '');
  el.innerHTML =
    `<span class="conv-item-dot" style="background:${info.color}"></span>` +
    `<div class="conv-item-info">` +
      `<div class="conv-item-title">${escHtml(c.title || 'New Chat')}</div>` +
      `<div class="conv-item-meta">${info.name} · ${relativeTime(c.updatedAt)}</div>` +
    `</div>` +
    `<div class="conv-item-btns">` +
      `<button class="conv-item-pin" title="${c.pinned ? 'Unpin' : 'Pin'}">${c.pinned ? '📌' : '⊙'}</button>` +
      `<button class="conv-item-delete" title="Delete">` +
        `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14H7L5 6"/></svg>` +
      `</button>` +
    `</div>`;

  el.addEventListener('click', () => loadConv(c.id));
  el.querySelector('.conv-item-pin').addEventListener('click', ev => { ev.stopPropagation(); togglePinConv(c.id); });
  el.querySelector('.conv-item-delete').addEventListener('click', ev => { ev.stopPropagation(); deleteConv(c.id); });
  return el;
}
