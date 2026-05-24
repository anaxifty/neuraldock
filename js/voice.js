/**
 * voice.js — Text-to-speech, voice input, live voice conversation
 * Depends on: utils.js, config.js (VOICE_REGISTRY), state.js
 */

'use strict';

// ── Voice Studio State ─────────────────────────────────────────────────────
const VS = {
  pitch: 1.0,
  speed: 1.0,
  activeProvider: 'openai',
  activeVoice: 'alloy',
  activeEngine: 'tts-1',
  recordings: []
};

// ── TTS: provider / voice options ──────────────────────────────────────────
document.getElementById('voiceProvider').addEventListener('change', updateVoiceOptions);

function updateVoiceOptions() {
  const provider = document.getElementById('voiceProvider').value;
  const vs = document.getElementById('voiceSelect');
  const es = document.getElementById('voiceEngine');
  if (!vs || !es) return;
  vs.innerHTML = '';
  es.innerHTML = '';
  const reg = VOICE_REGISTRY[provider];
  if (!reg) return;
  reg.voices.forEach(([v, l])  => { vs.innerHTML += `<option value="${v}">${l}</option>`; });
  reg.engines.forEach(([v, l]) => { es.innerHTML += `<option value="${v}">${l}</option>`; });

  // Sync Voice Studio state if it was changed from the old UI
  VS.activeProvider = provider;
  VS.activeVoice = vs.value;
  VS.activeEngine = es.value;
  updateVoiceStudioLibrary();
}

// ── TTS: character counter ─────────────────────────────────────────────────
document.getElementById('voiceText').addEventListener('input', function () {
  const n  = this.value.length;
  const el = document.getElementById('voiceCharCount');
  if (el) {
    el.textContent = `${n} / 3000`;
    el.className   = 'char-count' + (n > 2900 ? ' danger' : n > 2500 ? ' warn' : '');
  }
});

// ── TTS: generate speech ───────────────────────────────────────────────────
document.getElementById('speakBtn').addEventListener('click', generateSpeech);

async function generateSpeech(useStudioBuffer = false) {
  const isStudio = (useStudioBuffer === true);
  const textSourceId = isStudio ? 'vs-text-buffer' : 'voiceText';
  const textBuffer = document.getElementById(textSourceId);
  if (!textBuffer) return;
  const text = textBuffer.value.trim();
  if (!text) return;

  // Use values from studio state if using studio buffer, otherwise from old UI
  const provider = isStudio ? VS.activeProvider : document.getElementById('voiceProvider').value;
  const voice    = isStudio ? VS.activeVoice    : document.getElementById('voiceSelect').value;
  const engine   = isStudio ? VS.activeEngine   : document.getElementById('voiceEngine').value;

  const vLabel = isStudio
    ? (VOICE_REGISTRY[provider]?.voices.find(v => v[0] === voice)?.[1] || voice)
    : (document.getElementById('voiceSelect').selectedOptions[0]?.text || voice);

  const btnId = isStudio ? 'vs-generate-btn' : 'speakBtn';
  const btn = document.getElementById(btnId);
  const originalHtml = btn.innerHTML;
  btn.disabled  = true;
  btn.innerHTML = isStudio
    ? '<span class="material-symbols-outlined animate-spin">refresh</span><span class="font-headline font-bold uppercase tracking-widest text-xs">Processing...</span>'
    : '<span class="spinner"></span> Generating…';

  const emptyEl = document.getElementById('voiceEmpty');
  if (emptyEl) emptyEl.style.display = 'none';

  const vsProgressBar = document.getElementById('vs-progress-bar');
  if (vsProgressBar) vsProgressBar.style.width = '20%';

  try {
    let opts = {};
    if      (provider === 'aws-polly')  opts = { voice, engine, language: 'en-US' };
    else if (provider === 'openai')     opts = { provider: 'openai',    model: engine, voice };
    else if (provider === 'elevenlabs') opts = { provider: 'elevenlabs', model: engine, voice, output_format: 'mp3_44100_128' };
    else if (provider === 'playht')     opts = { provider: 'playht',     model: engine, voice };
    else if (provider === 'openai-fm')  opts = { provider: 'openai-fm',  model: engine, voice };

    // Apply speed if supported by Puter (experimental check)
    if (isStudio && VS.speed !== 1.0) {
        opts.speed = VS.speed;
    }

    if (vsProgressBar) vsProgressBar.style.width = '60%';
    const audio = await puter.ai.txt2speech(text, opts);
    if (vsProgressBar) vsProgressBar.style.width = '100%';

    // Add to history (Old UI)
    const history = document.getElementById('voiceHistory');
    if (history) {
        const card = document.createElement('div');
        card.className = 'v-card';
        const short = text.length > 180 ? text.substring(0, 180) + '…' : text;
        card.innerHTML =
          `<div class="v-text">"${escHtml(short)}"</div>` +
          `<div class="v-tags"><span class="v-tag">${escHtml(provider)}</span><span class="v-tag">${escHtml(vLabel)}</span></div>`;
        audio.controls = true;
        audio.style.cssText = 'width:100%;height:36px;margin-top:8px;';
        card.appendChild(audio);
        history.insertBefore(card, history.firstChild);
    }

    // Add to Session Recordings (Studio UI)
    addRecordingToStudio(text, provider, vLabel, audio);

    audio.play();
    setTimeout(() => { if (vsProgressBar) vsProgressBar.style.width = '0%'; }, 1000);
  } catch (err) {
    toast('Speech generation failed: ' + (err.message || ''), 'error');
    if (vsProgressBar) vsProgressBar.style.width = '0%';
  }

  btn.disabled  = false;
  btn.innerHTML = originalHtml;
}

