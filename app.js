// ── 1. MARKED + HIGHLIGHT + KATEX + MERMAID ──
mermaid.initialize({ startOnLoad: false, theme: 'dark', themeVariables: { primaryColor: '#1a1c1e', lineColor: '#3a3d40', textColor: '#e8e2d9' } });

marked.setOptions({
  highlight(code, lang) {
    if (lang && hljs.getLanguage(lang)) return hljs.highlight(code, { language: lang }).value;
    return hljs.highlightAuto(code).value;
  },
  breaks: true, gfm: true,
});

function renderMarkdown(text) {
  if (!text) return '';
  // Protect math from marked processing
  const mathMap = [];
  let t = text
    .replace(/\$\$[\s\S]+?\$\$/g, m => { mathMap.push({ type: 'display', src: m }); return `%%MATH${mathMap.length-1}%%`; })
    .replace(/\$[^\n$]+?\$/g, m => { mathMap.push({ type: 'inline', src: m }); return `%%MATH${mathMap.length-1}%%`; });
  try {
    let html = marked.parse(t);
    // Restore and render math
    html = html.replace(/%%MATH(\d+)%%/g, (_, i) => {
      const { type, src } = mathMap[i];
      const inner = type === 'display' ? src.slice(2,-2) : src.slice(1,-1);
      try {
        return katex.renderToString(inner, { displayMode: type === 'display', throwOnError: false });
      } catch(e) { return escHtml(src); }
    });
    // Add copy button + mermaid support to code blocks
    html = html.replace(/<pre><code(.*?)>/g, (match, attrs) => {
      const langMatch = attrs.match(/class=".*?language-(\w+).*?"/);
      const lang = langMatch ? langMatch[1] : 'code';
      if (lang === 'mermaid') {
        return `<div class="mermaid-wrap"><pre><code${attrs}>`;
      }
      return `<pre><div class="code-block-header"><span>${lang}</span><div class="code-block-btns"><button class="copy-code-btn" onclick="copyCodeBlock(this)">Copy</button><button class="open-canvas-btn" onclick="openCanvas(this)" title="Open in canvas">⊞</button></div></div><code${attrs}>`;
    });
    html = html.replace(/<\/code><\/pre>/g, (match, offset, str) => {
      // Check if mermaid
      const before = str.substring(Math.max(0, offset - 200), offset);
      if (before.includes('mermaid-wrap')) return `</code></pre></div>`;
      return match;
    });
    return html;
  } catch(e) { return escHtml(text); }
}

function renderMermaidBlocks(container) {
  container.querySelectorAll('.mermaid-wrap').forEach(async wrap => {
    if (wrap.dataset.rendered) return;
    wrap.dataset.rendered = '1';
    const code = wrap.querySelector('code');
    if (!code) return;
    const src = code.textContent;
    try {
      const { svg } = await mermaid.render('mermaid-' + Date.now(), src);
      const div = document.createElement('div');
      div.className = 'mermaid-rendered';
      div.innerHTML = svg;
      wrap.replaceWith(div);
    } catch(e) { console.warn('Mermaid error:', e); }
  });
}

// ── 2. MODEL REGISTRY ──
const PROVIDER_META = {
  'openai': { label: 'OpenAI', color: '#10a37f' },
  'claude': { label: 'Anthropic', color: '#c96b3e' },
  'anthropic': { label: 'Anthropic', color: '#c96b3e' },
  'google': { label: 'Google', color: '#4285f4' },
  'gemini': { label: 'Google', color: '#4285f4' },
  'meta': { label: 'Meta', color: '#0064e0' },
  'meta-llama': { label: 'Meta', color: '#0064e0' },
  'deepseek': { label: 'DeepSeek', color: '#5b8dd9' },
  'mistral': { label: 'Mistral', color: '#e6a817' },
  'mistralai': { label: 'Mistral', color: '#e6a817' },
  'qwen': { label: 'Qwen', color: '#a855f7' },
  'xai': { label: 'xAI', color: '#d4d4d4' },
  'x-ai': { label: 'xAI', color: '#d4d4d4' },
  'together': { label: 'Together', color: '#ff6b35' },
  'groq': { label: 'Groq', color: '#f55036' },
  'cohere': { label: 'Cohere', color: '#3b7dd8' },
  'perplexity': { label: 'Perplexity', color: '#20b2aa' },
  'nvidia': { label: 'NVIDIA', color: '#76b900' },
  'microsoft': { label: 'Microsoft', color: '#00a4ef' },
  'amazon': { label: 'Amazon', color: '#ff9900' },
  'aws': { label: 'Amazon', color: '#ff9900' },
};

let MODELS = [
  { provider: 'OpenAI', color: '#10a37f', models: [
    { id: 'gpt-4o', name: 'GPT-4o', tag: 'SMART' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', tag: 'FAST' },
    { id: 'gpt-4.1', name: 'GPT-4.1', tag: 'CODE' },
    { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', tag: 'FAST' },
    { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano', tag: 'FAST' },
    { id: 'o1', name: 'o1', tag: 'SMART' },
    { id: 'o3-mini', name: 'o3 Mini', tag: 'SMART' },
    { id: 'o4-mini', name: 'o4 Mini', tag: 'SMART' },
  ]},
  { provider: 'Anthropic', color: '#c96b3e', models: [
    { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', tag: 'SMART' },
    { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5', tag: 'SMART' },
    { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', tag: 'FAST' },
    { id: 'claude-opus-4', name: 'Claude Opus 4', tag: 'SMART' },
  ]},
  { provider: 'Google', color: '#4285f4', models: [
    { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash', tag: 'FAST' },
    { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', tag: 'FAST' },
    { id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro', tag: 'SMART' },
    { id: 'google/gemini-2.0-flash', name: 'Gemini 2.0 Flash', tag: 'FAST' },
  ]},
  { provider: 'Meta', color: '#0064e0', models: [
    { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B', tag: 'FREE' },
    { id: 'meta-llama/llama-3.1-70b-instruct', name: 'Llama 3.1 70B', tag: 'FREE' },
    { id: 'meta-llama/llama-3.1-8b-instruct', name: 'Llama 3.1 8B', tag: 'FREE' },
  ]},
  { provider: 'DeepSeek', color: '#5b8dd9', models: [
    { id: 'deepseek/deepseek-chat', name: 'DeepSeek Chat', tag: 'SMART' },
    { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1', tag: 'SMART' },
    { id: 'deepseek-chat', name: 'DeepSeek (Alt)', tag: 'FAST' },
  ]},
  { provider: 'Mistral', color: '#e6a817', models: [
    { id: 'mistral/mistral-large-latest', name: 'Mistral Large', tag: 'SMART' },
    { id: 'mistral-small-latest', name: 'Mistral Small', tag: 'FAST' },
    { id: 'mistralai/mixtral-8x7b-instruct', name: 'Mixtral 8x7B', tag: 'FREE' },
  ]},
  { provider: 'Qwen', color: '#a855f7', models: [
    { id: 'qwen/qwen-2.5-72b-instruct', name: 'Qwen 2.5 72B', tag: 'FREE' },
  ]},
  { provider: 'xAI', color: '#d4d4d4', models: [
    { id: 'grok-3-mini', name: 'Grok 3 Mini', tag: 'FAST' },
    { id: 'x-ai/grok-beta', name: 'Grok Beta', tag: 'SMART' },
    { id: 'x-ai/grok-2', name: 'Grok 2', tag: 'SMART' },
  ]},
];

async function fetchAndMergeModels() {
  try {
    const fetched = await puter.ai.listModels();
    if (!Array.isArray(fetched) || !fetched.length) return;
    const knownIds = new Set();
    for (const g of MODELS) for (const m of g.models) knownIds.add(m.id);
    const newByProvider = {};
    for (const m of fetched) {
      if (knownIds.has(m.id)) continue;
      const rawProvider = (m.provider || '').toLowerCase();
      let label = 'Other', color = '#888888';
      const pmKey = Object.keys(PROVIDER_META).find(k => rawProvider === k || rawProvider.startsWith(k+'-') || rawProvider.startsWith(k+'/'));
      if (pmKey) { label = PROVIDER_META[pmKey].label; color = PROVIDER_META[pmKey].color; }
      if (!newByProvider[label]) newByProvider[label] = { color, models: [] };
      const displayName = m.name || m.id.split('/').pop().replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
      newByProvider[label].models.push({ id: m.id, name: displayName, tag: '' });
      knownIds.add(m.id);
    }
    for (const [label, data] of Object.entries(newByProvider)) {
      const existing = MODELS.find(g => g.provider === label);
      if (existing) existing.models.push(...data.models);
      else MODELS.push({ provider: label, color: data.color, models: data.models });
    }
    buildModelDropdown(); populateSettingsModel();
  } catch(e) { console.warn('listModels:', e); }
}

function getModelInfo(id) {
  for (const g of MODELS) for (const m of g.models) if (m.id === id) return { ...m, provider: g.provider, color: g.color || '#888' };
  const fn = id.split('/').pop().replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
  return { id, name: fn, provider: 'Unknown', color: '#888', tag: '' };
}

// ── 3. STATE ──
const S = {
  conversations: JSON.parse(localStorage.getItem('aistudio_convs') || '{}'),
  activeConvId: null,
  chatMessages: [],
  codeMessages: [{ role: 'system', content: 'You are an expert programming assistant. Provide clear, well-commented code. Always use markdown code blocks with language identifiers. Prefer complete, runnable examples.' }],
  currentModel: 'gpt-4o',
  deepThink: false,
  webSearch: false,
  memoryEnabled: true,
  speakResponses: false,
  speakSpeed: 1.0,
  systemPrompt: '',
  customInstructions: '',
  temperature: 0.7,
  fontSize: 'medium',
  responseLength: 'balanced',
  busy: false,
  streaming: false,
  activeStyle: '',
  pinnedConvs: [],
  attachments: [],        // current pending attachments [{name, type, dataUrl, content}]
  abortStream: false,     // flag to abort streaming
  tokenCount: 0,
};

try {
  const saved = localStorage.getItem('aistudio_settings');
  if (saved) {
    const cfg = JSON.parse(saved);
    Object.assign(S, cfg);
    S.conversations = JSON.parse(localStorage.getItem('aistudio_convs') || '{}');
    S.chatMessages = [];
    S.codeMessages = [{ role: 'system', content: 'You are an expert programming assistant. Provide clear, well-commented code. Always use markdown code blocks with language identifiers. Prefer complete, runnable examples.' }];
    S.busy = false; S.streaming = false; S.activeConvId = null; S.activeStyle = '';
    S.attachments = []; S.abortStream = false; S.tokenCount = 0;
  }
} catch(e) {}

function saveSettings() {
  const cfg = {
    currentModel: S.currentModel, memoryEnabled: S.memoryEnabled,
    speakResponses: S.speakResponses, speakSpeed: S.speakSpeed,
    systemPrompt: S.systemPrompt, customInstructions: S.customInstructions,
    temperature: S.temperature, fontSize: S.fontSize,
    responseLength: S.responseLength, pinnedConvs: S.pinnedConvs,
  };
  try { localStorage.setItem('aistudio_settings', JSON.stringify(cfg)); } catch(e) {}
}
function saveConvs() { try { localStorage.setItem('aistudio_convs', JSON.stringify(S.conversations)); } catch(e) {} }

// ── 4. AUTH ──
let authPollInterval = null;
document.getElementById('login-btn').addEventListener('click', startLogin);
document.getElementById('login-fallback').addEventListener('click', manualLoginCheck);

function startLogin() {
  const statusEl = document.getElementById('login-status');
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
        onAuthed(user); return;
      }
    } catch(e) {}
    if (ticks === 6) fallbackEl.classList.add('visible');
    if (ticks >= 150) { clearInterval(authPollInterval); statusEl.textContent = 'Sign-in timed out. Please try again.'; }
  }, 800);
}

async function manualLoginCheck() {
  try {
    if (puter.auth.isSignedIn()) { const user = await puter.auth.getUser(); onAuthed(user); }
    else document.getElementById('login-status').textContent = 'Not signed in yet.';
  } catch(e) { document.getElementById('login-status').textContent = 'Error checking auth.'; }
}

function onAuthed(user) {
  if (authPollInterval) clearInterval(authPollInterval);
  document.getElementById('login-screen').style.display = 'none';
  if (user) {
    const initial = (user.username || user.email || '?')[0].toUpperCase();
    document.getElementById('user-avatar').textContent = initial;
    document.getElementById('user-name').textContent = user.username || user.email || 'User';
  }
  renderSidebar(); buildModelDropdown(); updateModelDisplay();
  applyFontSize(S.fontSize); populateSettingsModel(); applySettingsUI();
  updateImageModels(); updateVoiceOptions();
  applyLengthUI();
  fetchAndMergeModels();
}

window.addEventListener('load', async () => {
  try { if (puter.auth.isSignedIn()) { const user = await puter.auth.getUser(); onAuthed(user); } } catch(e) {}
  // init stop buttons hidden
  document.getElementById('chatStopBtn').style.display = 'none';
});

// ── 5. SIDEBAR TOGGLE ──
document.getElementById('hamburger-btn').addEventListener('click', toggleSidebar);
document.getElementById('sidebar-collapse-btn').addEventListener('click', toggleSidebar);
document.getElementById('sidebar-overlay').addEventListener('click', toggleSidebar);

function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  const ov = document.getElementById('sidebar-overlay');
  if (window.innerWidth <= 768) { const o = sb.classList.contains('open'); sb.classList.toggle('open', !o); ov.classList.toggle('active', !o); }
  else { sb.classList.toggle('collapsed'); }
}

// ── 6. CONVERSATIONS ──
document.getElementById('new-chat-btn').addEventListener('click', newChat);
document.getElementById('sidebar-search').addEventListener('input', function() { renderSidebar(this.value); });

function newChat() {
  const conv = { id: crypto.randomUUID(), title: '', model: S.currentModel, createdAt: Date.now(), updatedAt: Date.now(), messages: [], pinned: false };
  S.conversations[conv.id] = conv;
  S.activeConvId = conv.id; S.chatMessages = [];
  saveConvs(); renderSidebar(); renderChatMessages();
  document.getElementById('chatInput').focus();
  activateTab('chat');
  if (window.innerWidth <= 768) { document.getElementById('sidebar').classList.remove('open'); document.getElementById('sidebar-overlay').classList.remove('active'); }
}

function loadConv(id) {
  S.activeConvId = id;
  const conv = S.conversations[id];
  if (conv) {
    S.currentModel = conv.model || S.currentModel;
    S.chatMessages = conv.messages.filter(m => m.role==='user'||m.role==='assistant').map(m => ({ ...m }));
    updateModelDisplay(); buildModelDropdown();
  }
  renderSidebar(); renderChatMessages();
  activateTab('chat');
  updateCtxIndicator();
  if (window.innerWidth <= 768) { document.getElementById('sidebar').classList.remove('open'); document.getElementById('sidebar-overlay').classList.remove('active'); }
}

function deleteConv(id) {
  delete S.conversations[id];
  if (S.activeConvId === id) { S.activeConvId = null; S.chatMessages = []; renderChatMessages(); }
  saveConvs(); renderSidebar(); toast('Conversation deleted');
}

function togglePinConv(id) {
  const conv = S.conversations[id];
  if (!conv) return;
  conv.pinned = !conv.pinned;
  saveConvs(); renderSidebar();
}

function persistConversation(userText, assistantText) {
  if (!S.activeConvId) newChat();
  const conv = S.conversations[S.activeConvId];
  if (!conv) return;
  if (!conv.title && userText) conv.title = userText.length > 42 ? userText.substring(0,42)+'…' : userText;
  conv.messages = S.chatMessages.map(m => ({ ...m, timestamp: Date.now() }));
  conv.model = S.currentModel; conv.updatedAt = Date.now();
  saveConvs(); renderSidebar();
  // Auto-generate a better title from AI after first exchange
  if (conv.messages.filter(m=>m.role==='user').length === 1 && userText) {
    autoTitleConv(S.activeConvId, userText, assistantText);
  }
  updateCtxIndicator();
}

async function autoTitleConv(convId, userText, assistantText) {
  try {
    const prompt = `Generate a very short (3-6 words) title for a conversation that started with this message. Reply with ONLY the title, no quotes or punctuation at the end:\n\n"${userText.slice(0,300)}"`;
    const resp = await puter.ai.chat([{ role:'user', content: prompt }], { model: 'gpt-4o-mini', stream: false, temperature: 0.4 });
    const title = (typeof resp === 'string' ? resp : resp?.message?.content || '').trim().replace(/^["']|["']$/g,'').slice(0,60);
    if (title && S.conversations[convId]) {
      S.conversations[convId].title = title;
      saveConvs(); renderSidebar();
    }
  } catch(e) {}
}

function renderSidebar(searchQuery = '') {
  const container = document.getElementById('sidebar-conversations');
  container.innerHTML = '';
  const q = searchQuery.toLowerCase().trim();
  let arr = Object.values(S.conversations).sort((a,b) => b.updatedAt - a.updatedAt);
  if (q) arr = arr.filter(c => (c.title||'').toLowerCase().includes(q) || (c.messages||[]).some(m => (m.content||'').toLowerCase().includes(q)));

  const pinned = arr.filter(c => c.pinned);
  const unpinned = arr.filter(c => !c.pinned);

  if (pinned.length) {
    const gl = document.createElement('div'); gl.className = 'conv-group-label'; gl.textContent = '📌 Pinned'; container.appendChild(gl);
    pinned.forEach(c => container.appendChild(makeConvEl(c)));
  }

  const todayStart = new Date(); todayStart.setHours(0,0,0,0);
  const yestStart = new Date(todayStart); yestStart.setDate(yestStart.getDate()-1);
  const weekStart = new Date(todayStart); weekStart.setDate(weekStart.getDate()-7);
  const groups = { 'Today': [], 'Yesterday': [], 'Last 7 Days': [], 'Older': [] };
  for (const c of unpinned) {
    const d = c.updatedAt;
    if (d >= todayStart.getTime()) groups['Today'].push(c);
    else if (d >= yestStart.getTime()) groups['Yesterday'].push(c);
    else if (d >= weekStart.getTime()) groups['Last 7 Days'].push(c);
    else groups['Older'].push(c);
  }
  for (const [label, items] of Object.entries(groups)) {
    if (!items.length) continue;
    const gl = document.createElement('div'); gl.className = 'conv-group-label'; gl.textContent = label; container.appendChild(gl);
    items.forEach(c => container.appendChild(makeConvEl(c)));
  }
}

function makeConvEl(c) {
  const info = getModelInfo(c.model || S.currentModel);
  const el = document.createElement('div');
  el.className = 'conv-item' + (c.id === S.activeConvId ? ' active' : '');
  el.innerHTML = `<span class="conv-item-dot" style="background:${info.color}"></span>
    <div class="conv-item-info">
      <div class="conv-item-title">${escHtml(c.title || 'New Chat')}</div>
      <div class="conv-item-meta">${info.name} · ${relativeTime(c.updatedAt)}</div>
    </div>
    <div class="conv-item-btns">
      <button class="conv-item-pin" title="${c.pinned ? 'Unpin':'Pin'}">${c.pinned ? '📌' : '⊙'}</button>
      <button class="conv-item-delete" title="Delete"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14H7L5 6"/></svg></button>
    </div>`;
  el.addEventListener('click', () => loadConv(c.id));
  el.querySelector('.conv-item-pin').addEventListener('click', ev => { ev.stopPropagation(); togglePinConv(c.id); });
  el.querySelector('.conv-item-delete').addEventListener('click', ev => { ev.stopPropagation(); deleteConv(c.id); });
  return el;
}

// ── 7. MODEL SELECTOR ──
function renderModelList(filter = '') {
  const list = document.getElementById('model-list'); if (!list) return;
  list.innerHTML = '';
  const q = filter.toLowerCase().trim(); let anyVisible = false;
  for (const g of MODELS) {
    const color = g.color || '#888';
    const matched = q ? g.models.filter(m => m.name.toLowerCase().includes(q)||m.id.toLowerCase().includes(q)||g.provider.toLowerCase().includes(q)) : g.models;
    if (!matched.length) continue; anyVisible = true;
    const lbl = document.createElement('div'); lbl.className = 'model-group-label'; lbl.textContent = g.provider; list.appendChild(lbl);
    for (const m of matched) {
      const opt = document.createElement('div'); opt.className = 'model-option'+(m.id===S.currentModel?' selected':'');
      const tagClass = m.tag === 'FREE' ? 'model-option-tag free-tag' : 'model-option-tag';
      opt.innerHTML = `<span class="model-dot" style="background:${color}"></span><span class="model-option-name">${m.name}</span>${m.tag?`<span class="${tagClass}">${m.tag}</span>`:''}`;
      opt.addEventListener('click', () => setModel(m.id)); list.appendChild(opt);
    }
  }
  if (!anyVisible) { const none = document.createElement('div'); none.className = 'model-no-results'; none.textContent = 'No models match "'+filter+'"'; list.appendChild(none); }
}

function buildModelDropdown() { renderModelList(''); const s = document.getElementById('model-search'); if (s) s.value = ''; }
document.getElementById('model-selector-btn').addEventListener('click', () => {
  document.getElementById('model-selector').classList.toggle('open');
  if (document.getElementById('model-selector').classList.contains('open')) setTimeout(() => { const s=document.getElementById('model-search'); if(s){s.value='';s.focus();renderModelList('');} }, 50);
});
document.addEventListener('input', e => { if (e.target && e.target.id==='model-search') renderModelList(e.target.value); });
document.addEventListener('click', e => { if (e.target && e.target.id==='model-search') e.stopPropagation(); }, true);
document.addEventListener('click', e => { const ms=document.getElementById('model-selector'); if(ms&&!ms.contains(e.target)) ms.classList.remove('open'); });
function setModel(id) { S.currentModel=id; if(S.activeConvId&&S.conversations[S.activeConvId]) { S.conversations[S.activeConvId].model=id; saveConvs(); } updateModelDisplay(); buildModelDropdown(); document.getElementById('model-selector').classList.remove('open'); saveSettings(); }
function updateModelDisplay() { const info=getModelInfo(S.currentModel); document.getElementById('active-model-name').textContent=info.name; document.getElementById('active-model-dot').style.background=info.color; }
function populateSettingsModel() {
  const sel = document.getElementById('settings-default-model'); sel.innerHTML = '';
  for (const g of MODELS) for (const m of g.models) { const o=document.createElement('option'); o.value=m.id; o.textContent=`${g.provider}: ${m.name}`; if(m.id===S.currentModel) o.selected=true; sel.appendChild(o); }
}

// ── 8. TAB SWITCHING ──
document.querySelectorAll('.tab-btn').forEach(btn => btn.addEventListener('click', () => activateTab(btn.dataset.tab)));
function activateTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab===tab));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id===`panel-${tab}`));
}

// ── 9. FEATURE TOGGLES + RESPONSE LENGTH ──
document.getElementById('deepthink-toggle').addEventListener('click', toggleDeepThink);
document.getElementById('search-toggle').addEventListener('click', toggleWebSearch);
function toggleDeepThink() { S.deepThink=!S.deepThink; document.getElementById('deepthink-toggle').classList.toggle('active',S.deepThink); if(S.deepThink){S.webSearch=false;document.getElementById('search-toggle').classList.remove('active');} }
function toggleWebSearch() { S.webSearch=!S.webSearch; document.getElementById('search-toggle').classList.toggle('active',S.webSearch); if(S.webSearch){S.deepThink=false;document.getElementById('deepthink-toggle').classList.remove('active');} }

document.querySelectorAll('.length-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.length-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active'); S.responseLength = btn.dataset.len; saveSettings();
  });
});
function applyLengthUI() { document.querySelectorAll('.length-btn').forEach(b=>b.classList.toggle('active',b.dataset.len===S.responseLength)); }
function getLengthSysPrompt() {
  if (S.responseLength==='concise') return 'Be concise. Keep responses short and to the point. Avoid padding or unnecessary elaboration.';
  if (S.responseLength==='detailed') return 'Be thorough and detailed. Explain concepts fully, provide examples, and cover edge cases where relevant.';
  return '';
}

