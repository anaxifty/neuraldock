/**
 * chat.js — Chat sending, message rendering, attachments, message actions
 * Refactored for New UI
 */

'use strict';

// ── Input listeners ────────────────────────────────────────────────────────
document.getElementById('chatSendBtn')?.addEventListener('click', sendChat);
document.getElementById('chatStopBtn')?.addEventListener('click', stopGeneration);
document.getElementById('chatInput')?.addEventListener('keydown', e => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    sendChat();
  }
});

// ── Busy state ─────────────────────────────────────────────────────────────
function setBusy(val) {
  S.busy = val;
  const sendBtn = document.getElementById('chatSendBtn');
  const stopBtn = document.getElementById('chatStopBtn');
  if (sendBtn) sendBtn.style.display = val ? 'none' : '';
  if (stopBtn) stopBtn.style.display = val ? '' : 'none';
}

function stopGeneration() {
  S.abortStream = true;
  S.busy        = false;
  setBusy(false);
  toast('Generation stopped');
}

// ── File attachments ───────────────────────────────────────────────────────
document.getElementById('attach-btn')?.addEventListener('click', () =>
  document.getElementById('file-input').click()
);
document.getElementById('file-input')?.addEventListener('change', handleFileInput);

async function handleFileInput(e) {
  const files = Array.from(e.target.files);
  e.target.value = '';
  for (const file of files) {
    try {
      const att = { name: file.name, type: file.type, size: file.size };
      if (file.type.startsWith('image/')) {
        att.dataUrl = await readFileAsDataURL(file);
      } else {
        att.content = await readFileAsText(file);
        att.dataUrl  = null;
      }
      S.attachments.push(att);
    } catch (err) {
      toast('Error reading file: ' + file.name);
    }
  }
  renderAttachments();
}

function renderAttachments() {
  const preview = document.getElementById('chat-attachments-preview');
  if (!preview) return;
  preview.innerHTML = '';
  S.attachments.forEach((att, idx) => {
    const el = document.createElement('div');
    el.className = 'bg-surface-raised border border-outline/10 px-2 py-1 rounded text-[10px] flex items-center gap-2 font-mono';
    el.innerHTML = `
        <span class="truncate max-w-[120px]">${att.name}</span>
        <button class="text-on-surface-variant/40 hover:text-red-500" onclick="S.attachments.splice(${idx}, 1); renderAttachments();">×</button>
    `;
    preview.appendChild(el);
  });
}

// ── Message Rendering ──────────────────────────────────────────────────────
function renderChatMessages() {
  const container = document.getElementById('chat-messages');
  if (!container) return;
  container.innerHTML = '';

  const messages = S.activeConvId ? (S.conversations[S.activeConvId]?.messages || []) : S.chatMessages;

  if (messages.length === 0) {
    const welcome = document.getElementById('chat-welcome');
    if (welcome) welcome.style.display = 'flex';
    return;
  } else {
    const welcome = document.getElementById('chat-welcome');
    if (welcome) welcome.style.display = 'none';
  }

  messages.forEach((m, idx) => {
    if (m.role === 'system') return;
    container.appendChild(makeMessageEl(m, idx));
  });

  container.scrollTop = container.scrollHeight;
}

function makeMessageEl(m, idx) {
  const el = document.createElement('div');
  const isUser = m.role === 'user';
  el.className = isUser ? 'flex flex-col items-end group' : 'flex flex-col items-start max-w-3xl';

  if (isUser) {
    el.innerHTML = `
        <div class="bg-surface-elevated p-4 text-on-surface text-[14px] max-w-[80%] rounded-l-xl rounded-tr-xl rounded-br-sm border border-outline/5 relative">
            <div class="prose prose-invert prose-sm">${md(m.content || '')}</div>
        </div>
        <div class="micro-label text-on-surface-variant/20 mt-1 mr-1 opacity-0 group-hover:opacity-100 transition-opacity">
            ${new Date().toLocaleTimeString()}
        </div>
    `;
  } else {
    el.innerHTML = `
        <div class="flex items-center gap-2 mb-2 ml-1">
            <span class="w-1.5 h-1.5 rounded-full bg-teal-500"></span>
            <span class="micro-label text-on-surface-variant">${getModelInfo(m.model || S.currentModel).name}</span>
        </div>
        <div class="assistant-border bg-surface-elevated p-5 text-on-surface text-[14px] leading-relaxed w-full border border-outline/5">
            <div class="prose prose-invert prose-sm">${md(m.content || '')}</div>
        </div>
    `;
  }
  return el;
}

// ── Chat sending ───────────────────────────────────────────────────────────
async function sendChat() {
  if (S.busy) return;
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text && !S.attachments.length) return;

  if (!S.activeConvId) newChat();

  const userMsg = { role: 'user', content: text, model: S.currentModel };
  if (S.attachments.length) {
    userMsg.attachments = [...S.attachments];
    S.attachments = [];
    renderAttachments();
  }

  S.chatMessages.push(userMsg);
  input.value = '';
  input.style.height = 'auto';

  renderChatMessages();
  setBusy(true);

  try {
    const history = S.chatMessages.map(m => ({ role: m.role, content: m.content }));
    const stream = await puter.ai.chat(history, { model: S.currentModel, stream: true });

    const assistantMsg = { role: 'assistant', content: '', model: S.currentModel };
    S.chatMessages.push(assistantMsg);
    renderChatMessages();

    const container = document.getElementById('chat-messages');
    const msgEl = container.lastElementChild.querySelector('.prose');

    for await (const part of stream) {
      if (S.abortStream) { S.abortStream = false; break; }
      const text = (typeof part === 'string' ? part : part?.text || part?.message?.content || '');
      assistantMsg.content += text;
      msgEl.innerHTML = md(assistantMsg.content);
      container.scrollTop = container.scrollHeight;
    }

    persistConversation(text, assistantMsg.content);
  } catch (err) {
    toast('Error: ' + err.message);
  } finally {
    setBusy(false);
  }
}