// ── Voice Studio Integration ──────────────────────────────────────────────

function updateVoiceStudio() {
    updateVoiceStudioLibrary();
    updateActiveVoiceProfile();
}

function updateVoiceStudioLibrary() {
    const list = document.getElementById('vs-library-list');
    if (!list) return;
    list.innerHTML = '';

    // For now, let's just list voices from the current provider or a default selection
    const reg = VOICE_REGISTRY[VS.activeProvider];
    if (!reg) return;

    reg.voices.forEach(([id, label]) => {
        const isActive = (id === VS.activeVoice);
        const initials = label.split(' ')[0].substring(0, 2).toUpperCase();
        const sub = label.includes('(') ? label.split('(')[1].replace(')', '') : VS.activeProvider;

        const item = document.createElement('div');
        item.className = `flex items-center gap-3 p-3 bg-[#1a1815] rounded-sm border ${isActive ? 'border-primary/40' : 'border-outline-variant/10'} cursor-pointer hover:border-primary/40 transition-colors`;
        item.innerHTML = `
            <div class="w-10 h-10 rounded-full ${isActive ? 'bg-primary' : 'bg-[#2d2824]'} flex items-center justify-center font-mono ${isActive ? 'text-on-primary' : 'text-primary'} font-bold text-xs">${initials}</div>
            <div class="flex-1">
                <h4 class="text-xs font-bold font-headline uppercase tracking-tight ${isActive ? 'text-primary' : ''}">${label.split(' (')[0]}</h4>
                <p class="font-mono text-[9px] text-on-surface-variant uppercase tracking-tighter">${sub}</p>
            </div>
            <span class="material-symbols-outlined text-sm ${isActive ? 'text-primary' : 'text-on-surface-variant'}">${isActive ? 'check_circle' : 'radio_button_unchecked'}</span>
        `;
        item.style.fontVariationSettings = isActive ? "'FILL' 1" : "";
        item.onclick = () => selectStudioVoice(id, VS.activeProvider, reg.engines[0]?.[0]);
        list.appendChild(item);
    });
}

function selectStudioVoice(voiceId, provider, engine) {
    VS.activeVoice = voiceId;
    VS.activeProvider = provider;
    VS.activeEngine = engine || VS.activeEngine;

    // Sync back to old UI
    const vp = document.getElementById('voiceProvider');
    if (vp && vp.value !== provider) {
        vp.value = provider;
        updateVoiceOptions();
    }
    const vs = document.getElementById('voiceSelect');
    if (vs) vs.value = voiceId;

    updateVoiceStudioLibrary();
    updateActiveVoiceProfile();
}

function updateActiveVoiceProfile() {
    const vLabel = VOICE_REGISTRY[VS.activeProvider]?.voices.find(v => v[0] === VS.activeVoice)?.[1] || VS.activeVoice;
    const initials = vLabel.split(' ')[0].substring(0, 2).toUpperCase();

    document.getElementById('vs-profile-name').textContent = vLabel.split(' (')[0];
    document.getElementById('vs-profile-tags').textContent = `${VS.activeProvider.toUpperCase()} • ${vLabel.includes('(F') ? 'FEMALE' : 'MALE'} • ACTIVE`;
}

