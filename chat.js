/**
 * chat.js — Chat sending, message rendering, attachments, message actions
 * Depends on: utils.js, config.js, state.js, markdown.js, ui.js, conversations.js
 */

'use strict';

// ── Input listeners ────────────────────────────────────────────────────────
document.getElementById('chatSendBtn').addEventListener('click', sendChat);
document.getElementById('chatStopBtn').addEventListener('click', stopGeneration);
document.getElementById('chatInput').addEventListener('keydown', e => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    sendChat();
  }
});

// ── Busy state ─────────────────────────────────────────────────────────────
function setBusy(val) {
  S.busy = val;
  document.getElementById('chatSendBtn').style.display = val ? 'none' : '';
  document.getElementById('chatStopBtn').style.display = val ? ''     : 'none';
}

function stopGeneration() {
  S.abortStream = true;
  S.busy        = false;
  setBusy(false);
  toast('Generation stopped');
}

// ── File attachments ───────────────────────────────────────────────────────
document.getElementById('attach-btn').addEventListener('click', () =>
  document.getElementById('file-input').click()
);
document.getElementById('file-input').addEventListener('change', handleFileInput);

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
      toast('Failed to read ' + file.name, 'error');
    }
  }
  renderAttachmentStrip();
}

function renderAttachmentStrip() {
  const strip = document.getElementById('attachment-strip');
  if (!strip) return;
  strip.innerHTML = '';
  if (!S.attachments.length) { strip.style.display = 'none'; return; }
  strip.style.display = '';
  S.attachments.forEach((att, i) => {
    const chip = document.createElement('div');
    chip.className = 'att-chip';
    chip.innerHTML =
      `<span>${att.type?.startsWith('image/') ? '🖼' : '📄'} ${escHtml(att.name)}</span>` +
      `<button class="att-chip-rm" data-i="${i}">×</button>`;
    strip.appendChild(chip);
  });
  strip.querySelectorAll('.att-chip-rm').forEach(btn => {
    btn.addEventListener('click', () => {
      S.attachments.splice(Number(btn.dataset.i), 1);
      renderAttachmentStrip();
    });
  });
}

// ── Tip cards ─────────────────────────────────────────────────────────────
document.querySelectorAll('.tip').forEach(tip => {
  tip.addEventListener('click', () => {
    const prompt   = tip.dataset.prompt;
    const targetId = tip.dataset.target || 'chatInput';
    const input    = document.getElementById(targetId);
    if (input) { input.value = prompt; input.focus(); autoResize(input); }
    if (targetId === 'chatInput') activateTab('chat');
    // If tip targets the IDE AI, open code tab and fire the prompt
    if (targetId === 'ide-ai-input') {
      activateTab('code');
      const ideInput = document.getElementById('ide-ai-input');
      if (ideInput) { ideInput.value = prompt; }
      if (typeof ideAiSend === 'function') ideAiSend();
    }
  });
});

// ── Send chat ──────────────────────────────────────────────────────────────
async function sendChat() {
  if (S.busy) return;
  const input = document.getElementById('chatInput');
  const text  = input.value.trim();
  if (!text && !S.attachments.length) return;

  if (!S.activeConvId) {
    const conv = {
      id: crypto.randomUUID(), title: '', model: S.currentModel,
      createdAt: Date.now(), updatedAt: Date.now(), messages: [], pinned: false,
    };
    S.conversations[conv.id] = conv;
    S.activeConvId = conv.id;
    saveConvs();
  }

  input.value = '';
  input.style.height = 'auto';
  const pendingAtts = [...S.attachments];
  S.attachments = [];
  renderAttachmentStrip();
  await sendChatWith(text, pendingAtts);
}