// ── 10. MESSAGE RENDERING ──
function renderChatMessages() {
  const area = document.getElementById('chatMessages');
  const emptyEl = document.getElementById('chatEmpty');
  const conv = S.activeConvId ? S.conversations[S.activeConvId] : null;
  const msgs = (conv && conv.messages) ? conv.messages : S.chatMessages;
  Array.from(area.children).forEach(c => { if (c.id!=='chatEmpty') c.remove(); });
  if (!msgs || !msgs.length) { if (emptyEl) emptyEl.style.display=''; return; }
  if (emptyEl) emptyEl.style.display='none';
  for (const msg of msgs) { if (msg.role==='system') continue; area.appendChild(createMsgEl(msg)); }
  area.scrollTop = area.scrollHeight;
  renderMermaidBlocks(area);
}

function createMsgEl(msg) {
  const wrap = document.createElement('div');
  wrap.className = `message ${msg.role}${msg.deepThink?' deepthink':''}`;

  const meta = document.createElement('div'); meta.className = 'msg-meta';
  if (msg.role==='user') {
    meta.textContent = 'You';
  } else {
    const info = getModelInfo(msg.model||S.currentModel);
    meta.textContent = info.name;
    meta.style.setProperty('--meta-dot-color', info.color);
  }
  if (msg.deepThink) { const dtl=document.createElement('div'); dtl.className='deepthink-label'; dtl.textContent='🧠 Deep Analysis'; meta.appendChild(dtl); }

  const body = document.createElement('div'); body.className = 'msg-body';
  if (msg.role==='assistant') {
    body.classList.add('md');
    body.innerHTML = renderMarkdown(msg.content||'');
    body.querySelectorAll('pre code').forEach(b => { try { hljs.highlightElement(b); } catch(e){} });
    renderMermaidBlocks(body);
    // KaTeX already rendered inline by renderMarkdown
  } else {
    // User message with possible image attachments
    if (msg.attachments && msg.attachments.length) {
      const attRow = document.createElement('div'); attRow.className = 'msg-att-row';
      msg.attachments.forEach(att => {
        if (att.type && att.type.startsWith('image/')) {
          const img = document.createElement('img'); img.src = att.dataUrl; img.className = 'msg-att-img'; img.alt = att.name;
          attRow.appendChild(img);
        } else {
          const chip = document.createElement('div'); chip.className = 'msg-att-chip';
          chip.textContent = '📄 '+att.name; attRow.appendChild(chip);
        }
      });
      wrap.appendChild(attRow);
    }
    body.textContent = msg.content||'';
  }

  wrap.append(meta, body);
  if (msg.role==='assistant') buildMsgActions(wrap, body, msg);
  if (msg.role==='user') buildUserActions(wrap, body, msg);
  return wrap;
}

function buildUserActions(wrap, body, msg) {
  const actions = document.createElement('div'); actions.className = 'msg-actions user-actions';
  // Edit button
  const editBtn = document.createElement('button'); editBtn.className = 'msg-action-btn'; editBtn.textContent = '✏ Edit';
  editBtn.addEventListener('click', e => { e.stopPropagation(); startEditMessage(wrap, body, msg); });
  actions.appendChild(editBtn);
  wrap.appendChild(actions);
}

function startEditMessage(wrap, body, msg) {
  if (S.busy) { toast('Cannot edit while generating', 'error'); return; }
  const original = msg.content || '';
  // Replace body with textarea
  const ta = document.createElement('textarea'); ta.className = 'msg-edit-ta'; ta.value = original;
  body.replaceWith(ta);
  autoResize(ta); ta.focus(); ta.selectionStart = ta.value.length;
  // Replace actions
  const oldActions = wrap.querySelector('.msg-actions.user-actions');
  const editActions = document.createElement('div'); editActions.className = 'msg-actions user-actions edit-actions';
  const saveBtn = document.createElement('button'); saveBtn.className = 'msg-action-btn active'; saveBtn.textContent = '✓ Save & Resend';
  const cancelBtn = document.createElement('button'); cancelBtn.className = 'msg-action-btn'; cancelBtn.textContent = '✕ Cancel';
  saveBtn.addEventListener('click', async () => {
    const newText = ta.value.trim();
    if (!newText) return;
    // Update body
    const newBody = document.createElement('div'); newBody.className = 'msg-body'; newBody.textContent = newText;
    ta.replaceWith(newBody); editActions.replaceWith(buildUserActionsEl(wrap, newBody, msg));
    // Update message content
    msg.content = newText;
    // Remove all messages after this one and resend
    const allMsgs = S.chatMessages;
    const idx = allMsgs.indexOf(msg);
    if (idx !== -1) {
      S.chatMessages = allMsgs.slice(0, idx+1);
      // Remove DOM elements after this message
      let next = wrap.nextSibling;
      while (next) { const n2 = next.nextSibling; next.remove(); next = n2; }
      // Remove the last assistantMsg if any
      if (S.chatMessages.length > 0 && S.chatMessages[S.chatMessages.length-1].role === 'user') {
        S.chatMessages.pop(); // will be re-added by sendChatWith
      }
      sendChatWith(newText);
    }
  });
  cancelBtn.addEventListener('click', () => { ta.replaceWith(body); editActions.replaceWith(oldActions||document.createElement('div')); });
  editActions.append(saveBtn, cancelBtn);
  if (oldActions) oldActions.replaceWith(editActions); else wrap.appendChild(editActions);
  ta.addEventListener('input', () => autoResize(ta));
}

function buildUserActionsEl(wrap, body, msg) {
  const actions = document.createElement('div'); actions.className = 'msg-actions user-actions';
  const editBtn = document.createElement('button'); editBtn.className = 'msg-action-btn'; editBtn.textContent = '✏ Edit';
  editBtn.addEventListener('click', e => { e.stopPropagation(); startEditMessage(wrap, body, msg); });
  actions.appendChild(editBtn);
  return actions;
}

function addThinkingEl(container, modelId) {
  const info = getModelInfo(modelId||S.currentModel);
  const el = document.createElement('div'); el.className = 'message assistant thinking';
  el.innerHTML = `<div class="msg-meta" style="--meta-dot-color:${info.color}">${info.name}</div><div class="msg-body"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>`;
  container.appendChild(el); container.scrollTop=container.scrollHeight; return el;
}
function addSearchingEl(container) {
  const el = document.createElement('div'); el.className = 'thinking-indicator';
  el.innerHTML = `<div class="thinking-dots"><span></span><span></span><span></span></div> 🔍 Searching the web…`;
  container.appendChild(el); container.scrollTop=container.scrollHeight; return el;
}