function addRecordingToStudio(text, provider, voiceLabel, audio) {
    const list = document.getElementById('vs-recordings-list');
    const empty = document.getElementById('vs-empty-recordings');
    if (empty) empty.style.display = 'none';

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateStr = now.toLocaleDateString();
    const fileName = (text.substring(0, 15).replace(/\s/g, '_') || 'Recording') + '.wav';

    const item = document.createElement('div');
    item.className = 'bg-[#1a1815] border-l-2 border-[#d97706] p-4 flex items-center justify-between group';
    item.innerHTML = `
        <div class="flex items-center gap-4">
            <button class="vs-play-btn w-10 h-10 flex items-center justify-center rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                <span class="material-symbols-outlined">play_arrow</span>
            </button>
            <div>
                <h4 class="text-sm font-bold font-headline">${escHtml(fileName)}</h4>
                <p class="font-mono text-[10px] text-on-surface-variant uppercase tracking-tighter">${escHtml(provider)} • ${dateStr} • ${timeStr}</p>
            </div>
        </div>
        <div class="flex items-center gap-8">
            <div class="flex items-center gap-2">
                <div class="w-32 h-8 flex items-end gap-[1px] opacity-40">
                    <div class="bg-primary w-1 h-[20%]"></div><div class="bg-primary w-1 h-[40%]"></div><div class="bg-primary w-1 h-[60%]"></div>
                    <div class="bg-primary w-1 h-[30%]"></div><div class="bg-primary w-1 h-[80%]"></div><div class="bg-primary w-1 h-[50%]"></div>
                    <div class="bg-primary w-1 h-[90%]"></div><div class="bg-primary w-1 h-[40%]"></div><div class="bg-primary w-1 h-[20%]"></div>
                </div>
            </div>
            <div class="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button class="vs-dl-btn material-symbols-outlined text-on-surface-variant hover:text-on-surface text-lg">download</button>
                <button class="vs-del-btn material-symbols-outlined text-on-surface-variant hover:text-error text-lg">delete</button>
            </div>
        </div>
    `;

    item.querySelector('.vs-play-btn').onclick = () => {
        audio.play();
    };

    item.querySelector('.vs-del-btn').onclick = () => {
        item.remove();
        if (list.children.length === 0) empty.style.display = 'block';
    };

    item.querySelector('.vs-dl-btn').onclick = () => {
        const a = document.createElement('a');
        a.href = audio.src;
        a.download = fileName;
        a.click();
    };

    list.insertBefore(item, list.firstChild);
}

// ── Studio Event Listeners ────────────────────────────────────────────────
document.getElementById('vs-text-buffer').addEventListener('input', function() {
    const n = this.value.length;
    const el = document.getElementById('vs-char-count');
    el.textContent = `Character Count: ${n} / 2500`;
    el.className = 'font-mono text-[10px] uppercase tracking-[0.08em] ' + (n > 2400 ? 'text-error' : 'text-secondary');
});

document.getElementById('vs-generate-btn').addEventListener('click', () => generateSpeech(true));

document.getElementById('vs-pitch-btn').addEventListener('click', function() {
    const steps = [0.5, 0.8, 1.0, 1.2, 1.5, 2.0];
    let idx = steps.indexOf(VS.pitch);
    VS.pitch = steps[(idx + 1) % steps.length];
    this.querySelector('span:last-child').textContent = `Pitch: ${VS.pitch}x`;
});

document.getElementById('vs-speed-btn').addEventListener('click', function() {
    const steps = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
    let idx = steps.indexOf(VS.speed);
    VS.speed = steps[(idx + 1) % steps.length];
    this.querySelector('span:last-child').textContent = `Speed: ${VS.speed}x`;
});

document.getElementById('vs-live-voice-btn').addEventListener('click', openLiveVoice);

/** Speak text using the browser's built-in SpeechSynthesis (for chat responses) */
function speakText(text) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const clean = text.replace(/[#*`_\[\]()]/g, '').replace(/\n+/g, '. ');
  const utt   = new SpeechSynthesisUtterance(clean);
  utt.rate    = S.speakSpeed;
  window.speechSynthesis.speak(utt);
}

// ── Voice input (speech-to-text for chat) ─────────────────────────────────
let recognition = null;

document.getElementById('voice-input-btn').addEventListener('click', startVoiceInput);
document.getElementById('voice-cancel-btn').addEventListener('click', stopVoiceInput);

function startVoiceInput() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { toast('Voice input not supported in this browser', 'error'); return; }

  recognition = new SR();
  recognition.interimResults = true;
  recognition.continuous     = false;
  recognition.lang           = 'en-US';

  document.getElementById('voice-overlay').classList.add('active');
  document.getElementById('voice-status').textContent = 'Listening…';

  recognition.onresult = e => {
    let t = '';
    for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
    document.getElementById('voice-status').textContent = t || 'Listening…';
    if (e.results[0].isFinal) {
      const inp = document.getElementById('chatInput');
      inp.value = t;
      autoResize(inp);
      stopVoiceInput();
    }
  };
  recognition.onerror = () => stopVoiceInput();
  recognition.onend   = () => document.getElementById('voice-overlay').classList.remove('active');
  recognition.start();
}

