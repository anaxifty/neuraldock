/**
 * conversations.js — CRUD + sidebar rendering
 * Refactored for New UI
 */

'use strict';

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
  renderSidebar();
  if (typeof renderChatMessages === 'function') renderChatMessages();
  document.getElementById('chatInput')?.focus();
  activateTab('chat');
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
  }
  renderSidebar();
  if (typeof renderChatMessages === 'function') renderChatMessages();
  activateTab('chat');
}

function deleteConv(id) {
  if (!confirm('Delete this conversation?')) return;
  delete S.conversations[id];
  if (S.activeConvId === id) {
    S.activeConvId = null;
    S.chatMessages = [];
    if (typeof renderChatMessages === 'function') renderChatMessages();
  }
  saveConvs();
  if (typeof dbDeleteConversation === 'function') dbDeleteConversation(id);
  renderSidebar();
  toast('Conversation deleted');
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

function renderSidebar(searchQuery = '') {
  const container = document.getElementById('conv-list');
  if (!container) return;
  container.innerHTML = '';

  const q   = searchQuery.toLowerCase().trim();
  let arr   = Object.values(S.conversations).sort((a, b) => b.updatedAt - a.updatedAt);

  if (q) {
    arr = arr.filter(c =>
      (c.title || '').toLowerCase().includes(q) ||
      (c.messages || []).some(m => (m.content || '').toLowerCase().includes(q))
    );
  }

  if (arr.length === 0) {
      container.innerHTML = '<div class="px-4 py-2 text-[10px] text-on-surface-variant/20 font-mono italic">No history yet</div>';
      return;
  }

  arr.forEach(c => {
    const info = getModelInfo(c.model || S.currentModel);
    const btn = document.createElement('div');
    btn.className = `group relative flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-surface-elevated transition-colors ${c.id === S.activeConvId ? 'bg-surface-elevated text-accent font-bold' : 'text-on-surface-variant/60'}`;

    btn.innerHTML = `
        <span class="w-1.5 h-1.5 rounded-full shrink-0" style="background: ${info.color}"></span>
        <span class="flex-1 truncate text-[11px]">${c.title || 'Untitled'}</span>
        <button class="delete-conv-btn opacity-0 group-hover:opacity-100 p-1 text-on-surface-variant/20 hover:text-red-500 transition-all">
            <span class="material-symbols-outlined text-[14px]">delete</span>
        </button>
    `;

    btn.onclick = (e) => {
        if (e.target.closest('.delete-conv-btn')) {
            e.stopPropagation();
            deleteConv(c.id);
        } else {
            loadConv(c.id);
        }
    };

    container.appendChild(btn);
  });
}
