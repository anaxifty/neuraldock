/**
 * voice.js — Text-to-speech, voice input, live voice conversation
 * Depends on: utils.js, config.js (VOICE_REGISTRY), state.js
 */

'use strict';

// ── TTS: provider / voice options ──────────────────────────────────────────
document.getElementById('voiceProvider').addEventListener('change', updateVoiceOptions);

function updateVoiceOptions() {
  const provider = document.getElementById('voiceProvider').value;
  const vs = document.getElementById('voiceSelect');
  const es = document.getElementById('voiceEngine');
  vs.innerHTML = '';
  es.innerHTML = '';
  const reg = VOICE_REGISTRY[provider];
  if (!reg) return;
  reg.voices.forEach(([v, l])  => { vs.innerHTML += `<option value="${v}">${l}</option>`; });
  reg.engines.forEach(([v, l]) => { es.innerHTML += `<option value="${v}">${l}</option>`; });
}

// ── TTS: character counter ─────────────────────────────────────────────────
document.getElementById('voiceText').addEventListener('input', function () {
  const n  = this.value.length;
  const el = document.getElementById('voiceCharCount');
  el.textContent = `${n} / 3000`;
  el.className   = 'char-count' + (n > 2900 ? ' danger' : n > 2500 ? ' warn' : '');
});

// ── TTS: generate speech ───────────────────────────────────────────────────
document.getElementById('speakBtn').addEventListener('click', generateSpeech);

async function generateSpeech() {
  const text = document.getElementById('voiceText').value.trim();
  if (!text) return;

  const provider = document.getElementById('voiceProvider').value;
  const voice    = document.getElementById('voiceSelect').value;
  const engine   = document.getElementById('voiceEngine').value;
  const vLabel   = document.getElementById('voiceSelect').selectedOptions[0]?.text || voice;

  const btn = document.getElementById('speakBtn');
  btn.disabled  = true;
  btn.innerHTML = '<span class="spinner"></span> Generating…';

  const emptyEl = document.getElementById('voiceEmpty');
  if (emptyEl) emptyEl.style.display = 'none';

  try {
    let opts = {};
    if      (provider === 'aws-polly')  opts = { voice, engine, language: 'en-US' };
    else if (provider === 'openai')     opts = { provider: 'openai',    model: engine, voice };
    else if (provider === 'elevenlabs') opts = { provider: 'elevenlabs', model: engine, voice, output_format: 'mp3_44100_128' };
    else if (provider === 'playht')     opts = { provider: 'playht',     model: engine, voice };
    else if (provider === 'openai-fm')  opts = { provider: 'openai-fm',  model: engine, voice };

    const audio = await puter.ai.txt2speech(text, opts);
    const history = document.getElementById('voiceHistory');
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
    audio.play();
  } catch (err) {
    toast('Speech generation failed: ' + (err.message || ''), 'error');
  }

  btn.disabled  = false;
  btn.innerHTML = '♪ Generate Speech';
}

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