function stopVoiceInput() {
  if (recognition) { recognition.stop(); recognition = null; }
  document.getElementById('voice-overlay').classList.remove('active');
}

// ── Live voice conversation ────────────────────────────────────────────────
document.getElementById('live-voice-tab-btn').addEventListener('click', openLiveVoice);
document.getElementById('live-voice-end-btn').addEventListener('click', closeLiveVoice);

let liveVoiceRecorder = null;
let liveVoiceChunks   = [];
let liveVoiceBusy     = false;

function openLiveVoice() {
  document.getElementById('live-voice-overlay').style.display = 'flex';
}
function closeLiveVoice() {
  document.getElementById('live-voice-overlay').style.display = 'none';
  if (liveVoiceRecorder && liveVoiceRecorder.state !== 'inactive') liveVoiceRecorder.stop();
  liveVoiceRecorder = null;
  liveVoiceChunks   = [];
}

const liveBtn = document.getElementById('live-voice-talk-btn');
liveBtn.addEventListener('mousedown',  startLiveTalk);
liveBtn.addEventListener('mouseup',    stopLiveTalk);
liveBtn.addEventListener('touchstart', e => { e.preventDefault(); startLiveTalk(); });
liveBtn.addEventListener('touchend',   e => { e.preventDefault(); stopLiveTalk(); });

async function startLiveTalk() {
  if (liveVoiceBusy) return;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    liveVoiceChunks   = [];
    liveVoiceRecorder = new MediaRecorder(stream);
    liveVoiceRecorder.ondataavailable = e => { if (e.data.size > 0) liveVoiceChunks.push(e.data); };
    liveVoiceRecorder.start();
    document.getElementById('live-voice-status').textContent = 'Recording…';
    document.getElementById('live-voice-orb').classList.add('recording');
  } catch (err) {
    toast('Microphone access denied', 'error');
  }
}

async function stopLiveTalk() {
  if (!liveVoiceRecorder || liveVoiceRecorder.state === 'inactive') return;
  liveVoiceBusy = true;
  document.getElementById('live-voice-status').textContent = 'Processing…';
  document.getElementById('live-voice-orb').classList.remove('recording');
  liveVoiceRecorder.stop();

  liveVoiceRecorder.onstop = async () => {
    try {
      const blob = new Blob(liveVoiceChunks, { type: 'audio/webm' });

      // Transcribe
      let transcript = '';
      try {
        const transcribed = await puter.ai.transcribe(blob);
        transcript = (typeof transcribed === 'string' ? transcribed : transcribed?.text || '').trim();
      } catch {
        transcript = '[Transcription failed — please type instead]';
      }

      if (!transcript) {
        liveVoiceBusy = false;
        document.getElementById('live-voice-status').textContent = 'Nothing heard. Try again.';
        return;
      }

      document.getElementById('live-voice-transcript').innerHTML +=
        `<div class="lv-user">${escHtml(transcript)}</div>`;
      document.getElementById('live-voice-status').textContent = 'Thinking…';

      // Get AI response
      const msgs = [
        ...S.chatMessages.slice(-10),
        { role: 'user', content: transcript },
      ];
      if (S.systemPrompt) msgs.unshift({ role: 'system', content: S.systemPrompt });
      const resp   = await puter.ai.chat(msgs, { model: S.currentModel, stream: false, temperature: S.temperature });
      const answer = (typeof resp === 'string' ? resp : resp?.message?.content || '').trim();

      document.getElementById('live-voice-transcript').innerHTML +=
        `<div class="lv-ai">${escHtml(answer)}</div>`;
      document.getElementById('live-voice-status').textContent = 'Speaking…';

      // Speak the response
      const audio = await puter.ai.txt2speech(answer.slice(0, 500), {
        provider: 'openai', model: 'tts-1', voice: 'alloy',
      });
      audio.onended = () => {
        document.getElementById('live-voice-status').textContent = 'Hold the button to speak';
        liveVoiceBusy = false;
      };
      audio.play();

      // Mirror exchange into main chat state
      S.chatMessages.push(
        { role: 'user',      content: transcript },
        { role: 'assistant', content: answer, model: S.currentModel },
      );
      if (S.activeConvId) persistConversation(transcript, answer);

    } catch (err) {
      toast('Live voice error: ' + (err.message || ''), 'error');
      liveVoiceBusy = false;
      document.getElementById('live-voice-status').textContent = 'Error. Try again.';
    }
  };
}
