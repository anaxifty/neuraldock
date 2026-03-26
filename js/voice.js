/**
 * voice.js — Text-to-speech, voice input, live voice conversation
 * Refactored for New UI
 */

'use strict';

function updateVoiceOptions() {
  const pSel = document.getElementById('voice-provider-select');
  const vSel = document.getElementById('voice-name-select');
  if (!pSel || !vSel) return;

  if (pSel.options.length === 0) {
    pSel.innerHTML = '';
    Object.entries(VOICE_REGISTRY).forEach(([id, reg]) => {
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = id.toUpperCase();
      pSel.appendChild(opt);
    });
  }

  const provider = pSel.value || 'openai';
  vSel.innerHTML = '';
  const reg = VOICE_REGISTRY[provider];
  if (reg) {
    reg.voices.forEach(([v, l]) => {
      const opt = document.createElement('option');
      opt.value = v;
      opt.textContent = l;
      vSel.appendChild(opt);
    });
  }
}

document.getElementById('voice-provider-select')?.addEventListener('change', updateVoiceOptions);
document.getElementById('voice-gen-btn')?.addEventListener('click', generateSpeech);

let currentAudio = null;

async function generateSpeech() {
  const text = document.getElementById('voice-input')?.value.trim();
  if (!text) { toast('Enter text to synthesize'); return; }

  const provider = document.getElementById('voice-provider-select').value;
  const voice = document.getElementById('voice-name-select').value;
  const btn = document.getElementById('voice-gen-btn');
  const outputCont = document.getElementById('voice-output-container');

  btn.disabled = true;
  btn.textContent = 'Synthesizing...';

  try {
    let opts = {};
    if (provider === 'openai') opts = { provider: 'openai', model: 'tts-1', voice };
    else if (provider === 'aws-polly') opts = { voice, engine: 'neural' };
    else opts = { provider, voice };

    const audio = await puter.ai.txt2speech(text, opts);
    currentAudio = audio;

    outputCont.classList.remove('hidden');

    const playBtn = document.getElementById('voice-play-btn');
    const playIcon = document.getElementById('voice-play-icon');
    const progress = document.getElementById('voice-progress');
    const timeEl = document.getElementById('voice-time');
    const durEl = document.getElementById('voice-duration');

    playIcon.textContent = 'pause';
    audio.play();

    audio.ontimeupdate = () => {
        const pct = (audio.currentTime / audio.duration) * 100;
        progress.style.width = `${pct}%`;
        timeEl.textContent = formatTime(audio.currentTime);
        durEl.textContent = formatTime(audio.duration);
    };

    audio.onended = () => {
        playIcon.textContent = 'play_arrow';
        progress.style.width = '0%';
    };

    playBtn.onclick = () => {
        if (audio.paused) {
            audio.play();
            playIcon.textContent = 'pause';
        } else {
            audio.pause();
            playIcon.textContent = 'play_arrow';
        }
    };

    document.getElementById('voice-download-btn').onclick = () => {
        const a = document.createElement('a');
        a.href = audio.src;
        a.download = `neuraldock-voice-${Date.now()}.mp3`;
        a.click();
    };

  } catch (err) {
    toast('Synthesis failed: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Synthesize Audio';
  }
}

function formatTime(secs) {
    if (isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
}

window.addEventListener('DOMContentLoaded', updateVoiceOptions);