// ── 11. CORE CHAT / CODE ──
document.getElementById('chatSendBtn').addEventListener('click', sendChat);
document.getElementById('chatStopBtn').addEventListener('click', stopGeneration);
document.getElementById('chatInput').addEventListener('keydown', e => { if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();sendChat();} });
document.getElementById('imagePrompt').addEventListener('keydown', e => { if(e.key==='Enter'){e.preventDefault();generateImage();} });

function setBusy(val, panel='chat') {
  S.busy = val;
  const sendId = 'chatSendBtn';
  const stopId = 'chatStopBtn';
  document.getElementById(sendId).style.display = val ? 'none' : '';
  document.getElementById(stopId).style.display = val ? '' : 'none';
}

function stopGeneration() { S.abortStream = true; S.busy = false; setBusy(false, 'chat'); setBusy(false, 'code'); toast('Generation stopped'); }

// File attachment handling
document.getElementById('attach-btn').addEventListener('click', () => document.getElementById('file-input').click());
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
        att.dataUrl = null;
      }
      S.attachments.push(att);
    } catch(err) { toast('Failed to read '+file.name, 'error'); }
  }
  renderAttachmentStrip();
}

function readFileAsDataURL(f) { return new Promise((res,rej) => { const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsDataURL(f); }); }
function readFileAsText(f) { return new Promise((res,rej) => { const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsText(f); }); }

function renderAttachmentStrip() {
  const strip = document.getElementById('attachment-strip');
  strip.innerHTML = '';
  if (!S.attachments.length) { strip.style.display='none'; return; }
  strip.style.display='flex';
  S.attachments.forEach((att,i) => {
    const chip = document.createElement('div'); chip.className = 'att-chip';
    if (att.type && att.type.startsWith('image/')) {
      chip.innerHTML = `<img src="${att.dataUrl}" class="att-chip-img" alt="${escHtml(att.name)}"><span>${escHtml(att.name)}</span>`;
    } else {
      chip.innerHTML = `<span class="att-chip-icon">📄</span><span>${escHtml(att.name)}</span>`;
    }
    const del = document.createElement('button'); del.className='att-chip-del'; del.textContent='×';
    del.addEventListener('click', () => { S.attachments.splice(i,1); renderAttachmentStrip(); });
    chip.appendChild(del); strip.appendChild(chip);
  });
}

async function sendChat() {
  if (S.busy) return;
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text && !S.attachments.length) return;

  if (!S.activeConvId) {
    const conv = { id: crypto.randomUUID(), title:'', model:S.currentModel, createdAt:Date.now(), updatedAt:Date.now(), messages:[], pinned:false };
    S.conversations[conv.id] = conv; S.activeConvId = conv.id; saveConvs();
  }
  input.value=''; input.style.height='auto';

  const pendingAtts = [...S.attachments]; S.attachments = []; renderAttachmentStrip();
  await sendChatWith(text, pendingAtts);
}

async function sendChatWith(text, attachments=[]) {
  setBusy(true, 'chat');
  S.abortStream = false;
  const chatArea = document.getElementById('chatMessages');
  const emptyEl = document.getElementById('chatEmpty');
  if (emptyEl) emptyEl.style.display='none';

  const userMsg = { role:'user', content:text, attachments: attachments.length ? attachments : undefined };
  S.chatMessages.push(userMsg);
  chatArea.appendChild(createMsgEl(userMsg));
  chatArea.scrollTop = chatArea.scrollHeight;

  // Build messages for API
  let messages = [];
  let sysPrompt = '';
  if (S.customInstructions) sysPrompt += S.customInstructions+'\n\n';
  if (S.deepThink) sysPrompt += 'You are in deep reasoning mode. Think step by step, explore multiple angles, challenge your own assumptions, then deliver a thorough, well-structured answer.\n\n';
  const lenHint = getLengthSysPrompt();
  if (lenHint) sysPrompt += lenHint+'\n\n';
  if (S.systemPrompt) sysPrompt += S.systemPrompt;
  if (sysPrompt.trim()) messages.push({ role:'system', content: sysPrompt.trim() });

  const history = S.memoryEnabled ? S.chatMessages.slice(-30) : [S.chatMessages[S.chatMessages.length-1]];

  // Build multimodal messages if attachments
  for (const m of history) {
    if (m.role==='system') continue;
    if (m.attachments && m.attachments.length) {
      const parts = [];
      if (m.content) parts.push({ type:'text', text: m.content });
      for (const att of m.attachments) {
        if (att.type && att.type.startsWith('image/') && att.dataUrl) {
          parts.push({ type:'image_url', image_url:{ url: att.dataUrl } });
        } else if (att.content) {
          parts.push({ type:'text', text: `[File: ${att.name}]\n\`\`\`\n${att.content.slice(0,8000)}\n\`\`\`` });
        }
      }
      messages.push({ role: m.role, content: parts });
    } else {
      messages.push({ role: m.role, content: m.content });
    }
  }

  const effectiveModel = S.deepThink ? 'deepseek/deepseek-r1' : S.currentModel;
  const thinkEl = S.webSearch ? addSearchingEl(chatArea) : addThinkingEl(chatArea, effectiveModel);

  let full = '';
  const assistantMsg = { role:'assistant', content:'', deepThink:S.deepThink, model:effectiveModel };

  try {
    const opts = { model:effectiveModel, stream:true, temperature:S.temperature };
    if (S.webSearch) opts.tools=[{ type:'web_search_20250305', name:'web_search' }];
    const resp = await puter.ai.chat(messages, opts);
    if (thinkEl && thinkEl.parentNode) thinkEl.remove();

    const wrap = document.createElement('div'); wrap.className=`message assistant${S.deepThink?' deepthink':''}`;
    const meta = document.createElement('div'); meta.className='msg-meta';
    const _info = getModelInfo(effectiveModel); meta.textContent=_info.name; meta.style.setProperty('--meta-dot-color',_info.color);
    const body = document.createElement('div'); body.className='msg-body md streaming-cursor';
    wrap.append(meta, body); chatArea.appendChild(wrap);

    if (resp && typeof resp[Symbol.asyncIterator]==='function') {
      for await (const part of resp) {
        if (S.abortStream) break;
        const t = part?.text||part?.message?.content||'';
        if (t) { full+=t; body.innerHTML=renderMarkdown(full); chatArea.scrollTop=chatArea.scrollHeight; }
      }
    } else if (resp?.message?.content) { full=resp.message.content; body.innerHTML=renderMarkdown(full); }
    else if (typeof resp==='string') { full=resp; body.innerHTML=renderMarkdown(full); }

    body.classList.remove('streaming-cursor');
    body.querySelectorAll('pre code').forEach(b => { try { hljs.highlightElement(b); } catch(e){} });
    renderMermaidBlocks(body);

    assistantMsg.content = full;
    S.chatMessages.push(assistantMsg);
    persistConversation(text, full);
    buildMsgActions(wrap, body, assistantMsg);
    if (S.speakResponses && full) speakText(full);
    updateCtxIndicator();

  } catch(err) {
    if (thinkEl && thinkEl.parentNode) thinkEl.remove();
    if (!S.abortStream) {
      const errWrap = document.createElement('div'); errWrap.className='message error';
      errWrap.innerHTML=`<div class="msg-meta">Error</div><div class="msg-body">${escHtml(err.message||'Something went wrong.')}</div>`;
      chatArea.appendChild(errWrap); chatArea.scrollTop=chatArea.scrollHeight;
      toast('Error: '+(err.message||'Request failed'),'error');
    }
  }

  setBusy(false, 'chat'); S.abortStream = false;
}

// sendCode is now handled by the IDE AI assistant (see IDE section below)

// ── 12. IMAGE GENERATION — Comprehensive Provider Registry ──
const IMAGE_PROVIDERS = {
  'openai-image-generation': {
    label: 'OpenAI', color: '#10a37f', puterKey: 'openai-image-generation',
    models: [
      { id: 'gpt-image-1',      name: 'GPT Image 1',       badge: 'LATEST', info: 'Most capable OpenAI image model. Supports edits & variations.' },
      { id: 'gpt-image-1-mini', name: 'GPT Image 1 Mini',  badge: 'FAST',   info: 'Faster, lower-cost version of GPT Image 1.' },
      { id: 'dall-e-3',         name: 'DALL·E 3',          badge: 'HD',     info: 'High-quality images with natural/vivid style options.' },
      { id: 'dall-e-2',         name: 'DALL·E 2',          badge: '',       info: 'Classic DALL-E model. Supports multiple output sizes.' },
    ],
    caps: {
      'gpt-image-1':      { sizes:[['1024x1024','1024×1024 (Square)'],['1536x1024','1536×1024 (Landscape)'],['1024x1536','1024×1536 (Portrait)'],['auto','Auto']], qualities:[['auto','Auto'],['high','High'],['medium','Medium'],['low','Low']], formats:true, steps:false, guidance:false, neg:false, styleMode:false, count:true },
      'gpt-image-1-mini': { sizes:[['1024x1024','1024×1024 (Square)'],['1536x1024','1536×1024 (Landscape)'],['1024x1536','1024×1536 (Portrait)'],['auto','Auto']], qualities:[['auto','Auto'],['high','High'],['medium','Medium'],['low','Low']], formats:true, steps:false, guidance:false, neg:false, styleMode:false, count:false },
      'dall-e-3':         { sizes:[['1024x1024','1024×1024 (Square)'],['1792x1024','1792×1024 (Landscape)'],['1024x1792','1024×1792 (Portrait)']], qualities:[['standard','Standard'],['hd','HD']], formats:false, steps:false, guidance:false, neg:false, styleMode:true, count:false },
      'dall-e-2':         { sizes:[['256x256','256×256 (Small)'],['512x512','512×512 (Medium)'],['1024x1024','1024×1024 (Large)']], qualities:[], formats:false, steps:false, guidance:false, neg:false, styleMode:false, count:true },
    }
  },
  together: {
    label: 'Together AI', color: '#ff6b35', puterKey: 'together',
    models: [
      { id: 'black-forest-labs/FLUX.1-schnell-Free', name: 'FLUX.1 Schnell',        badge: 'FREE', info: 'Free FLUX model. Fast generation, great quality.' },
      { id: 'black-forest-labs/FLUX.1-schnell',      name: 'FLUX.1 Schnell Pro',    badge: 'FAST', info: 'Fastest FLUX model with premium features.' },
      { id: 'black-forest-labs/FLUX.1.1-pro',        name: 'FLUX 1.1 Pro',          badge: 'BEST', info: 'Highest quality FLUX model. Best for professional use.' },
      { id: 'black-forest-labs/FLUX.1-dev',          name: 'FLUX.1 Dev',            badge: '',     info: 'Development model with guidance scale support.' },
      { id: 'black-forest-labs/FLUX.1-pro',          name: 'FLUX.1 Pro',            badge: 'PRO',  info: 'Pro-tier FLUX with enhanced quality controls.' },
      { id: 'black-forest-labs/FLUX.1-depth-dev',    name: 'FLUX.1 Depth',          badge: '',     info: 'Depth-aware FLUX model for structured scenes.' },
      { id: 'black-forest-labs/FLUX.1-canny-dev',    name: 'FLUX.1 Canny',          badge: '',     info: 'Edge-guided FLUX model for precise control.' },
      { id: 'stabilityai/stable-diffusion-xl-base-1.0', name: 'SDXL Base 1.0',      badge: '',     info: 'Stable Diffusion XL — powerful open-source model.' },
      { id: 'stabilityai/stable-diffusion-2-1',      name: 'Stable Diffusion 2.1',  badge: '',     info: 'Classic SD 2.1 with negative prompt support.' },
      { id: 'SG161222/Realistic_Vision_V3.0_VAE',    name: 'Realistic Vision V3',   badge: '',     info: 'Fine-tuned for photorealistic portraits and scenes.' },
      { id: 'prompthero/openjourney',                name: 'OpenJourney v4',         badge: '',     info: 'Midjourney-inspired artistic style model.' },
      { id: 'wavymulder/Analog-Diffusion',           name: 'Analog Diffusion',       badge: '',     info: 'Vintage analog photography aesthetic.' },
    ],
    caps: {
      default: {
        sizes:[['512x512','512×512'],['768x768','768×768 (Square)'],['1024x1024','1024×1024 (Square)'],['1280x720','1280×720 (16:9 HD)'],['720x1280','720×1280 (9:16 Portrait)'],['1024x768','1024×768 (4:3)'],['768x1024','768×1024 (3:4)'],['1536x640','1536×640 (Ultrawide)'],['640x1536','640×1536 (Tall)']],
        qualities:[], steps:true, guidance:true, neg:true, formats:false, styleMode:false, count:false,
        stepsRange:[10,50,28], guidanceRange:[1,20,7.5]
      }
    }
  },
  xai: {
    label: 'xAI / Grok', color: '#d4d4d4', puterKey: 'xai',
    models: [
      { id: 'grok-2-image',      name: 'Grok 2 Image',       badge: 'SMART', info: 'xAI\'s image generation model with high coherence.' },
      { id: 'grok-2-image-1212', name: 'Grok 2 Image 1212',  badge: '',      info: 'Updated December 2024 Grok image model.' },
    ],
    caps: {
      default: {
        sizes:[['1024x1024','1024×1024 (Square)'],['1792x1024','1792×1024 (Landscape)'],['1024x1792','1024×1792 (Portrait)']],
        qualities:[], steps:false, guidance:false, neg:false, formats:false, styleMode:false, count:true
      }
    }
  }
};

let activeImgProvider = 'openai-image-generation';
let activeImgCount = 1;

// AR → size mappings per provider
const AR_SIZE_MAP = {
  'openai-image-generation': {
    '1:1': '1024x1024', '16:9': '1792x1024', '9:16': '1024x1792',
    '4:3': '1024x1024', '3:4': '1024x1024', '3:2': '1792x1024'
  },
  together: {
    '1:1': '1024x1024', '16:9': '1280x720', '9:16': '720x1280',
    '4:3': '1024x768', '3:4': '768x1024', '3:2': '1024x768'
  },
  xai: {
    '1:1': '1024x1024', '16:9': '1792x1024', '9:16': '1024x1792',
    '4:3': '1024x1024', '3:4': '1024x1792', '3:2': '1792x1024'
  }
};
let activeAR = '1:1';

// Provider tab switching
document.querySelectorAll('.img-prov-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    activeImgProvider = btn.dataset.provider;
    document.querySelectorAll('.img-prov-btn').forEach(b => b.classList.toggle('active', b === btn));
    updateImageModels();
  });
});

document.getElementById('imageModel').addEventListener('change', updateImageCaps);

function updateImageModels() {
  const p = IMAGE_PROVIDERS[activeImgProvider]; if (!p) return;
  const sel = document.getElementById('imageModel');
  sel.innerHTML = '';
  p.models.forEach(m => {
    const o = document.createElement('option');
    o.value = m.id;
    o.textContent = m.name + (m.badge ? ` [${m.badge}]` : '');
    sel.appendChild(o);
  });
  updateImageCaps();
}