async function sendChatWith(text, attachments = []) {
  setBusy(true);
  S.abortStream = false;
  const chatArea = document.getElementById('chatMessages');
  const emptyEl  = document.getElementById('chatEmpty');
  if (emptyEl) emptyEl.style.display = 'none';

  // Append user message to DOM + state
  const userMsg = { role: 'user', content: text, attachments: attachments.length ? attachments : undefined };
  S.chatMessages.push(userMsg);
  chatArea.appendChild(createMsgEl(userMsg));
  chatArea.scrollTop = chatArea.scrollHeight;

  // Build system prompt parts
  let sysPrompt = '';
  if (S.customInstructions) sysPrompt += S.customInstructions + '\n\n';
  if (S.deepThink) sysPrompt += 'You are in deep reasoning mode. Think step by step, explore multiple angles, challenge your own assumptions, then deliver a thorough, well-structured answer.\n\n';
  const lenHint = getLengthSysPrompt();
  if (lenHint)       sysPrompt += lenHint + '\n\n';
  if (S.systemPrompt) sysPrompt += S.systemPrompt;

  const messages = [];
  if (sysPrompt.trim()) messages.push({ role: 'system', content: sysPrompt.trim() });

  // History slice
  const history = S.memoryEnabled
    ? S.chatMessages.slice(-30)
    : [S.chatMessages[S.chatMessages.length - 1]];

  // Build multimodal content for messages with attachments
  for (const m of history) {
    if (m.role === 'system') continue;
    if (m.attachments?.length) {
      const parts = [];
      if (m.content) parts.push({ type: 'text', text: m.content });
      for (const att of m.attachments) {
        if (att.type?.startsWith('image/') && att.dataUrl) {
          parts.push({ type: 'image_url', image_url: { url: att.dataUrl } });
        } else if (att.content) {
          parts.push({ type: 'text', text: `[File: ${att.name}]\n\`\`\`\n${att.content.slice(0, 8000)}\n\`\`\`` });
        }
      }
      messages.push({ role: m.role, content: parts });
    } else {
      messages.push({ role: m.role, content: m.content });
    }
  }

  const effectiveModel = S.deepThink ? 'deepseek/deepseek-r1' : S.currentModel;
  const thinkEl = S.webSearch ? addSearchingEl(chatArea) : addThinkingEl(chatArea, effectiveModel);
  const assistantMsg = { role: 'assistant', content: '', deepThink: S.deepThink, model: effectiveModel };

  let full = '';
  try {
    const opts = { model: effectiveModel, stream: true, temperature: S.temperature };
    if (S.webSearch) opts.tools = [{ type: 'web_search_20250305', name: 'web_search' }];
    const resp = await puter.ai.chat(messages, opts);
    if (thinkEl?.parentNode) thinkEl.remove();

    const wrap = document.createElement('div');
    wrap.className = `message assistant${S.deepThink ? ' deepthink' : ''}`;
    const meta = document.createElement('div');
    meta.className = 'msg-meta';
    const _info = getModelInfo(effectiveModel);
    meta.textContent = _info.name;
    meta.style.setProperty('--meta-dot-color', _info.color);
    const body = document.createElement('div');
    body.className = 'msg-body md streaming-cursor';
    wrap.append(meta, body);
    chatArea.appendChild(wrap);

    if (resp && typeof resp[Symbol.asyncIterator] === 'function') {
      for await (const part of resp) {
        if (S.abortStream) break;
        const t = part?.text || part?.message?.content || '';
        if (t) { full += t; body.innerHTML = renderMarkdown(full); chatArea.scrollTop = chatArea.scrollHeight; }
      }
    } else if (resp?.message?.content) {
      full = resp.message.content;
      body.innerHTML = renderMarkdown(full);
    } else if (typeof resp === 'string') {
      full = resp;
      body.innerHTML = renderMarkdown(full);
    }

    body.classList.remove('streaming-cursor');
    body.querySelectorAll('pre code').forEach(b => { try { hljs.highlightElement(b); } catch (e) {} });
    renderMermaidBlocks(body);

    assistantMsg.content = full;
    S.chatMessages.push(assistantMsg);
    persistConversation(text, full);
    buildMsgActions(wrap, body, assistantMsg);
    if (S.speakResponses && full) speakText(full);

  } catch (err) {
    if (thinkEl?.parentNode) thinkEl.remove();
    if (!S.abortStream) {
      const errWrap = document.createElement('div');
      errWrap.className = 'message error';
      errWrap.innerHTML =
        `<div class="msg-meta">Error</div>` +
        `<div class="msg-body">${escHtml(err.message || 'Something went wrong.')}</div>`;
      chatArea.appendChild(errWrap);
      chatArea.scrollTop = chatArea.scrollHeight;
      toast('Error: ' + (err.message || 'Request failed'), 'error');
    }
  }

  setBusy(false);
  S.abortStream = false;
}