function updateImageCaps() {
  const p = IMAGE_PROVIDERS[activeImgProvider]; if (!p) return;
  const modelId = document.getElementById('imageModel').value;
  const caps = p.caps[modelId] || p.caps.default || {};
  const modelMeta = p.models.find(m => m.id === modelId);

  // Model info tooltip
  const infoEl = document.getElementById('img-model-info');
  if (infoEl) infoEl.textContent = modelMeta?.info || '';

  // Resolution
  const sF = document.getElementById('imageSizeField');
  const sS = document.getElementById('imageSize');
  if (caps.sizes && caps.sizes.length) {
    sS.innerHTML = caps.sizes.map(([v,l]) => `<option value="${v}">${l}</option>`).join('');
    // Try to match active AR
    const arTarget = AR_SIZE_MAP[activeImgProvider]?.[activeAR];
    if (arTarget) {
      const opt = sS.querySelector(`option[value="${arTarget}"]`);
      if (opt) opt.selected = true;
    }
    sF.style.display = '';
  } else { sF.style.display = 'none'; }

  // Quality
  const qF = document.getElementById('imageQualityField');
  const qS = document.getElementById('imageQuality');
  if (caps.qualities && caps.qualities.length) {
    qS.innerHTML = caps.qualities.map(([v,l]) => `<option value="${v}">${l}</option>`).join('');
    qF.style.display = '';
  } else { qF.style.display = 'none'; }

  // DALL-E 3 style mode
  const smF = document.getElementById('imgStyleModeField');
  if (smF) smF.style.display = caps.styleMode ? '' : 'none';

  // Output format
  const fmF = document.getElementById('imgFormatField');
  if (fmF) fmF.style.display = caps.formats ? '' : 'none';

  // Steps
  const stepsRow = document.getElementById('cap-steps');
  if (stepsRow) {
    stepsRow.style.display = caps.steps ? '' : 'none';
    if (caps.steps && caps.stepsRange) {
      const sl = document.getElementById('imageSteps');
      sl.min = caps.stepsRange[0]; sl.max = caps.stepsRange[1]; sl.value = caps.stepsRange[2];
      document.getElementById('stepsVal').textContent = sl.value;
    }
  }

  // Guidance
  const guideRow = document.getElementById('cap-guidance');
  if (guideRow) {
    guideRow.style.display = caps.guidance ? '' : 'none';
    if (caps.guidance && caps.guidanceRange) {
      const gl = document.getElementById('imageGuidance');
      gl.min = caps.guidanceRange[0] * 10; gl.max = caps.guidanceRange[1] * 10; gl.value = caps.guidanceRange[2] * 10;
      document.getElementById('guidanceVal').textContent = (gl.value / 10).toFixed(1);
    }
  }

  // Negative prompt
  const negWrap = document.getElementById('negPromptWrap');
  if (negWrap) negWrap.style.display = caps.neg ? '' : 'none';

  // Count field hide for models that only support n=1
  const countField = document.getElementById('imageCountField');
  if (countField) countField.style.display = (caps.count === false) ? 'none' : '';
}

// Aspect ratio buttons
document.querySelectorAll('.img-ar-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    activeAR = btn.dataset.ar;
    document.querySelectorAll('.img-ar-btn').forEach(b => b.classList.toggle('active', b === btn));
    // Update size select to match AR
    const target = AR_SIZE_MAP[activeImgProvider]?.[activeAR];
    if (target) {
      const sS = document.getElementById('imageSize');
      const opt = sS.querySelector(`option[value="${target}"]`);
      if (opt) opt.selected = true;
    }
  });
});

// Count buttons
document.querySelectorAll('.img-count-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    activeImgCount = parseInt(btn.dataset.count) || 1;
    document.querySelectorAll('.img-count-btn').forEach(b => b.classList.toggle('active', b === btn));
  });
});

// Sliders live update
document.getElementById('imageSteps').addEventListener('input', function() { document.getElementById('stepsVal').textContent = this.value; });
document.getElementById('imageGuidance').addEventListener('input', function() { document.getElementById('guidanceVal').textContent = (this.value / 10).toFixed(1); });

// Style presets
document.querySelectorAll('.style-preset').forEach(btn => {
  btn.addEventListener('click', () => { document.querySelectorAll('.style-preset').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); S.activeStyle=btn.dataset.style; });
});