// ── Message rendering ──────────────────────────────────────────────────────
function renderChatMessages() {
  const area    = document.getElementById('chatMessages');
  const emptyEl = document.getElementById('chatEmpty');
  const conv    = S.activeConvId ? S.conversations[S.activeConvId] : null;
  const msgs    = conv?.messages ? conv.messages : S.chatMessages;

  Array.from(area.children).forEach(c => { if (c.id !== 'chatEmpty') c.remove(); });

  if (!msgs?.length) {
    if (emptyEl) emptyEl.style.display = '';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';

  for (const msg of msgs) {
    if (msg.role === 'system') continue;
    area.appendChild(createMsgEl(msg));
  }
  area.scrollTop = area.scrollHeight;
  renderMermaidBlocks(area);
}

function createMsgEl(msg) {
  const wrap = document.createElement('div');
  wrap.className = `message ${msg.role}${msg.deepThink ? ' deepthink' : ''}`;

  const meta = document.createElement('div');
  meta.className = 'msg-meta';
  if (msg.role === 'user') {
    meta.textContent = 'You';
  } else {
    const info = getModelInfo(msg.model || S.currentModel);
    meta.textContent = info.name;
    meta.style.setProperty('--meta-dot-color', info.color);
  }
  if (msg.deepThink) {
    const dtl = document.createElement('div');
    dtl.className   = 'deepthink-label';
    dtl.textContent = '🧠 Deep Analysis';
    meta.appendChild(dtl);
  }

  const body = document.createElement('div');
  body.className = 'msg-body';

  if (msg.role === 'assistant') {
    body.classList.add('md');
    body.innerHTML = renderMarkdown(msg.content || '');
    body.querySelectorAll('pre code').forEach(b => { try { hljs.highlightElement(b); } catch (e) {} });
    renderMermaidBlocks(body);
  } else {
    if (msg.attachments?.length) {
      const attRow = document.createElement('div');
      attRow.className = 'msg-att-row';
      msg.attachments.forEach(att => {
        if (att.type?.startsWith('image/')) {
          const img = document.createElement('img');
          img.src = att.dataUrl; img.className = 'msg-att-img'; img.alt = att.name;
          attRow.appendChild(img);
        } else {
          const chip = document.createElement('div');
          chip.className = 'msg-att-chip';
          chip.textContent = '📄 ' + att.name;
          attRow.appendChild(chip);
        }
      });
      wrap.appendChild(attRow);
    }
    body.textContent = msg.content || '';
  }

  wrap.append(meta, body);
  if (msg.role === 'assistant') buildMsgActions(wrap, body, msg);
  if (msg.role === 'user')      buildUserActions(wrap, body, msg);
  return wrap;
}

function addThinkingEl(container, modelId) {
  const info = getModelInfo(modelId || S.currentModel);
  const el   = document.createElement('div');
  el.className = 'message assistant thinking';
  el.innerHTML =
    `<div class="msg-meta" style="--meta-dot-color:${info.color}">${info.name}</div>` +
    `<div class="msg-body"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>`;
  container.appendChild(el);
  container.scrollTop = container.scrollHeight;
  // Ambient glow on the chat area when generation starts
  container.style.transition = 'box-shadow .3s';
  container.style.boxShadow  = 'inset 0 0 24px rgba(212,168,83,.04)';
  setTimeout(() => { container.style.boxShadow = ''; }, 600);
  return el;
}

function addSearchingEl(container) {
  const el = document.createElement('div');
  el.className = 'thinking-indicator';
  el.innerHTML = `<div class="thinking-dots"><span></span><span></span><span></span></div> 🔍 Searching the web…`;
  container.appendChild(el);
  container.scrollTop = container.scrollHeight;
  return el;
}

// ── Message action bar ─────────────────────────────────────────────────────
// Global popup elements (created once, repositioned on demand)
const _pickerEl = document.createElement('div');
_pickerEl.className = 'rewrite-picker';
_pickerEl.innerHTML =
  `<div class="rewrite-picker-search">` +
  `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>` +
  `<input id="_pickerInput" type="text" placeholder="Search models…" autocomplete="off"/>` +
  `</div><div id="_pickerList" class="rewrite-picker-list"></div>`;
document.body.appendChild(_pickerEl);

const _menuEl = document.createElement('div');
_menuEl.className = 'msg-menu-dropdown';
document.body.appendChild(_menuEl);

document.addEventListener('click', closeAllPopups);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAllPopups(); });
document.getElementById('chatMessages')?.addEventListener('scroll', closeAllPopups);

function closeAllPopups() {
  _pickerEl.classList.remove('open');
  _menuEl.classList.remove('open');
  document.querySelectorAll('.msg-action-btn.active, .msg-menu-btn.active').forEach(b =>
    b.classList.remove('active')
  );
}

function positionPopup(popup, anchor) {
  popup.style.visibility = 'hidden';
  popup.style.display    = 'block';
  const pw = popup.offsetWidth, ph = popup.offsetHeight;
  popup.style.display    = '';
  popup.style.visibility = '';
  const r  = anchor.getBoundingClientRect();
  const vw = window.innerWidth, vh = window.innerHeight;
  let top  = r.top - ph - 8 >= 0 ? r.top - ph - 8 : r.bottom + ph + 8 <= vh ? r.bottom + 8 : Math.max(8, r.top - ph - 8);
  let left = r.right - pw;
  if (left < 8)       left = 8;
  if (left + pw > vw - 8) left = vw - pw - 8;
  popup.style.top  = top  + 'px';
  popup.style.left = left + 'px';
}

function buildMsgActions(wrap, body, msg) {
  wrap.querySelectorAll('.msg-actions:not(.user-actions)').forEach(el => el.remove());
  const actions = document.createElement('div');
  actions.className = 'msg-actions';

  actions.appendChild(makeActionBtn('Copy', e => {
    e.stopPropagation();
    navigator.clipboard.writeText(body.innerText || body.textContent);
    toast('Copied');
  }));
  actions.appendChild(makeActionBtn('↺ Rewrite', e => {
    e.stopPropagation();
    rewriteWithModel(wrap, body, msg, msg.model || S.currentModel);
  }));
  actions.appendChild(makeSep());

  const altBtn = makeActionBtn('⊕ Other model ▾', e => {
    e.stopPropagation();
    const alreadyOpen = _pickerEl.classList.contains('open') && _pickerEl._anchor === altBtn;
    closeAllPopups();
    if (!alreadyOpen) {
      _pickerEl._anchor   = altBtn;
      _pickerEl._onSelect = id => { closeAllPopups(); rewriteWithModel(wrap, body, msg, id); };
      populatePicker('');
      positionPopup(_pickerEl, altBtn);
      _pickerEl.classList.add('open');
      altBtn.classList.add('active');
      const inp = document.getElementById('_pickerInput');
      if (inp) { inp.value = ''; setTimeout(() => inp.focus(), 30); }
    }
  });
  actions.appendChild(altBtn);
  actions.appendChild(makeSep());

  const menuBtn = document.createElement('button');
  menuBtn.className = 'msg-menu-btn';
  menuBtn.title     = 'More options';
  menuBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>`;
  menuBtn.addEventListener('click', e => {
    e.stopPropagation();
    const alreadyOpen = _menuEl.classList.contains('open') && _menuEl._anchor === menuBtn;
    closeAllPopups();
    if (!alreadyOpen) {
      _menuEl._anchor = menuBtn;
      buildMenuItems(body, msg);
      positionPopup(_menuEl, menuBtn);
      _menuEl.classList.add('open');
      menuBtn.classList.add('active');
    }
  });
  actions.appendChild(menuBtn);
  wrap.appendChild(actions);
}

function makeActionBtn(label, onClick) {
  const btn = document.createElement('button');
  btn.className = 'msg-action-btn';
  btn.textContent = label;
  btn.addEventListener('click', onClick);
  return btn;
}
function makeSep() {
  const s = document.createElement('div');
  s.className = 'msg-action-sep';
  return s;
}

function buildUserActions(wrap, body, msg) {
  const actions = document.createElement('div');
  actions.className = 'msg-actions user-actions';
  const editBtn = makeActionBtn('✏ Edit', e => {
    e.stopPropagation();
    startEditMessage(wrap, body, msg);
  });
  actions.appendChild(editBtn);
  wrap.appendChild(actions);
}

function startEditMessage(wrap, body, msg) {
  if (S.busy) { toast('Cannot edit while generating', 'error'); return; }
  const original = msg.content || '';
  const ta = document.createElement('textarea');
  ta.className = 'msg-edit-ta';
  ta.value = original;
  body.replaceWith(ta);
  autoResize(ta);
  ta.focus();
  ta.selectionStart = ta.value.length;
  ta.addEventListener('input', () => autoResize(ta));

  const oldActions = wrap.querySelector('.msg-actions.user-actions');
  const editActions = document.createElement('div');
  editActions.className = 'msg-actions user-actions edit-actions';

  const saveBtn = makeActionBtn('✓ Save & Resend', async () => {
    const newText = ta.value.trim();
    if (!newText) return;
    const newBody = document.createElement('div');
    newBody.className = 'msg-body';
    newBody.textContent = newText;
    ta.replaceWith(newBody);
    const newActions = document.createElement('div');
    newActions.className = 'msg-actions user-actions';
    newActions.appendChild(makeActionBtn('✏ Edit', e => { e.stopPropagation(); startEditMessage(wrap, newBody, msg); }));
    editActions.replaceWith(newActions);
    msg.content = newText;
    const idx = S.chatMessages.indexOf(msg);
    if (idx !== -1) {
      S.chatMessages = S.chatMessages.slice(0, idx + 1);
      let next = wrap.nextSibling;
      while (next) { const n2 = next.nextSibling; next.remove(); next = n2; }
      // Remove the trailing user msg so sendChatWith can re-add it
      if (S.chatMessages[S.chatMessages.length - 1]?.role === 'user') S.chatMessages.pop();
      sendChatWith(newText);
    }
  });
  saveBtn.classList.add('active');
  const cancelBtn = makeActionBtn('✕ Cancel', () => {
    ta.replaceWith(body);
    if (oldActions) editActions.replaceWith(oldActions);
    else editActions.remove();
  });
  editActions.append(saveBtn, cancelBtn);
  if (oldActions) oldActions.replaceWith(editActions);
  else wrap.appendChild(editActions);
}

function populatePicker(q) {
  const list = document.getElementById('_pickerList');
  if (!list) return;
  list.innerHTML = '';
  const filter = q.toLowerCase().trim();
  let count = 0;
  for (const g of MODELS) {
    const matched = filter
      ? g.models.filter(m =>
          m.name.toLowerCase().includes(filter) ||
          m.id.toLowerCase().includes(filter)   ||
          g.provider.toLowerCase().includes(filter)
        )
      : g.models;
    if (!matched.length) continue;
    const lbl = document.createElement('div');
    lbl.className   = 'model-group-label';
    lbl.textContent = g.provider;
    list.appendChild(lbl);
    for (const m of matched) {
      const opt = document.createElement('div');
      opt.className = 'model-option';
      const tc = m.tag === 'FREE' ? 'model-option-tag free-tag' : 'model-option-tag';
      opt.innerHTML =
        `<span class="model-dot" style="background:${g.color || '#888'}"></span>` +
        `<span class="model-option-name">${m.name}</span>` +
        (m.tag ? `<span class="${tc}">${m.tag}</span>` : '');
      opt.addEventListener('click', e => {
        e.stopPropagation();
        if (_pickerEl._onSelect) _pickerEl._onSelect(m.id);
      });
      list.appendChild(opt);
      count++;
    }
  }
  if (!count) list.innerHTML = '<div class="model-no-results">No models match</div>';
}

document.getElementById('_pickerInput')?.addEventListener('input', function () { populatePicker(this.value); });
document.getElementById('_pickerInput')?.addEventListener('click', e => e.stopPropagation());
_pickerEl.addEventListener('click', e => e.stopPropagation());
_menuEl.addEventListener('click',   e => e.stopPropagation());

function buildMenuItems(body, msg) {
  _menuEl.innerHTML = '';
  const items = [
    {
      icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
      label: 'Write Code',
      fn() {
        closeAllPopups();
        activateTab('code');
        const snippet = (body.innerText || '').slice(0, 800);
        const ideInput = document.getElementById('ide-ai-input');
        if (ideInput) ideInput.value = 'Write code based on:\n\n' + snippet;
        if (typeof ideAiSend === 'function') ideAiSend();
      },
    },
    {
      icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
      label: 'Generate Image',
      fn() {
        closeAllPopups();
        activateTab('image');
        document.getElementById('imagePrompt').value = (body.innerText || '').replace(/\n+/g, ' ').trim().slice(0, 200);
        toast('Prompt set in Image tab');
      },
    },
    {
      icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg>`,
      label: 'Generate Voice',
      fn() {
        closeAllPopups();
        activateTab('voice');
        const ta = document.getElementById('voiceText');
        ta.value = (body.innerText || '').slice(0, 3000);
        ta.dispatchEvent(new Event('input'));
        ta.focus();
        toast('Text set in Voice tab');
      },
    },
    { sep: true },
    {
      icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>`,
      label: 'Share Chat',
      fn() { closeAllPopups(); openShareModal(msg); },
    },
  ];

  for (const item of items) {
    if (item.sep) {
      const s = document.createElement('div');
      s.className = 'msg-menu-sep';
      _menuEl.appendChild(s);
      continue;
    }
    const el = document.createElement('div');
    el.className = 'msg-menu-item';
    el.innerHTML = item.icon + `<span>${item.label}</span>`;
    el.addEventListener('click', e => { e.stopPropagation(); item.fn(); });
    _menuEl.appendChild(el);
  }
}

/** Rewrite an assistant message using a (possibly different) model */
async function rewriteWithModel(wrap, body, msg, modelId) {
  if (S.busy) { toast('Please wait for the current response to finish', 'error'); return; }
  closeAllPopups();
  S.abortStream = false;

  const allMsgs = S.chatMessages;
  const msgIdx  = allMsgs.findIndex(m => m === msg || (m.role === 'assistant' && m.content === msg.content));
  const userMsg = msgIdx > 0
    ? allMsgs[msgIdx - 1]
    : allMsgs.filter(m => m.role === 'user').slice(-1)[0];
  if (!userMsg) { toast('Could not find original prompt', 'error'); return; }

  const info = getModelInfo(modelId);
  setBusy(true);
  body.classList.add('md', 'streaming-cursor');
  body.innerHTML = '<em style="color:var(--muted);font-size:12px">Rewriting…</em>';
  const metaEl = wrap.querySelector('.msg-meta');
  if (metaEl) { metaEl.textContent = info.name; metaEl.style.setProperty('--meta-dot-color', info.color); }
  wrap.querySelectorAll('.msg-actions:not(.user-actions)').forEach(el => el.remove());

  const messages = [];
  if (S.systemPrompt) messages.push({ role: 'system', content: S.systemPrompt });
  const hist = S.memoryEnabled
    ? allMsgs.slice(0, msgIdx > 0 ? msgIdx : allMsgs.length)
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .slice(-20)
    : [{ role: 'user', content: userMsg.content }];
  messages.push(...hist.map(m => ({ role: m.role, content: m.content })));

  let full = '';
  try {
    const resp = await puter.ai.chat(messages, { model: modelId, stream: true, temperature: S.temperature });
    body.innerHTML = '';
    if (resp && typeof resp[Symbol.asyncIterator] === 'function') {
      for await (const part of resp) {
        if (S.abortStream) break;
        const t = part?.text || part?.message?.content || '';
        if (t) {
          full += t;
          body.innerHTML = renderMarkdown(full);
          document.getElementById('chatMessages').scrollTop = document.getElementById('chatMessages').scrollHeight;
        }
      }
    } else if (resp?.message?.content) {
      full = resp.message.content;
      body.innerHTML = renderMarkdown(full);
    }
    body.classList.remove('streaming-cursor');
    body.querySelectorAll('pre code').forEach(b => { try { hljs.highlightElement(b); } catch (e) {} });
    renderMermaidBlocks(body);
    if (msgIdx >= 0 && allMsgs[msgIdx]) { allMsgs[msgIdx].content = full; allMsgs[msgIdx].model = modelId; }
    buildMsgActions(wrap, body, allMsgs[msgIdx] || { ...msg, content: full, model: modelId });
    persistConversation('', full);
    toast('Rewritten with ' + info.name);
  } catch (err) {
    body.classList.remove('streaming-cursor');
    body.innerHTML = renderMarkdown(msg.content || '');
    buildMsgActions(wrap, body, msg);
    toast('Rewrite failed: ' + (err.message || ''), 'error');
  }

  setBusy(false);
  S.abortStream = false;
}