// Enhance prompt with AI
document.getElementById('img-enhance-btn').addEventListener('click', async function() {
  const ta = document.getElementById('imagePrompt');
  const orig = ta.value.trim(); if (!orig) { toast('Enter a prompt first', 'error'); return; }
  this.textContent = '…'; this.disabled = true;
  try {
    const resp = await puter.ai.chat([{ role: 'user', content: `Enhance this image generation prompt to be more vivid, detailed and descriptive. Keep the same subject and concept but add: artistic details, lighting direction, mood, color palette, composition, and style cues. Return ONLY the enhanced prompt, no explanation, no quotes, no preamble:\n\n${orig}` }], { model: 'gpt-4o-mini', stream: false });
    const enhanced = (typeof resp === 'string' ? resp : resp?.message?.content || '').trim().replace(/^["']|["']$/g, '');
    if (enhanced) { ta.value = enhanced; toast('Prompt enhanced ✨'); }
  } catch(e) { toast('Enhancement failed', 'error'); }
  this.textContent = '✨ Enhance'; this.disabled = false;
});

document.getElementById('genImgBtn').addEventListener('click', generateImage);

async function generateImage() {
  const promptEl = document.getElementById('imagePrompt');
  const prompt = promptEl.value.trim(); if (!prompt) { toast('Enter a prompt first', 'error'); return; }
  const fullPrompt = S.activeStyle ? `${prompt}, ${S.activeStyle}` : prompt;
  const p = IMAGE_PROVIDERS[activeImgProvider]; if (!p) return;
  const modelId = document.getElementById('imageModel').value;
  const caps = p.caps[modelId] || p.caps.default || {};

  const sEl = document.getElementById('imageSize');
  const qEl = document.getElementById('imageQuality');
  const fmEl = document.getElementById('imageFormat');
  const smEl = document.getElementById('imageStyleMode');
  const seedEl = document.getElementById('imageSeed');

  const sF = document.getElementById('imageSizeField');
  const qF = document.getElementById('imageQualityField');

  const imgSize = (sEl && sF && sF.style.display !== 'none' && sEl.value && sEl.value !== 'auto') ? sEl.value : undefined;
  const imgQuality = (qEl && qF && qF.style.display !== 'none' && qEl.value && qEl.value !== 'auto') ? qEl.value : undefined;
  const imgFormat = (caps.formats && fmEl?.value) ? fmEl.value : undefined;
  const imgStyleMode = (caps.styleMode && smEl?.value) ? smEl.value : undefined;
  const negPrompt = document.getElementById('imageNegPrompt')?.value?.trim() || '';
  const steps = caps.steps ? parseInt(document.getElementById('imageSteps').value) : undefined;
  const guidance = caps.guidance ? parseFloat(document.getElementById('imageGuidance').value) / 10 : undefined;
  const seed = seedEl?.value?.trim() ? parseInt(seedEl.value) : undefined;
  const count = (caps.count !== false) ? activeImgCount : 1;

  const btn = document.getElementById('genImgBtn'); btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Generating…';
  const gallery = document.getElementById('imageGallery');
  const emptyEl = document.getElementById('imageEmpty'); if (emptyEl) emptyEl.style.display = 'none';

  const cards = [];
  for (let i = 0; i < count; i++) {
    const card = document.createElement('div'); card.className = 'img-card';
    card.innerHTML = '<div class="loading-box"><span class="spinner"></span> Creating…</div>';
    gallery.insertBefore(card, gallery.firstChild);
    cards.push(card);
  }

  const genOne = async (card) => {
    try {
      const imgOpts = { prompt: fullPrompt, provider: p.puterKey, model: modelId };
      if (imgSize) imgOpts.size = imgSize;
      if (imgQuality) imgOpts.quality = imgQuality;
      if (imgFormat) imgOpts.output_format = imgFormat;
      if (imgStyleMode) imgOpts.style = imgStyleMode;
      if (steps) imgOpts.steps = steps;
      if (guidance) imgOpts.guidance_scale = guidance;
      if (negPrompt && caps.neg) imgOpts.negative_prompt = negPrompt;
      if (seed !== undefined) imgOpts.seed = seed;
      const image = await puter.ai.txt2img(imgOpts);
      const src = image.src || image.url || (image instanceof Blob ? URL.createObjectURL(image) : String(image));
      const shortPrompt = prompt.length > 90 ? prompt.slice(0, 90) + '…' : prompt;
      card.innerHTML = `
        <div class="img-card-overlay">
          <button class="img-card-btn dl-btn" title="Download">⬇</button>
          <button class="img-card-btn img-card-vary" title="Variations">↻</button>
        </div>
        <img src="${src}" alt="${escHtml(shortPrompt)}" loading="lazy"/>
        <div class="caption">${escHtml(shortPrompt)}</div>`;
      card.querySelector('.dl-btn').addEventListener('click', () => dlImg(card));
      card.querySelector('.img-card-vary').addEventListener('click', () => {
        document.getElementById('imagePrompt').value = prompt;
        toast('Prompt set — click Generate for a variation');
      });
    } catch(err) {
      card.innerHTML = `<div class="loading-box" style="flex-direction:column;gap:6px;color:var(--err);font-size:11px;padding:14px;text-align:center;"><span style="font-size:1.6rem">✕</span>${escHtml(err.message||'Generation failed')}</div>`;
      toast('Image failed: ' + (err.message || ''), 'error');
    }
  };

  await Promise.all(cards.map(genOne));
  btn.disabled = false; btn.innerHTML = '✦ Generate Image';
}
function dlImg(card) { const src=card.querySelector('img').src; const a=document.createElement('a'); a.href=src; a.download=`neuraldock-${Date.now()}.png`; a.click(); toast('Image downloaded'); }

// ── 13. VOICE / TTS ──
document.getElementById('voiceProvider').addEventListener('change', updateVoiceOptions);
document.getElementById('speakBtn').addEventListener('click', generateSpeech);
document.getElementById('voiceText').addEventListener('input', function() {
  const n=this.value.length; const el=document.getElementById('voiceCharCount');
  el.textContent=`${n} / 3000`; el.className='char-count'+(n>2900?' danger':n>2500?' warn':'');
});

const VOICE_REGISTRY = {
  'aws-polly': {
    voices: [['Joanna','Joanna (F, en-US)'],['Matthew','Matthew (M, en-US)'],['Salli','Salli (F, en-US)'],['Ivy','Ivy (F, en-US)'],['Kendra','Kendra (F, en-US)'],['Kimberly','Kimberly (F, en-US)'],['Ruth','Ruth (F, en-US)'],['Kevin','Kevin (M, en-US)'],['Stephen','Stephen (M, en-US)'],['Gregory','Gregory (M, en-US)'],['Danielle','Danielle (F, en-US)'],['Amy','Amy (F, en-GB)'],['Brian','Brian (M, en-GB)'],['Emma','Emma (F, en-GB)'],['Arthur','Arthur (M, en-GB)'],['Olivia','Olivia (F, en-AU)'],['Celine','Céline (F, fr-FR)'],['Mathieu','Mathieu (M, fr-FR)'],['Lea','Léa (F, fr-FR)'],['Hans','Hans (M, de-DE)'],['Marlene','Marlene (F, de-DE)'],['Vicki','Vicki (F, de-DE)'],['Conchita','Conchita (F, es-ES)'],['Enrique','Enrique (M, es-ES)'],['Lucia','Lucia (F, es-ES)'],['Lupe','Lupe (F, es-US)'],['Miguel','Miguel (M, es-US)'],['Pedro','Pedro (M, es-US)'],['Bianca','Bianca (F, it-IT)'],['Giorgio','Giorgio (M, it-IT)'],['Mizuki','Mizuki (F, ja-JP)'],['Takumi','Takumi (M, ja-JP)'],['Zhiyu','Zhiyu (F, cmn-CN)']],
    engines: [['neural','Neural'],['generative','Generative'],['standard','Standard']],
  },
  'openai': {
    voices: [['alloy','Alloy'],['ash','Ash'],['ballad','Ballad'],['coral','Coral'],['echo','Echo'],['fable','Fable'],['nova','Nova'],['onyx','Onyx'],['sage','Sage'],['shimmer','Shimmer'],['verse','Verse']],
    engines: [['gpt-4o-mini-tts','GPT-4o Mini TTS'],['gpt-4o-audio-preview','GPT-4o Audio Preview'],['tts-1-hd','TTS-1 HD'],['tts-1','TTS-1']],
  },
  'elevenlabs': {
    voices: [['21m00Tcm4TlvDq8ikWAM','Rachel'],['EXAVITQu4vr4xnSDxMaL','Bella'],['MF3mGyEYCl7XYWbV9V6O','Elli'],['TxGEqnHWrfWFTfGW9XjX','Josh'],['VR6AewLTigWG4xSOukaG','Arnold'],['pNInz6obpgDQGcFmaJgB','Adam'],['yoZ06aMxZJJ28mfd3POQ','Sam'],['AZnzlk1XvdvUeBnXmlld','Domi'],['jBpfuIE2acCO8z3wKNLl','Ethan'],['onwK4e9ZLuTAKqWW03F9','Daniel'],['XrExE9yKIg1WjnnlVkGX','Lily']],
    engines: [['eleven_v3','Eleven V3 (latest)'],['eleven_multilingual_v2','Multilingual V2'],['eleven_flash_v2_5','Flash V2.5'],['eleven_turbo_v2_5','Turbo V2.5'],['eleven_monolingual_v1','Monolingual V1']],
  },
  'playht': {
    voices: [['s3://voice-cloning-zero-shot/d9ff78ba-d016-47f6-b0ef-dd630f59414e/female-cs/manifest.json','Female (US)'],['s3://voice-cloning-zero-shot/6c4bef56-e454-4edd-af22-1e6bd56f4e8c/anthonymundell/manifest.json','Anthony (UK)'],['s3://peregrine-voices/joe wo mixed/manifest.json','Joe'],['s3://peregrine-voices/donna/manifest.json','Donna']],
    engines: [['PlayHT2.0-turbo','PlayHT2.0 Turbo'],['PlayHT2.0','PlayHT2.0'],['Play3.0-mini','Play3.0 Mini'],['PlayDialog','PlayDialog']],
  },
  'openai-fm': {
    voices: [['alloy','Alloy'],['ash','Ash'],['ballad','Ballad'],['coral','Coral'],['echo','Echo'],['fable','Fable'],['nova','Nova'],['onyx','Onyx'],['sage','Sage'],['shimmer','Shimmer']],
    engines: [['gpt-4o-mini-audio-preview','GPT-4o Mini Audio Preview'],['gpt-4o-audio-preview','GPT-4o Audio Preview']],
  },
};

function updateVoiceOptions() {
  const p=document.getElementById('voiceProvider').value, vs=document.getElementById('voiceSelect'), es=document.getElementById('voiceEngine');
  vs.innerHTML=''; es.innerHTML=''; const reg=VOICE_REGISTRY[p]; if(!reg) return;
  reg.voices.forEach(([v,l])=>{ vs.innerHTML+=`<option value="${v}">${l}</option>`; });
  reg.engines.forEach(([v,l])=>{ es.innerHTML+=`<option value="${v}">${l}</option>`; });
}

async function generateSpeech() {
  const text=document.getElementById('voiceText').value.trim(); if(!text) return;
  const provider=document.getElementById('voiceProvider').value, voice=document.getElementById('voiceSelect').value, engine=document.getElementById('voiceEngine').value;
  const btn=document.getElementById('speakBtn'); btn.disabled=true; btn.innerHTML='<span class="spinner"></span> Generating…';
  const emptyEl=document.getElementById('voiceEmpty'); if(emptyEl) emptyEl.style.display='none';
  try {
    let opts={};
    if(provider==='aws-polly') opts={voice,engine,language:'en-US'};
    else if(provider==='openai') opts={provider:'openai',model:engine,voice};
    else if(provider==='elevenlabs') opts={provider:'elevenlabs',model:engine,voice,output_format:'mp3_44100_128'};
    else if(provider==='playht') opts={provider:'playht',model:engine,voice};
    else if(provider==='openai-fm') opts={provider:'openai-fm',model:engine,voice};
    const audio=await puter.ai.txt2speech(text,opts);
    const history=document.getElementById('voiceHistory');
    const card=document.createElement('div'); card.className='v-card';
    const short=text.length>180?text.substring(0,180)+'…':text;
    const vLabel=document.getElementById('voiceSelect').selectedOptions[0]?.text||voice;
    card.innerHTML=`<div class="v-text">"${escHtml(short)}"</div><div class="v-tags"><span class="v-tag">${escHtml(provider)}</span><span class="v-tag">${escHtml(vLabel)}</span></div>`;
    audio.controls=true; audio.style.cssText='width:100%;height:36px;margin-top:8px;'; card.appendChild(audio);
    history.insertBefore(card,history.firstChild); audio.play();
  } catch(err) {
    toast('Speech generation failed: '+(err.message||''),'error');
  }
  btn.disabled=false; btn.innerHTML='♪ Generate Speech';
}

function speakText(text) {
  if(!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const clean=text.replace(/[#*`_\[\]()]/g,'').replace(/\n+/g,'. ');
  const utt=new SpeechSynthesisUtterance(clean); utt.rate=S.speakSpeed;
  window.speechSynthesis.speak(utt);
}

// ── 14. VOICE INPUT ──
let recognition=null;
document.getElementById('voice-input-btn').addEventListener('click', startVoiceInput);
document.getElementById('voice-cancel-btn').addEventListener('click', stopVoiceInput);

function startVoiceInput() {
  if(!('webkitSpeechRecognition' in window||'SpeechRecognition' in window)){toast('Voice input not supported','error');return;}
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  recognition=new SR(); recognition.interimResults=true; recognition.continuous=false; recognition.lang='en-US';
  document.getElementById('voice-overlay').classList.add('active');
  document.getElementById('voice-status').textContent='Listening…';
  recognition.onresult=e=>{
    let t=''; for(let i=0;i<e.results.length;i++) t+=e.results[i][0].transcript;
    document.getElementById('voice-status').textContent=t||'Listening…';
    if(e.results[0].isFinal){const inp=document.getElementById('chatInput');inp.value=t;autoResize(inp);stopVoiceInput();}
  };
  recognition.onerror=()=>stopVoiceInput();
  recognition.onend=()=>document.getElementById('voice-overlay').classList.remove('active');
  recognition.start();
}
function stopVoiceInput(){if(recognition){recognition.stop();recognition=null;}document.getElementById('voice-overlay').classList.remove('active');}

// ── 14b. LIVE VOICE CONVERSATION ──
document.getElementById('live-voice-tab-btn').addEventListener('click', openLiveVoice);
document.getElementById('live-voice-end-btn').addEventListener('click', closeLiveVoice);
let liveVoiceRecorder=null, liveVoiceChunks=[], liveVoiceBusy=false;

function openLiveVoice() {
  document.getElementById('live-voice-overlay').style.display='flex';
}
function closeLiveVoice() {
  document.getElementById('live-voice-overlay').style.display='none';
  if(liveVoiceRecorder&&liveVoiceRecorder.state!=='inactive') liveVoiceRecorder.stop();
  liveVoiceRecorder=null; liveVoiceChunks=[];
}

const liveBtn=document.getElementById('live-voice-talk-btn');
liveBtn.addEventListener('mousedown', startLiveTalk);
liveBtn.addEventListener('mouseup', stopLiveTalk);
liveBtn.addEventListener('touchstart', e=>{e.preventDefault();startLiveTalk();});
liveBtn.addEventListener('touchend', e=>{e.preventDefault();stopLiveTalk();});

async function startLiveTalk() {
  if(liveVoiceBusy) return;
  try {
    const stream=await navigator.mediaDevices.getUserMedia({audio:true});
    liveVoiceChunks=[];
    liveVoiceRecorder=new MediaRecorder(stream);
    liveVoiceRecorder.ondataavailable=e=>{ if(e.data.size>0) liveVoiceChunks.push(e.data); };
    liveVoiceRecorder.start();
    document.getElementById('live-voice-status').textContent='Recording…';
    document.getElementById('live-voice-orb').classList.add('recording');
  } catch(err){ toast('Microphone access denied','error'); }
}

async function stopLiveTalk() {
  if(!liveVoiceRecorder||liveVoiceRecorder.state==='inactive') return;
  liveVoiceBusy=true;
  document.getElementById('live-voice-status').textContent='Processing…';
  document.getElementById('live-voice-orb').classList.remove('recording');
  liveVoiceRecorder.stop();
  liveVoiceRecorder.onstop=async()=>{
    try {
      const blob=new Blob(liveVoiceChunks,{type:'audio/webm'});
      // Transcribe
      let transcript='';
      try {
        const transcribed=await puter.ai.transcribe(blob);
        transcript=(typeof transcribed==='string'?transcribed:transcribed?.text||'').trim();
      } catch(e) {
        // fallback: use Web Speech API result if available
        transcript='[Transcription failed — please type instead]';
      }
      if(!transcript){liveVoiceBusy=false;document.getElementById('live-voice-status').textContent='Nothing heard. Try again.';return;}
      document.getElementById('live-voice-transcript').innerHTML+=`<div class="lv-user">${escHtml(transcript)}</div>`;
      document.getElementById('live-voice-status').textContent='Thinking…';

      // Get AI response
      const msgs=[...S.chatMessages.slice(-10),{role:'user',content:transcript}];
      if(S.systemPrompt) msgs.unshift({role:'system',content:S.systemPrompt});
      const resp=await puter.ai.chat(msgs,{model:S.currentModel,stream:false,temperature:S.temperature});
      const answer=(typeof resp==='string'?resp:resp?.message?.content||'').trim();
      document.getElementById('live-voice-transcript').innerHTML+=`<div class="lv-ai">${escHtml(answer)}</div>`;
      document.getElementById('live-voice-status').textContent='Speaking…';

      // Speak response
      const audio=await puter.ai.txt2speech(answer.slice(0,500),{provider:'openai',model:'tts-1',voice:'alloy'});
      audio.onended=()=>{ document.getElementById('live-voice-status').textContent='Hold the button to speak'; liveVoiceBusy=false; };
      audio.play();

      // Also add to chat
      const userMsgLV={role:'user',content:transcript};
      const aiMsgLV={role:'assistant',content:answer,model:S.currentModel};
      S.chatMessages.push(userMsgLV,aiMsgLV);
      if(S.activeConvId) persistConversation(transcript,answer);

    } catch(err) {
      toast('Live voice error: '+(err.message||''),'error');
      liveVoiceBusy=false; document.getElementById('live-voice-status').textContent='Error. Try again.';
    }
  };
}

// ── 15. SETTINGS ──
document.getElementById('settings-open-btn').addEventListener('click', openSettings);
document.getElementById('settings-close-btn').addEventListener('click', closeSettings);
document.getElementById('settings-overlay').addEventListener('click', closeSettings);
function openSettings(){document.getElementById('settings-overlay').classList.add('open');document.getElementById('settings-drawer').classList.add('open');}
function closeSettings(){document.getElementById('settings-overlay').classList.remove('open');document.getElementById('settings-drawer').classList.remove('open');}

document.querySelectorAll('.size-option').forEach(btn=>btn.addEventListener('click',()=>setFontSize(btn.dataset.size)));
function setFontSize(size){S.fontSize=size;document.querySelectorAll('.size-option').forEach(b=>b.classList.toggle('active',b.dataset.size===size));applyFontSize(size);saveSettings();}
function applyFontSize(size){document.documentElement.setAttribute('data-font-size',size);}

document.getElementById('speak-toggle').addEventListener('click',()=>{S.speakResponses=!S.speakResponses;document.getElementById('speak-toggle').classList.toggle('active',S.speakResponses);saveSettings();});
document.getElementById('memory-toggle').addEventListener('click',()=>{S.memoryEnabled=!S.memoryEnabled;document.getElementById('memory-toggle').classList.toggle('active',S.memoryEnabled);saveSettings();});
document.getElementById('settings-default-model').addEventListener('change',function(){S.currentModel=this.value;updateModelDisplay();buildModelDropdown();saveSettings();});
document.getElementById('settings-temperature').addEventListener('input',function(){S.temperature=this.value/100;document.getElementById('temperature-value').textContent=S.temperature.toFixed(1);saveSettings();});
document.getElementById('speak-speed').addEventListener('input',function(){S.speakSpeed=this.value/100;document.getElementById('speed-value').textContent=S.speakSpeed.toFixed(1)+'x';saveSettings();});
document.getElementById('settings-system-prompt').addEventListener('change',function(){S.systemPrompt=this.value;saveSettings();});
document.getElementById('settings-custom-instructions').addEventListener('change',function(){S.customInstructions=this.value;saveSettings();});
document.getElementById('export-btn').addEventListener('click',exportConversations);
document.getElementById('clear-btn').addEventListener('click',clearAllHistory);

function exportConversations(){const d=JSON.stringify(S.conversations,null,2);const b=new Blob([d],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=`ai-studio-export-${new Date().toISOString().slice(0,10)}.json`;a.click();toast('Conversations exported');}
function clearAllHistory(){if(!confirm('Delete all conversations? This cannot be undone.')) return;S.conversations={};S.activeConvId=null;S.chatMessages=[];saveConvs();renderSidebar();renderChatMessages();toast('All history cleared');}

function applySettingsUI(){
  document.getElementById('settings-temperature').value=S.temperature*100;
  document.getElementById('temperature-value').textContent=S.temperature.toFixed(1);
  document.getElementById('settings-system-prompt').value=S.systemPrompt||'';
  document.getElementById('settings-custom-instructions').value=S.customInstructions||'';
  document.getElementById('speak-speed').value=S.speakSpeed*100;
  document.getElementById('speed-value').textContent=S.speakSpeed.toFixed(1)+'x';
  document.getElementById('speak-toggle').classList.toggle('active',S.speakResponses);
  document.getElementById('memory-toggle').classList.toggle('active',S.memoryEnabled);
  document.querySelectorAll('.size-option').forEach(b=>b.classList.toggle('active',b.dataset.size===S.fontSize));
}

// ── 16. TOASTS ──
function toast(msg,type='success'){const c=document.getElementById('toast-container');const el=document.createElement('div');el.className=`toast ${type}`;el.textContent=msg;c.appendChild(el);setTimeout(()=>el.remove(),3200);}

// ── 17. HELPERS ──
function autoResize(el){el.style.height='auto';el.style.height=Math.min(el.scrollHeight,160)+'px';}
document.querySelectorAll('textarea').forEach(ta=>ta.addEventListener('input',()=>autoResize(ta)));
document.querySelectorAll('.tip').forEach(tip=>{
  tip.addEventListener('click',()=>{
    const prompt=tip.dataset.prompt; const targetId=tip.dataset.target||'chatInput';
    const input=document.getElementById(targetId);
    if(input){input.value=prompt;input.focus();autoResize(input);}
    if(targetId==='chatInput') activateTab('chat');
    if(targetId==='codeInput') { activateTab('code'); document.getElementById('ide-ai-input').value=prompt; ideAiSend(); }
  });
});
function copyCodeBlock(btn){const code=btn.closest('pre').querySelector('code');navigator.clipboard.writeText(code.textContent);toast('Code copied');}
function escHtml(s){const d=document.createElement('div');d.textContent=s;return d.innerHTML;}
function relativeTime(ts){const d=(Date.now()-ts)/1000;if(d<60) return 'just now';if(d<3600) return Math.floor(d/60)+'m ago';if(d<86400) return Math.floor(d/3600)+'h ago';return Math.floor(d/86400)+'d ago';}

// ── 18. CONTEXT USAGE INDICATOR (removed) ──
function updateCtxIndicator() { /* token counter removed */ }

// ── 19. CANVAS / ARTIFACT PANEL ──
function openCanvas(btn) {
  const pre = btn.closest('pre');
  if (!pre) return;
  const code = pre.querySelector('code');
  if (!code) return;
  const langMatch = code.className.match(/language-(\w+)/);
  const lang = langMatch ? langMatch[1] : 'code';
  const content = code.textContent;

  document.getElementById('canvas-title').textContent = lang + ' · Artifact';
  const body = document.getElementById('canvas-body');
  body.innerHTML = '';
  const pre2 = document.createElement('pre');
  const code2 = document.createElement('code');
  code2.className = code.className; code2.textContent = content;
  pre2.appendChild(code2); body.appendChild(pre2);
  try { hljs.highlightElement(code2); } catch(e){}

  const runBtn = document.getElementById('canvas-run-btn');
  const canRun = ['javascript','js','html','python','py'].includes(lang.toLowerCase());
  runBtn.style.display = canRun ? '' : 'none';
  if (canRun) {
    runBtn.onclick = () => runCanvasCode(content, lang);
  }

  document.getElementById('canvas-run-output').style.display='none';
  document.getElementById('canvas-panel').classList.add('open');
  document.getElementById('canvas-overlay').classList.add('open');
}

document.getElementById('canvas-close-btn').addEventListener('click', closeCanvas);
document.getElementById('canvas-overlay').addEventListener('click', closeCanvas);
document.getElementById('canvas-copy-btn').addEventListener('click', () => {
  const body = document.getElementById('canvas-body');
  const code = body.querySelector('code');
  navigator.clipboard.writeText(code ? code.textContent : body.innerText);
  toast('Copied to clipboard');
});
document.getElementById('canvas-clear-output').addEventListener('click', () => {
  document.getElementById('canvas-output-pre').textContent='';
  document.getElementById('canvas-run-output').style.display='none';
});
function closeCanvas(){document.getElementById('canvas-panel').classList.remove('open');document.getElementById('canvas-overlay').classList.remove('open');}

function runCanvasCode(code, lang) {
  const outDiv = document.getElementById('canvas-run-output');
  const outPre = document.getElementById('canvas-output-pre');
  outDiv.style.display='';
  outPre.textContent = '';

  const log = (...args) => { outPre.textContent += args.map(a=>typeof a==='object'?JSON.stringify(a,null,2):String(a)).join(' ')+'\n'; };

  if (['javascript','js'].includes(lang.toLowerCase())) {
    try {
      const iframe = document.createElement('iframe');
      iframe.style.cssText='display:none';
      document.body.appendChild(iframe);
      const win = iframe.contentWindow;
      win.console = { log, warn: log, error: log, info: log };
      win.eval(code);
      iframe.remove();
      if (!outPre.textContent) outPre.textContent='(no output)';
    } catch(err) { outPre.textContent = 'Error: '+err.message; }
  } else if (lang.toLowerCase() === 'html') {
    outPre.style.display='none';
    let iframeOut = outDiv.querySelector('.canvas-html-preview');
    if (!iframeOut) { iframeOut=document.createElement('iframe'); iframeOut.className='canvas-html-preview'; outDiv.appendChild(iframeOut); }
    iframeOut.style.display='';
    iframeOut.srcdoc=code;
  } else if (['python','py'].includes(lang.toLowerCase())) {
    outPre.textContent='Python execution requires Pyodide.\nLoading… (this may take a moment on first use)';
    loadPyodide(code, outPre);
  }
}

let _pyodide=null, _pyodideLoading=false, _pyodideQueue=[];
async function loadPyodide(code, outPre) {
  if (_pyodide) { runPython(code, outPre); return; }
  _pyodideQueue.push({code,outPre});
  if (_pyodideLoading) return;
  _pyodideLoading=true;
  const script=document.createElement('script');
  script.src='https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js';
  script.onload=async()=>{
    try {
      _pyodide=await window.loadPyodide({ indexURL:'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/' });
      _pyodideLoading=false;
      _pyodideQueue.forEach(({code:c,outPre:op})=>runPython(c,op));
      _pyodideQueue=[];
    } catch(e){outPre.textContent='Failed to load Pyodide: '+e.message;}
  };
  document.head.appendChild(script);
}
function runPython(code, outPre) {
  outPre.textContent='';
  try {
    _pyodide.runPython(`import sys, io; _buf=io.StringIO(); sys.stdout=_buf; sys.stderr=_buf`);
    _pyodide.runPython(code);
    const out=_pyodide.runPython(`_buf.getvalue()`);
    outPre.textContent=out||'(no output)';
  } catch(e){outPre.textContent='Error: '+e.message;}
}

// ── 20. KEYBOARD SHORTCUTS ──
document.getElementById('shortcuts-btn').addEventListener('click', openShortcuts);
document.getElementById('shortcuts-close').addEventListener('click', closeShortcuts);
document.getElementById('shortcuts-overlay').addEventListener('click', e=>{ if(e.target===e.currentTarget) closeShortcuts(); });
function openShortcuts(){document.getElementById('shortcuts-overlay').style.display='flex';}
function closeShortcuts(){document.getElementById('shortcuts-overlay').style.display='none';}

document.addEventListener('keydown', e => {
  // Don't trigger inside inputs/textareas
  const tag = document.activeElement?.tagName;
  const inInput = tag==='INPUT'||tag==='TEXTAREA';

  if (!inInput && e.key==='?') { e.preventDefault(); openShortcuts(); return; }
  if (e.key==='Escape') {
    if (S.busy) stopGeneration();
    closeCanvas();
    closeShortcuts();
    document.getElementById('live-voice-overlay').style.display='none';
    document.getElementById('share-modal-overlay').classList.remove('open');
    return;
  }
  if (!e.ctrlKey && !e.metaKey) return;
  if (e.key==='k') { e.preventDefault(); newChat(); }
  else if (e.key==='/') { e.preventDefault(); toggleSidebar(); }
  else if (e.key==='.') { e.preventDefault(); openSettings(); }
  else if (e.key==='1') { e.preventDefault(); activateTab('chat'); }
  else if (e.key==='2') { e.preventDefault(); activateTab('code'); }
  else if (e.key==='3') { e.preventDefault(); activateTab('image'); }
  else if (e.key==='4') { e.preventDefault(); activateTab('voice'); }
});

// ══════════════════════════════════════════════
// ── 21. MESSAGE ACTION BAR (global popup arch) ──
// ══════════════════════════════════════════════
const _pickerEl = document.createElement('div');
_pickerEl.className = 'rewrite-picker';
_pickerEl.innerHTML = `<div class="rewrite-picker-search"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><input id="_pickerInput" type="text" placeholder="Search models…" autocomplete="off"/></div><div id="_pickerList" class="rewrite-picker-list"></div>`;
document.body.appendChild(_pickerEl);

const _menuEl = document.createElement('div');
_menuEl.className = 'msg-menu-dropdown';
document.body.appendChild(_menuEl);

document.addEventListener('click', () => closeAllPopups());
document.addEventListener('keydown', e => { if(e.key==='Escape') closeAllPopups(); });
document.getElementById('chatMessages')?.addEventListener('scroll', closeAllPopups);

function closeAllPopups(){
  _pickerEl.classList.remove('open'); _menuEl.classList.remove('open');
  document.querySelectorAll('.msg-action-btn.active,.msg-menu-btn.active').forEach(b=>b.classList.remove('active'));
}

function positionPopup(popup, anchor) {
  popup.style.visibility='hidden'; popup.style.display='block';
  const pw=popup.offsetWidth, ph=popup.offsetHeight;
  popup.style.display=''; popup.style.visibility='';
  const r=anchor.getBoundingClientRect(), vw=window.innerWidth, vh=window.innerHeight;
  let top = (r.top-ph-8>=0) ? r.top-ph-8 : (r.bottom+ph+8<=vh) ? r.bottom+8 : Math.max(8,r.top-ph-8);
  let left = r.right-pw; if(left<8) left=8; if(left+pw>vw-8) left=vw-pw-8;
  popup.style.top=top+'px'; popup.style.left=left+'px';
}

function buildMsgActions(wrap, body, msg) {
  wrap.querySelectorAll('.msg-actions:not(.user-actions)').forEach(el=>el.remove());
  const actions = document.createElement('div'); actions.className='msg-actions';

  actions.appendChild(makeActionBtn('Copy', e=>{e.stopPropagation();navigator.clipboard.writeText(body.innerText||body.textContent);toast('Copied');}));
  actions.appendChild(makeActionBtn('↺ Rewrite', e=>{e.stopPropagation();rewriteWithModel(wrap,body,msg,msg.model||S.currentModel);}));
  actions.appendChild(makeSep());

  const altBtn = makeActionBtn('⊕ Other model ▾', e=>{
    e.stopPropagation();
    const alreadyOpen=_pickerEl.classList.contains('open')&&_pickerEl._anchor===altBtn;
    closeAllPopups();
    if(!alreadyOpen){
      _pickerEl._anchor=altBtn; _pickerEl._onSelect=id=>{closeAllPopups();rewriteWithModel(wrap,body,msg,id);};
      populatePicker(''); positionPopup(_pickerEl,altBtn); _pickerEl.classList.add('open'); altBtn.classList.add('active');
      const inp=document.getElementById('_pickerInput'); if(inp){inp.value='';setTimeout(()=>inp.focus(),30);}
    }
  });
  actions.appendChild(altBtn);
  actions.appendChild(makeSep());

  const menuBtn = document.createElement('button'); menuBtn.className='msg-menu-btn'; menuBtn.title='More options';
  menuBtn.innerHTML=`<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>`;
  menuBtn.addEventListener('click', e=>{
    e.stopPropagation();
    const alreadyOpen=_menuEl.classList.contains('open')&&_menuEl._anchor===menuBtn;
    closeAllPopups();
    if(!alreadyOpen){ _menuEl._anchor=menuBtn; buildMenuItems(body,msg); positionPopup(_menuEl,menuBtn); _menuEl.classList.add('open'); menuBtn.classList.add('active'); }
  });
  actions.appendChild(menuBtn);
  wrap.appendChild(actions);
}

function makeActionBtn(label, onClick){const btn=document.createElement('button');btn.className='msg-action-btn';btn.textContent=label;btn.addEventListener('click',onClick);return btn;}
function makeSep(){const s=document.createElement('div');s.className='msg-action-sep';return s;}

function populatePicker(q){
  const list=document.getElementById('_pickerList'); if(!list) return; list.innerHTML='';
  const filter=q.toLowerCase().trim(); let count=0;
  for(const g of MODELS){
    const matched=filter?g.models.filter(m=>m.name.toLowerCase().includes(filter)||m.id.toLowerCase().includes(filter)||g.provider.toLowerCase().includes(filter)):g.models;
    if(!matched.length) continue;
    const lbl=document.createElement('div');lbl.className='model-group-label';lbl.textContent=g.provider;list.appendChild(lbl);
    for(const m of matched){
      const opt=document.createElement('div');opt.className='model-option';const _tc=m.tag==='FREE'?'model-option-tag free-tag':'model-option-tag';opt.innerHTML=`<span class="model-dot" style="background:${g.color||'#888'}"></span><span class="model-option-name">${m.name}</span>${m.tag?`<span class="${_tc}">${m.tag}</span>`:''}`;

      opt.addEventListener('click',e=>{e.stopPropagation();if(_pickerEl._onSelect)_pickerEl._onSelect(m.id);});
      list.appendChild(opt); count++;
    }
  }
  if(!count) list.innerHTML=`<div class="model-no-results">No models match</div>`;
}

document.getElementById('_pickerInput')?.addEventListener('input',function(){populatePicker(this.value);});
document.getElementById('_pickerInput')?.addEventListener('click',e=>e.stopPropagation());
_pickerEl.addEventListener('click',e=>e.stopPropagation());
_menuEl.addEventListener('click',e=>e.stopPropagation());

function buildMenuItems(body, msg){
  _menuEl.innerHTML='';
  const items=[
    {icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',label:'Write Code',fn(){closeAllPopups();activateTab('code');const snippet=(body.innerText||'').slice(0,800);document.getElementById('ide-ai-input').value='Write code based on:\n\n'+snippet;ideAiSend();}},
    {icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',label:'Generate Image',fn(){closeAllPopups();activateTab('image');document.getElementById('imagePrompt').value=(body.innerText||'').replace(/\n+/g,' ').trim().slice(0,200);toast('Prompt set in Image tab');}},
    {icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg>',label:'Generate Voice',fn(){closeAllPopups();activateTab('voice');const ta=document.getElementById('voiceText');ta.value=(body.innerText||'').slice(0,3000);ta.dispatchEvent(new Event('input'));ta.focus();toast('Text set in Voice tab');}},
    {sep:true},
    {icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>',label:'Share Chat',fn(){closeAllPopups();openShareModal(msg);}},
  ];
  for(const item of items){
    if(item.sep){const s=document.createElement('div');s.className='msg-menu-sep';_menuEl.appendChild(s);continue;}
    const el=document.createElement('div');el.className='msg-menu-item';el.innerHTML=item.icon+`<span>${item.label}</span>`;
    el.addEventListener('click',e=>{e.stopPropagation();item.fn();});_menuEl.appendChild(el);
  }
}

async function rewriteWithModel(wrap, body, msg, modelId) {
  if(S.busy){toast('Please wait for the current response to finish','error');return;}
  closeAllPopups(); S.abortStream=false;
  const allMsgs=S.chatMessages;
  const msgIdx=allMsgs.findIndex(m=>m===msg||(m.role==='assistant'&&m.content===msg.content));
  const userMsg=msgIdx>0?allMsgs[msgIdx-1]:allMsgs.filter(m=>m.role==='user').slice(-1)[0];
  if(!userMsg){toast('Could not find original prompt','error');return;}
  const info=getModelInfo(modelId); setBusy(true,'chat');
  body.classList.add('md','streaming-cursor'); body.innerHTML='<em style="color:var(--muted);font-size:12px">Rewriting…</em>';
  const metaEl=wrap.querySelector('.msg-meta'); if(metaEl){metaEl.textContent=info.name;metaEl.style.setProperty('--meta-dot-color',info.color);}
  wrap.querySelectorAll('.msg-actions:not(.user-actions)').forEach(el=>el.remove());
  let messages=[]; if(S.systemPrompt) messages.push({role:'system',content:S.systemPrompt});
  const hist=S.memoryEnabled?allMsgs.slice(0,msgIdx>0?msgIdx:allMsgs.length).filter(m=>m.role==='user'||m.role==='assistant').slice(-20):[{role:'user',content:userMsg.content}];
  messages=messages.concat(hist.map(m=>({role:m.role,content:m.content})));
  let full='';
  try {
    const resp=await puter.ai.chat(messages,{model:modelId,stream:true,temperature:S.temperature});
    body.innerHTML='';
    if(resp&&typeof resp[Symbol.asyncIterator]==='function'){
      for await(const part of resp){if(S.abortStream) break;const t=part?.text||part?.message?.content||'';if(t){full+=t;body.innerHTML=renderMarkdown(full);const a=document.getElementById('chatMessages');a.scrollTop=a.scrollHeight;}}
    }else if(resp?.message?.content){full=resp.message.content;body.innerHTML=renderMarkdown(full);}
    body.classList.remove('streaming-cursor');body.querySelectorAll('pre code').forEach(b=>{try{hljs.highlightElement(b);}catch(e){}});renderMermaidBlocks(body);
    if(msgIdx>=0&&allMsgs[msgIdx]){allMsgs[msgIdx].content=full;allMsgs[msgIdx].model=modelId;}
    const updatedMsg=allMsgs[msgIdx]||{...msg,content:full,model:modelId};
    buildMsgActions(wrap,body,updatedMsg);persistConversation('',full);toast('Rewritten with '+info.name);
  }catch(err){
    body.classList.remove('streaming-cursor');body.innerHTML=renderMarkdown(msg.content||'');buildMsgActions(wrap,body,msg);toast('Rewrite failed: '+(err.message||''),'error');
  }
  setBusy(false,'chat'); S.abortStream=false;
}

// ── Share Modal ──
function openShareModal(msg){
  const conv=S.activeConvId?S.conversations[S.activeConvId]:null;
  const messages=conv?conv.messages:S.chatMessages;
  let transcript='AI Studio — Chat Export\n'+'─'.repeat(40)+'\n\n';
  for(const m of messages){if(m.role==='system') continue;const label=m.role==='user'?'You':getModelInfo(m.model||S.currentModel).name;transcript+='['+label+']\n'+(m.content||'')+'\n\n';}
  transcript=transcript.trim();
  document.getElementById('share-preview').textContent=transcript;
  document.getElementById('share-modal-overlay').classList.add('open');
  document.getElementById('share-copy-btn').onclick=()=>{navigator.clipboard.writeText(transcript);toast('Chat copied to clipboard');document.getElementById('share-modal-overlay').classList.remove('open');};
  document.getElementById('share-download-btn').onclick=()=>{const b=new Blob([transcript],{type:'text/plain'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='chat-'+new Date().toISOString().slice(0,10)+'.txt';a.click();toast('Chat downloaded');document.getElementById('share-modal-overlay').classList.remove('open');};
}
document.getElementById('share-modal-close').addEventListener('click',()=>document.getElementById('share-modal-overlay').classList.remove('open'));
document.getElementById('share-modal-overlay').addEventListener('click',e=>{if(e.target===e.currentTarget) e.currentTarget.classList.remove('open');});

// ══════════════════════════════════════════════
//  INTERACTIVE ENHANCEMENTS
// ══════════════════════════════════════════════

// ── Particle System for Login Screen ──
(function initLoginParticles() {
  const canvas = document.getElementById('login-particles');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H, particles = [], animFrame;

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function mkParticle() {
    return {
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.4 + 0.4,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      o: Math.random() * 0.4 + 0.1,
      life: 0,
      maxLife: Math.random() * 300 + 200,
    };
  }

  function init() {
    resize();
    particles = [];
    for (let i = 0; i < 80; i++) particles.push(mkParticle());
  }

  function drawConnections() {
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const d = Math.sqrt(dx*dx + dy*dy);
        if (d < 120) {
          const alpha = (1 - d/120) * 0.12;
          ctx.beginPath();
          ctx.strokeStyle = `rgba(212,168,83,${alpha})`;
          ctx.lineWidth = 0.5;
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.stroke();
        }
      }
    }
  }

  function tick() {
    ctx.clearRect(0, 0, W, H);
    drawConnections();
    particles.forEach((p, idx) => {
      p.x += p.vx; p.y += p.vy; p.life++;
      // Wrap around
      if (p.x < -10) p.x = W + 10;
      if (p.x > W + 10) p.x = -10;
      if (p.y < -10) p.y = H + 10;
      if (p.y > H + 10) p.y = -10;
      // Fade in/out
      const fade = p.life < 60 ? p.life / 60 : p.life > p.maxLife - 60 ? (p.maxLife - p.life) / 60 : 1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(212,168,83,${p.o * fade})`;
      ctx.fill();
      if (p.life >= p.maxLife) particles[idx] = mkParticle();
    });
    animFrame = requestAnimationFrame(tick);
  }

  init();
  tick();
  window.addEventListener('resize', () => { cancelAnimationFrame(animFrame); init(); tick(); });

  // Stop when login screen hides
  const obs = new MutationObserver(() => {
    const ls = document.getElementById('login-screen');
    if (ls && ls.style.display === 'none') {
      cancelAnimationFrame(animFrame);
      obs.disconnect();
    }
  });
  const ls = document.getElementById('login-screen');
  if (ls) obs.observe(ls, { attributes: true, attributeFilter: ['style'] });
})();


// ── Ripple effect on buttons ──
(function addRipples() {
  const TARGETS = '.send-btn, .gen-btn, .speak-btn, .login-btn, .new-chat-btn, .tab-btn';
  document.addEventListener('click', function(e) {
    const btn = e.target.closest(TARGETS);
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    const rip = document.createElement('span');
    rip.className = '__ripple';
    rip.style.cssText = `position:absolute;border-radius:50%;background:rgba(255,255,255,.18);pointer-events:none;width:4px;height:4px;left:${x}px;top:${y}px;transform:scale(0);animation:__ripple-anim .55s ease-out forwards;`;
    if (getComputedStyle(btn).position === 'static') btn.style.position = 'relative';
    btn.style.overflow = 'hidden';
    btn.appendChild(rip);
    rip.addEventListener('animationend', () => rip.remove());
  });
  if (!document.getElementById('__ripple-style')) {
    const st = document.createElement('style');
    st.id = '__ripple-style';
    st.textContent = '@keyframes __ripple-anim{to{transform:scale(60);opacity:0;}}';
    document.head.appendChild(st);
  }
})();


// ── Smooth scroll-to-bottom with a glow flash on new AI message ──
const _origAddThinking = addThinkingEl;
function addThinkingEl(container, modelId) {
  const el = _origAddThinking(container, modelId);
  // subtle ambient flash when thinking starts
  container.style.transition = 'box-shadow .3s';
  container.style.boxShadow = 'inset 0 0 24px rgba(212,168,83,.04)';
  setTimeout(() => { container.style.boxShadow = ''; }, 600);
  return el;
}


// ── Typing placeholder cycle on chat input ──
(function cyclePlaceholders() {
  const ta = document.getElementById('chatInput');
  if (!ta) return;
  const phrases = [
    'Ask anything…',
    'Summarize a document…',
    'Write code for me…',
    'Explain a concept…',
    'Generate ideas…',
    'Debug this error…',
  ];
  let idx = 0;
  setInterval(() => {
    if (document.activeElement === ta) return;
    idx = (idx + 1) % phrases.length;
    ta.placeholder = phrases[idx];
  }, 3500);
})();


// ── Cursor glow that follows mouse on the main app ──
(function cursorGlow() {
  const glow = document.createElement('div');
  glow.id = '__cursor-glow';
  glow.style.cssText = `
    position:fixed; pointer-events:none; z-index:9999;
    width:240px; height:240px; border-radius:50%;
    background:radial-gradient(circle, rgba(212,168,83,.045) 0%, transparent 70%);
    transform:translate(-50%,-50%);
    transition:opacity .4s ease;
    opacity:0;
  `;
  document.body.appendChild(glow);
  let visible = false;
  document.addEventListener('mousemove', e => {
    glow.style.left = e.clientX + 'px';
    glow.style.top  = e.clientY + 'px';
    if (!visible) { glow.style.opacity = '1'; visible = true; }
  });
  document.addEventListener('mouseleave', () => { glow.style.opacity = '0'; visible = false; });
})();


// ── Intersection-based fade-in for tip cards ──
(function observeTips() {
  if (!window.IntersectionObserver) return;
  const obs = new IntersectionObserver(entries => {
    entries.forEach((en, i) => {
      if (en.isIntersecting) {
        setTimeout(() => {
          en.target.style.opacity = '1';
          en.target.style.transform = 'translateY(0)';
        }, i * 60);
        obs.unobserve(en.target);
      }
    });
  }, { threshold: 0.1 });
  // Observe existing tips + future ones via a MutationObserver
  function observeAllTips() {
    document.querySelectorAll('.tip:not([data-observed])').forEach(tip => {
      tip.dataset.observed = '1';
      tip.style.cssText += 'opacity:0;transform:translateY(14px);transition:opacity .35s ease,transform .35s ease,border-color .2s,background .2s,box-shadow .2s;';
      obs.observe(tip);
    });
  }
  observeAllTips();
  const mo = new MutationObserver(observeAllTips);
  mo.observe(document.body, { childList: true, subtree: true });
})();


// ══════════════════════════════════════════════
//  PROJECT IDE — CodeMirror-based
// ══════════════════════════════════════════════

const IDE = {
  files: {},        // { [id]: { id, name, content, language, saved } }
  activeFile: null,
  cm: null,         // CodeMirror instance
  aiMessages: [],
  aiOpen: true,
  ideBusy: false,
  abortIde: false,
  currentOutTab: 'preview',
};

const LANG_MAP = {
  js:'javascript', jsx:'javascript', mjs:'javascript',
  ts:'javascript', tsx:'javascript',
  py:'python', html:'htmlmixed', htm:'htmlmixed',
  css:'css', scss:'css', less:'css',
  json:'javascript', md:'markdown',
  sh:'shell', bash:'shell', zsh:'shell',
  c:'clike', cpp:'clike', h:'clike', java:'clike', cs:'clike',
};

const FILE_ICONS = {
  js:'🟨', jsx:'⚛', ts:'🔷', tsx:'⚛',
  py:'🐍', rb:'💎', php:'🐘', java:'☕',
  html:'🌐', htm:'🌐', css:'🎨', scss:'🎨',
  json:'📋', md:'📝', xml:'📄', yaml:'⚙', yml:'⚙',
  sh:'💻', sql:'🗃', svg:'🖼',
};
function getFileIcon(name) { return FILE_ICONS[name.split('.').pop().toLowerCase()] || '📄'; }
function getLang(name) { return LANG_MAP[name.split('.').pop().toLowerCase()] || 'null'; }

// ── CodeMirror Init ──
function initCM(content = '', lang = 'null') {
  const ta = document.getElementById('ide-editor-ta');
  if (IDE.cm) {
    IDE.cm.setValue(content);
    IDE.cm.setOption('mode', lang);
    setTimeout(() => IDE.cm.refresh(), 10);
    return;
  }
  IDE.cm = CodeMirror.fromTextArea(ta, {
    value: content,
    mode: lang,
    theme: 'aistudio',
    lineNumbers: true,
    autoCloseBrackets: true,
    matchBrackets: true,
    lineWrapping: true,
    indentUnit: 2,
    tabSize: 2,
    indentWithTabs: false,
    extraKeys: {
      'Ctrl-S': () => ideSaveFile(),
      'Cmd-S':  () => ideSaveFile(),
      'Ctrl-/': 'toggleComment',
      'Cmd-/':  'toggleComment',
      'Tab': cm => cm.execCommand('insertSoftTab'),
    },
  });
  IDE.cm.setValue(content);
  IDE.cm.on('change', () => {
    if (IDE.activeFile && IDE.files[IDE.activeFile]) {
      IDE.files[IDE.activeFile].saved = false;
      renderFileTabs();
      renderFileTree();
    }
  });
}

// ── File management ──
function ideNewFile(suggestedName) {
  const name = suggestedName || prompt('File name (e.g. index.html, app.py):', 'index.html');
  if (!name || !name.trim()) return;
  const id = crypto.randomUUID();
  IDE.files[id] = { id, name: name.trim(), content: '', language: getLang(name), saved: true };
  renderFileTree();
  openFile(id);
  toast('Created ' + name.trim());
}

function ideUploadFile() { document.getElementById('ide-file-input').click(); }

document.getElementById('ide-file-input').addEventListener('change', async function(e) {
  const files = Array.from(e.target.files); e.target.value = '';
  for (const f of files) {
    const content = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsText(f); });
    const id = crypto.randomUUID();
    IDE.files[id] = { id, name: f.name, content, language: getLang(f.name), saved: true };
  }
  renderFileTree();
  const ids = Object.keys(IDE.files);
  if (ids.length && !IDE.activeFile) openFile(ids[0]);
  else if (ids.length) openFile(ids[ids.length - 1]);
  toast(`Uploaded ${files.length} file(s)`);
});

function ideDeleteFile(id, e) {
  e && e.stopPropagation();
  const f = IDE.files[id]; if (!f) return;
  if (!confirm('Delete ' + f.name + '?')) return;
  delete IDE.files[id];
  if (IDE.activeFile === id) {
    IDE.activeFile = null;
    const remaining = Object.keys(IDE.files);
    if (remaining.length) openFile(remaining[remaining.length - 1]);
    else showWelcome();
  }
  renderFileTree(); renderFileTabs();
  toast('Deleted ' + f.name);
}

function ideSaveFile() {
  if (!IDE.cm || !IDE.activeFile) return;
  const f = IDE.files[IDE.activeFile]; if (!f) return;
  f.content = IDE.cm.getValue();
  f.saved = true;
  renderFileTabs(); renderFileTree();
  toast('Saved ' + f.name);
}

function ideDownloadFile() {
  if (!IDE.activeFile) { toast('No file open', 'error'); return; }
  ideSaveFile();
  const f = IDE.files[IDE.activeFile];
  const blob = new Blob([f.content], { type: 'text/plain' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = f.name; a.click();
  toast('Downloaded ' + f.name);
}

async function ideDownloadZip() {
  const ids = Object.keys(IDE.files);
  if (!ids.length) { toast('No files to download', 'error'); return; }
  ideSaveFile();
  if (!window.JSZip) { toast('Loading ZIP library…'); }
  const zip = new JSZip();
  for (const id of ids) { const f = IDE.files[id]; zip.file(f.name, f.content); }
  const blob = await zip.generateAsync({ type: 'blob' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = (document.getElementById('ide-project-name')?.textContent?.trim() || 'project') + '.zip';
  a.click();
  toast('Downloaded project ZIP');
}

function openFile(id) {
  IDE.activeFile = id;
  const f = IDE.files[id]; if (!f) return;
  document.getElementById('ide-welcome').style.display = 'none';
  document.getElementById('ide-monaco').style.display = '';
  renderFileTree(); renderFileTabs();
  initCM(f.content, f.language);
}

function showWelcome() {
  document.getElementById('ide-monaco').style.display = 'none';
  document.getElementById('ide-welcome').style.display = '';
  IDE.activeFile = null;
  renderFileTabs(); renderFileTree();
}

function renderFileTree() {
  const list = document.getElementById('ide-file-list');
  const empty = document.getElementById('ide-empty-tree');
  const ids = Object.keys(IDE.files);
  if (!ids.length) { empty.style.display = ''; return; }
  empty.style.display = 'none';
  Array.from(list.children).forEach(c => { if (c.id !== 'ide-empty-tree') c.remove(); });
  ids.forEach(id => {
    const f = IDE.files[id];
    const el = document.createElement('div');
    el.className = 'ide-file-item' + (id === IDE.activeFile ? ' active' : '');
    el.innerHTML = `<span class="ide-file-icon">${getFileIcon(f.name)}</span>
      <span class="ide-file-name">${escHtml(f.name)}</span>
      ${!f.saved ? '<span class="ide-file-modified" title="Unsaved">●</span>' : ''}
      <button class="ide-file-del" title="Delete file">✕</button>`;
    el.addEventListener('click', (e) => { if (!e.target.classList.contains('ide-file-del')) openFile(id); });
    el.querySelector('.ide-file-del').addEventListener('click', (e) => ideDeleteFile(id, e));
    list.appendChild(el);
  });
}

function renderFileTabs() {
  const list = document.getElementById('ide-tabs-list');
  list.innerHTML = '';
  Object.values(IDE.files).forEach(f => {
    const tab = document.createElement('button');
    tab.className = 'ide-tab' + (f.id === IDE.activeFile ? ' active' : '');
    tab.innerHTML = `<span>${getFileIcon(f.name)}</span>
      <span class="ide-tab-name">${escHtml(f.name)}</span>
      ${!f.saved ? '<span class="ide-tab-dot" title="Unsaved">●</span>' : ''}
      <button class="ide-tab-close" data-id="${f.id}">×</button>`;
    tab.addEventListener('click', (e) => { if (!e.target.classList.contains('ide-tab-close')) openFile(f.id); });
    tab.querySelector('.ide-tab-close').addEventListener('click', (e) => {
      e.stopPropagation();
      // Auto-save then close
      if (IDE.activeFile === f.id && IDE.cm) { f.content = IDE.cm.getValue(); f.saved = true; }
      delete IDE.files[f.id];
      if (IDE.activeFile === f.id) {
        const remaining = Object.keys(IDE.files);
        if (remaining.length) openFile(remaining[remaining.length - 1]);
        else showWelcome();
      } else { renderFileTabs(); renderFileTree(); }
    });
    list.appendChild(tab);
  });
}

// ── Templates ──
const TEMPLATES = {
  html: [
    { name: 'index.html', content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Project</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <header>
    <h1>Hello World 🌐</h1>
  </header>
  <main>
    <p>Build something amazing.</p>
    <button id="btn">Click me</button>
  </main>
  <script src="app.js"><\/script>
</body>
</html>` },
    { name: 'style.css', content: `* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: system-ui, sans-serif; padding: 2rem; background: #0f1117; color: #e8e2d9; min-height: 100vh; }
header { margin-bottom: 2rem; }
h1 { font-size: 2rem; color: #d4a853; }
p { color: #aaa; margin-bottom: 1rem; }
button { padding: 10px 20px; background: #d4a853; border: none; border-radius: 8px; color: #0f1117; font-weight: 600; cursor: pointer; transition: all .2s; }
button:hover { background: #e0b96a; transform: translateY(-2px); }` },
    { name: 'app.js', content: `const btn = document.getElementById('btn');
let count = 0;

btn.addEventListener('click', () => {
  count++;
  btn.textContent = \`Clicked \${count} time\${count !== 1 ? 's' : ''}!\`;
  console.log('Button clicked:', count);
});

console.log('App loaded!');` },
  ],
  react: [
    { name: 'App.jsx', content: `import { useState } from 'react';
import './App.css';

export default function App() {
  const [count, setCount] = useState(0);
  const [items, setItems] = useState(['React', 'Vite', 'AI Studio']);

  return (
    <div className="app">
      <h1>⚛ React App</h1>
      <div className="card">
        <button onClick={() => setCount(c => c + 1)}>
          Count is {count}
        </button>
        <ul>
          {items.map((item, i) => <li key={i}>{item}</li>)}
        </ul>
      </div>
    </div>
  );
}` },
    { name: 'App.css', content: `.app { font-family: system-ui, sans-serif; max-width: 640px; margin: 0 auto; padding: 2rem; background: #0f1117; color: #e8e2d9; min-height: 100vh; }
h1 { font-size: 2rem; color: #d4a853; margin-bottom: 1.5rem; }
.card { background: #1a1c1e; border: 1px solid #2a2c2e; border-radius: 12px; padding: 1.5rem; }
button { padding: 10px 24px; background: #d4a853; border: none; border-radius: 8px; color: #0f1117; font-weight: 600; cursor: pointer; margin-bottom: 1rem; }
button:hover { background: #e0b96a; }
ul { list-style: none; padding: 0; }
li { padding: 8px 0; border-bottom: 1px solid #2a2c2e; color: #aaa; }` },
    { name: 'package.json', content: `{
  "name": "react-app",
  "version": "1.0.0",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "vite": "^5.0.0",
    "@vitejs/plugin-react": "^4.0.0"
  }
}` },
    { name: 'vite.config.js', content: `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({ plugins: [react()] });` },
    { name: '.gitignore', content: `node_modules/\ndist/\n.env\n.DS_Store` },
  ],
  node: [
    { name: 'server.js', content: `const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Hello from Node.js!', timestamp: new Date().toISOString() });
});

app.get('/api/data', (req, res) => {
  res.json({ items: ['item1', 'item2', 'item3'] });
});

app.post('/api/data', (req, res) => {
  const { name } = req.body;
  res.status(201).json({ created: name, id: Date.now() });
});

app.listen(PORT, () => {
  console.log(\`✅ Server running at http://localhost:\${PORT}\`);
});` },
    { name: 'package.json', content: `{
  "name": "node-server",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "express": "^4.18.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.0"
  }
}` },
    { name: '.env', content: `PORT=3000\n# Add your environment variables here\n# DATABASE_URL=\n# API_KEY=` },
    { name: '.gitignore', content: `node_modules/\n.env\n*.log\ndist/\n.DS_Store` },
    { name: 'README.md', content: `# Node.js Server\n\n## Setup\n\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n\n## Endpoints\n\n- \`GET /\` — Health check\n- \`GET /api/data\` — Get items\n- \`POST /api/data\` — Create item\n` },
  ],
  python: [
    { name: 'main.py', content: `#!/usr/bin/env python3
"""Main application script."""

from utils import greet, calculate

def main():
    name = input("Enter your name: ")
    print(greet(name))
    
    result = calculate(10, 5)
    print(f"10 + 5 = {result}")

if __name__ == "__main__":
    main()` },
    { name: 'utils.py', content: `"""Utility functions."""

def greet(name: str) -> str:
    """Return a personalized greeting."""
    return f"Hello, {name}! 🐍"

def calculate(a: float, b: float) -> float:
    """Add two numbers."""
    return a + b` },
    { name: 'requirements.txt', content: `# Add your dependencies here
# requests==2.31.0
# flask==3.0.0` },
    { name: '.gitignore', content: `__pycache__/\n*.pyc\n.env\nvenv/\n.venv/\n*.egg-info/\ndist/\n.DS_Store` },
    { name: 'README.md', content: `# Python Project\n\n## Setup\n\n\`\`\`bash\npython -m venv venv\nsource venv/bin/activate  # Windows: venv\\Scripts\\activate\npip install -r requirements.txt\n\`\`\`\n\n## Run\n\n\`\`\`bash\npython main.py\n\`\`\`` },
  ],
};

function ideQuickStart(tpl) {
  const files = TEMPLATES[tpl]; if (!files) return;
  const existing = Object.keys(IDE.files);
  if (existing.length > 0 && !confirm('Load template? This will add files to your project.')) return;
  files.forEach(f => {
    const id = crypto.randomUUID();
    IDE.files[id] = { id, name: f.name, content: f.content, language: getLang(f.name), saved: true };
  });
  renderFileTree();
  openFile(Object.keys(IDE.files)[0]);
  toast('Template loaded — ' + tpl + ' project ready!');
}

// ── Run code ──
function ideRunCode() {
  if (!IDE.activeFile || !IDE.cm) { toast('No file open', 'error'); return; }
  ideSaveFile();
  const f = IDE.files[IDE.activeFile];
  const ext = f.name.split('.').pop().toLowerCase();
  const outDiv = document.getElementById('ide-output');
  const outPre = document.getElementById('ide-output-pre');
  const frame = document.getElementById('ide-html-frame');
  outDiv.style.display = '';
  outPre.style.display = 'none'; frame.style.display = 'none';
  showOutTab(IDE.currentOutTab);
  const code = IDE.cm.getValue();

  if (['html', 'htm'].includes(ext)) {
    showOutTab('preview');
    frame.srcdoc = code;
  } else if (['js', 'mjs'].includes(ext)) {
    showOutTab('console');
    outPre.style.display = ''; outPre.textContent = '';
    const log = (...a) => { outPre.textContent += a.map(x => typeof x === 'object' ? JSON.stringify(x, null, 2) : String(x)).join(' ') + '\n'; };
    try {
      const sandboxFrame = document.createElement('iframe');
      sandboxFrame.style.display = 'none';
      document.body.appendChild(sandboxFrame);
      sandboxFrame.contentWindow.console = { log, warn: log, error: log, info: log, debug: log };
      sandboxFrame.contentWindow.eval(code);
      sandboxFrame.remove();
      if (!outPre.textContent.trim()) outPre.textContent = '(no console output)';
    } catch (err) {
      outPre.textContent = '⚠ Error: ' + err.message;
    }
  } else {
    showOutTab('console');
    outPre.style.display = '';
    outPre.textContent = `Cannot run .${ext} files in browser.\n\n`;
    if (ext === 'py') outPre.textContent += `Run in your terminal:\n  python ${f.name}`;
    else if (['ts', 'tsx'].includes(ext)) outPre.textContent += `Run with ts-node:\n  npx ts-node ${f.name}`;
    else if (['jsx'].includes(ext)) outPre.textContent += `Build and run with Vite:\n  npm run dev`;
    else outPre.textContent += `Run with the appropriate runtime for .${ext} files.`;
  }
}

function showOutTab(tab) {
  IDE.currentOutTab = tab;
  document.querySelectorAll('.ide-out-tab').forEach(t => t.classList.toggle('active', t.dataset.out === tab));
  const frame = document.getElementById('ide-html-frame');
  const pre = document.getElementById('ide-output-pre');
  if (tab === 'preview') { frame.style.display = ''; pre.style.display = 'none'; }
  else { frame.style.display = 'none'; pre.style.display = ''; }
}

// ── AI Assistant ──
document.getElementById('ide-ai-send').addEventListener('click', ideAiSend);
document.getElementById('ide-ai-input').addEventListener('keydown', e => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); ideAiSend(); }
  // Auto-resize
  e.target.style.height = 'auto';
  e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px';
});
document.getElementById('ide-ai-stop').addEventListener('click', () => { IDE.abortIde = true; });
document.querySelectorAll('.ide-ai-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.getElementById('ide-ai-input').value = chip.dataset.p;
    ideAiSend();
  });
});

function getIdeContext() {
  const include = document.getElementById('ide-include-code')?.checked;
  if (!include || !IDE.activeFile || !IDE.cm) return '';
  const f = IDE.files[IDE.activeFile];
  const code = IDE.cm.getValue();
  const allFiles = Object.values(IDE.files).map(fl => fl.name).join(', ');
  return `\n\n[Current project files: ${allFiles}]\n[Active file: ${f.name}]\n\`\`\`${f.language || 'text'}\n${code.slice(0, 8000)}\n\`\`\``;
}

async function ideAiSend() {
  if (IDE.ideBusy) return;
  const input = document.getElementById('ide-ai-input');
  const text = input.value.trim(); if (!text) return;
  input.value = ''; input.style.height = 'auto';

  const msgs = document.getElementById('ide-ai-msgs');
  const welcome = msgs.querySelector('.ide-ai-welcome-msg');
  if (welcome) welcome.style.display = 'none';
  const chipsEl = document.getElementById('ide-ai-msgs')?.querySelector('.ide-ai-chips');
  if (chipsEl) chipsEl.style.display = 'none';

  addIdeMsg('user', text);
  IDE.aiMessages.push({ role: 'user', content: text });

  IDE.ideBusy = true; IDE.abortIde = false;
  document.getElementById('ide-ai-send').style.display = 'none';
  document.getElementById('ide-ai-stop').style.display = '';

  const contextStr = getIdeContext();
  const sysPrompt = [
    'You are an expert full-stack coding assistant embedded in a project IDE.',
    'Help the user write, debug, refactor, and deploy their code.',
    'Always use markdown with fenced code blocks (```language ... ```) for code.',
    'When giving deployment instructions, provide exact terminal commands the user can copy.',
    'Be concise but thorough. When writing complete files, write the full content.',
    'When asked about GitHub or deployment, give step-by-step instructions with exact commands.',
  ].join(' ');

  const chatMessages = [
    { role: 'system', content: sysPrompt },
    ...IDE.aiMessages.slice(-20).map((m, i, arr) => ({
      role: m.role,
      content: m.role === 'user' && i === arr.length - 1 ? m.content + contextStr : m.content
    }))
  ];

  // Thinking dots
  const thinkEl = document.createElement('div');
  thinkEl.className = 'ide-ai-msg assistant';
  thinkEl.innerHTML = '<div style="display:flex;gap:5px;align-items:center;padding:4px 0"><div class="dot"></div><div class="dot" style="animation-delay:.2s"></div><div class="dot" style="animation-delay:.4s"></div></div>';
  msgs.appendChild(thinkEl); msgs.scrollTop = msgs.scrollHeight;

  let full = '';
  try {
    const resp = await puter.ai.chat(chatMessages, { model: S.currentModel, stream: true, temperature: S.temperature || 0.7 });
    thinkEl.remove();
    const bodyEl = addIdeMsg('assistant', '', true);

    if (resp && typeof resp[Symbol.asyncIterator] === 'function') {
      for await (const part of resp) {
        if (IDE.abortIde) break;
        const t = part?.text || part?.message?.content || '';
        if (t) { full += t; bodyEl.innerHTML = renderMarkdown(full); msgs.scrollTop = msgs.scrollHeight; }
      }
    } else if (resp?.message?.content) {
      full = resp.message.content;
      bodyEl.innerHTML = renderMarkdown(full);
    } else if (typeof resp === 'string') {
      full = resp; bodyEl.innerHTML = renderMarkdown(full);
    }

    bodyEl.classList.remove('streaming-cursor');
    bodyEl.querySelectorAll('pre code').forEach(b => { try { hljs.highlightElement(b); } catch(e){} });

    // Add "Apply to editor" buttons on code blocks
    bodyEl.querySelectorAll('pre').forEach(pre => {
      const code = pre.querySelector('code');
      if (!code) return;
      const applyBtn = document.createElement('button');
      applyBtn.className = 'ide-apply-btn';
      applyBtn.textContent = '⤵ Apply to editor';
      applyBtn.title = 'Replace editor content with this code';
      applyBtn.addEventListener('click', () => {
        if (!IDE.cm) { toast('Open a file first', 'error'); return; }
        const codeText = code.textContent || '';
        IDE.cm.setValue(codeText);
        if (IDE.activeFile && IDE.files[IDE.activeFile]) {
          IDE.files[IDE.activeFile].content = codeText;
          IDE.files[IDE.activeFile].saved = false;
          renderFileTabs(); renderFileTree();
        }
        toast('Code applied to editor ✓');
      });
      pre.style.position = 'relative';
      pre.appendChild(applyBtn);
    });

    IDE.aiMessages.push({ role: 'assistant', content: full });
  } catch (err) {
    thinkEl.remove();
    if (!IDE.abortIde) {
      addIdeMsg('assistant', '⚠ ' + (err.message || 'Request failed'));
      toast('AI error: ' + (err.message || ''), 'error');
    }
  }

  IDE.ideBusy = false; IDE.abortIde = false;
  document.getElementById('ide-ai-send').style.display = '';
  document.getElementById('ide-ai-stop').style.display = 'none';
}

function addIdeMsg(role, text, streaming = false) {
  const msgs = document.getElementById('ide-ai-msgs');
  const wrap = document.createElement('div');
  wrap.className = 'ide-ai-msg ' + role;
  if (streaming) wrap.classList.add('streaming-cursor');
  if (text) {
    if (role === 'assistant') { wrap.classList.add('md'); wrap.innerHTML = renderMarkdown(text); }
    else wrap.textContent = text;
  }
  msgs.appendChild(wrap);
  msgs.scrollTop = msgs.scrollHeight;
  return wrap;
}

// ── Wire up all IDE buttons ──
document.getElementById('ide-new-btn').addEventListener('click', () => ideNewFile());
document.getElementById('ide-upload-btn').addEventListener('click', ideUploadFile);
document.getElementById('ide-zip-btn').addEventListener('click', ideDownloadZip);
document.getElementById('ide-tree-new-btn').addEventListener('click', () => ideNewFile());
document.getElementById('ide-tree-upload-btn').addEventListener('click', ideUploadFile);
document.getElementById('ide-save-btn').addEventListener('click', ideSaveFile);
document.getElementById('ide-dl-btn').addEventListener('click', ideDownloadFile);
document.getElementById('ide-run-btn').addEventListener('click', ideRunCode);

document.querySelectorAll('.ide-wlc-card[data-tpl]').forEach(card => {
  card.addEventListener('click', () => ideQuickStart(card.dataset.tpl));
});
document.querySelectorAll('.ide-tpl-chip[data-tpl]').forEach(chip => {
  chip.addEventListener('click', () => ideQuickStart(chip.dataset.tpl));
});

document.getElementById('ide-wlc-new').addEventListener('click', () => ideNewFile());
document.getElementById('ide-wlc-upload').addEventListener('click', ideUploadFile);

// Output panel
document.getElementById('ide-output-close').addEventListener('click', () => { document.getElementById('ide-output').style.display = 'none'; });
document.getElementById('ide-output-clear').addEventListener('click', () => {
  document.getElementById('ide-output-pre').textContent = '';
  document.getElementById('ide-html-frame').srcdoc = '';
});
document.getElementById('ide-output-rerun')?.addEventListener('click', ideRunCode);
document.querySelectorAll('.ide-out-tab').forEach(tab => {
  tab.addEventListener('click', () => showOutTab(tab.dataset.out));
});

// AI panel toggle
document.getElementById('ide-ai-toggle').addEventListener('click', () => {
  const panel = document.getElementById('ide-ai-panel');
  panel.classList.toggle('hidden');
});
document.getElementById('ide-ai-close').addEventListener('click', () => {
  document.getElementById('ide-ai-panel').classList.add('hidden');
});
document.getElementById('ide-ai-clear').addEventListener('click', () => {
  const msgs = document.getElementById('ide-ai-msgs');
  msgs.innerHTML = '';
  IDE.aiMessages = [];
  msgs.innerHTML = `<div class="ide-ai-welcome-msg"><div class="ide-ai-welcome-icon">🤖</div><strong>AI Code Assistant</strong><p>Chat cleared. Ask me anything about your code.</p></div>`;
});

// Project name editable
document.getElementById('ide-project-name')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); }
});

// ── Tab activation ──
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.dataset.tab === 'image') { updateImageModels(); }
    if (btn.dataset.tab === 'code' && IDE.cm) { setTimeout(() => IDE.cm.refresh(), 50); }
  });
});

// Initialize image section on load
window.addEventListener('load', () => {
  updateImageModels();
});
