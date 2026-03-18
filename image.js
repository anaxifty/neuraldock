/**
 * image.js — Image generation: provider tabs, model caps, generate, download
 * Depends on: utils.js, config.js (IMAGE_PROVIDERS, AR_SIZE_MAP), state.js
 */

'use strict';

let activeImgProvider = 'openai-image-generation';
let activeImgCount    = 1;
let activeAR          = '1:1';

// ── Provider tab buttons ────────────────────────────────────────────────────
document.querySelectorAll('.img-prov-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    activeImgProvider = btn.dataset.provider;
    document.querySelectorAll('.img-prov-btn').forEach(b => b.classList.toggle('active', b === btn));
    updateImageModels();
  });
});

// ── Model select ───────────────────────────────────────────────────────────
document.getElementById('imageModel').addEventListener('change', updateImageCaps);

function updateImageModels() {
  const p = IMAGE_PROVIDERS[activeImgProvider];
  if (!p) return;
  const sel = document.getElementById('imageModel');
  sel.innerHTML = '';
  p.models.forEach(m => {
    const o = document.createElement('option');
    o.value       = m.id;
    o.textContent = m.name + (m.badge ? ` [${m.badge}]` : '');
    sel.appendChild(o);
  });
  updateImageCaps();
}

/** Show/hide controls based on what the selected model actually supports */
function updateImageCaps() {
  const p = IMAGE_PROVIDERS[activeImgProvider];
  if (!p) return;
  const modelId   = document.getElementById('imageModel').value;
  const caps      = p.caps[modelId] || p.caps.default || {};
  const modelMeta = p.models.find(m => m.id === modelId);

  // Model info tooltip
  const infoEl = document.getElementById('img-model-info');
  if (infoEl) infoEl.textContent = modelMeta?.info || '';

  // Resolution
  const sF = document.getElementById('imageSizeField');
  const sS = document.getElementById('imageSize');
  if (caps.sizes?.length) {
    sS.innerHTML = caps.sizes.map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
    // Pre-select based on active AR
    const target = AR_SIZE_MAP[activeImgProvider]?.[activeAR];
    if (target) {
      const opt = sS.querySelector(`option[value="${target}"]`);
      if (opt) opt.selected = true;
    }
    sF.style.display = '';
  } else {
    sF.style.display = 'none';
  }

  // Quality
  const qF = document.getElementById('imageQualityField');
  const qS = document.getElementById('imageQuality');
  if (caps.qualities?.length) {
    qS.innerHTML    = caps.qualities.map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
    qF.style.display = '';
  } else {
    qF.style.display = 'none';
  }

  // DALL-E 3 style mode (vivid / natural)
  const smF = document.getElementById('imgStyleModeField');
  if (smF) smF.style.display = caps.styleMode ? '' : 'none';

  // Output format
  const fmF = document.getElementById('imgFormatField');
  if (fmF) fmF.style.display = caps.formats ? '' : 'none';

  // Diffusion: steps slider
  const stepsRow = document.getElementById('cap-steps');
  if (stepsRow) {
    stepsRow.style.display = caps.steps ? '' : 'none';
    if (caps.steps && caps.stepsRange) {
      const sl = document.getElementById('imageSteps');
      sl.min = caps.stepsRange[0]; sl.max = caps.stepsRange[1]; sl.value = caps.stepsRange[2];
      document.getElementById('stepsVal').textContent = sl.value;
    }
  }

  // Diffusion: guidance slider
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

  // Count buttons (some models only support n=1)
  const countField = document.getElementById('imageCountField');
  if (countField) countField.style.display = caps.count === false ? 'none' : '';
}

// ── Aspect ratio buttons ───────────────────────────────────────────────────
document.querySelectorAll('.img-ar-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    activeAR = btn.dataset.ar;
    document.querySelectorAll('.img-ar-btn').forEach(b => b.classList.toggle('active', b === btn));
    const target = AR_SIZE_MAP[activeImgProvider]?.[activeAR];
    if (target) {
      const sS = document.getElementById('imageSize');
      const opt = sS.querySelector(`option[value="${target}"]`);
      if (opt) opt.selected = true;
    }
  });
});

// ── Count buttons ──────────────────────────────────────────────────────────
document.querySelectorAll('.img-count-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    activeImgCount = parseInt(btn.dataset.count) || 1;
    document.querySelectorAll('.img-count-btn').forEach(b => b.classList.toggle('active', b === btn));
  });
});

// ── Sliders ────────────────────────────────────────────────────────────────
document.getElementById('imageSteps').addEventListener('input', function () {
  document.getElementById('stepsVal').textContent = this.value;
});
document.getElementById('imageGuidance').addEventListener('input', function () {
  document.getElementById('guidanceVal').textContent = (this.value / 10).toFixed(1);
});

// ── Style presets ──────────────────────────────────────────────────────────
document.querySelectorAll('.style-preset').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.style-preset').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    S.activeStyle = btn.dataset.style;
  });
});

// ── Prompt keyboard shortcut ───────────────────────────────────────────────
document.getElementById('imagePrompt').addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); generateImage(); }
});

// ── Prompt enhancement ─────────────────────────────────────────────────────
document.getElementById('img-enhance-btn').addEventListener('click', async function () {
  const ta   = document.getElementById('imagePrompt');
  const orig = ta.value.trim();
  if (!orig) { toast('Enter a prompt first', 'error'); return; }
  this.textContent = '…'; this.disabled = true;
  try {
    const resp = await puter.ai.chat(
      [{ role: 'user', content:
        `Enhance this image generation prompt to be more vivid, detailed and descriptive. ` +
        `Keep the same subject but add: lighting direction, mood, color palette, composition, and style cues. ` +
        `Return ONLY the enhanced prompt — no explanation, no quotes, no preamble:\n\n${orig}`
      }],
      { model: 'gpt-4o-mini', stream: false }
    );
    const enhanced = (typeof resp === 'string' ? resp : resp?.message?.content || '')
      .trim().replace(/^["']|["']$/g, '');
    if (enhanced) { ta.value = enhanced; toast('Prompt enhanced ✨'); }
  } catch (e) {
    toast('Enhancement failed', 'error');
  }
  this.textContent = '✨ Enhance'; this.disabled = false;
});

// ── Generate ───────────────────────────────────────────────────────────────
document.getElementById('genImgBtn').addEventListener('click', generateImage);

async function generateImage() {
  const promptEl = document.getElementById('imagePrompt');
  const prompt   = promptEl.value.trim();
  if (!prompt) { toast('Enter a prompt first', 'error'); return; }

  const fullPrompt = S.activeStyle ? `${prompt}, ${S.activeStyle}` : prompt;
  const p          = IMAGE_PROVIDERS[activeImgProvider];
  if (!p) return;
  const modelId = document.getElementById('imageModel').value;
  const caps    = p.caps[modelId] || p.caps.default || {};

  const sEl  = document.getElementById('imageSize');
  const qEl  = document.getElementById('imageQuality');
  const fmEl = document.getElementById('imageFormat');
  const smEl = document.getElementById('imageStyleMode');
  const sF   = document.getElementById('imageSizeField');
  const qF   = document.getElementById('imageQualityField');
  const seedEl = document.getElementById('imageSeed');

  const imgSize     = sF?.style.display !== 'none' && sEl?.value && sEl.value !== 'auto'  ? sEl.value  : undefined;
  const imgQuality  = qF?.style.display !== 'none' && qEl?.value && qEl.value !== 'auto'  ? qEl.value  : undefined;
  const imgFormat   = caps.formats   && fmEl?.value  ? fmEl.value  : undefined;
  const imgStyleMode = caps.styleMode && smEl?.value ? smEl.value  : undefined;
  const negPrompt   = document.getElementById('imageNegPrompt')?.value?.trim() || '';
  const steps       = caps.steps    ? parseInt(document.getElementById('imageSteps').value)              : undefined;
  const guidance    = caps.guidance ? parseFloat(document.getElementById('imageGuidance').value) / 10   : undefined;
  const seed        = seedEl?.value?.trim() ? parseInt(seedEl.value) : undefined;
  const count       = caps.count !== false ? activeImgCount : 1;

  const btn     = document.getElementById('genImgBtn');
  btn.disabled  = true;
  btn.innerHTML = '<span class="spinner"></span> Generating…';

  const gallery = document.getElementById('imageGallery');
  const emptyEl = document.getElementById('imageEmpty');
  if (emptyEl) emptyEl.style.display = 'none';

  // Pre-create placeholder cards
  const cards = [];
  for (let i = 0; i < count; i++) {
    const card = document.createElement('div');
    card.className = 'img-card';
    card.innerHTML = '<div class="loading-box"><span class="spinner"></span> Creating…</div>';
    gallery.insertBefore(card, gallery.firstChild);
    cards.push(card);
  }

  const genOne = async (card) => {
    try {
      const opts = { prompt: fullPrompt, provider: p.puterKey, model: modelId };
      if (imgSize)      opts.size             = imgSize;
      if (imgQuality)   opts.quality          = imgQuality;
      if (imgFormat)    opts.output_format    = imgFormat;
      if (imgStyleMode) opts.style            = imgStyleMode;
      if (steps)        opts.steps            = steps;
      if (guidance)     opts.guidance_scale   = guidance;
      if (negPrompt && caps.neg) opts.negative_prompt = negPrompt;
      if (seed !== undefined)    opts.seed    = seed;

      const image = await puter.ai.txt2img(opts);
      const src   = image.src || image.url || (image instanceof Blob ? URL.createObjectURL(image) : String(image));
      const shortPrompt = prompt.length > 90 ? prompt.slice(0, 90) + '…' : prompt;

      card.innerHTML =
        `<div class="img-card-overlay">` +
          `<button class="img-card-btn dl-btn" title="Download">⬇</button>` +
          `<button class="img-card-btn img-card-vary" title="Generate variation">↻</button>` +
        `</div>` +
        `<img src="${src}" alt="${escHtml(shortPrompt)}" loading="lazy"/>` +
        `<div class="caption">${escHtml(shortPrompt)}</div>`;

      card.querySelector('.dl-btn').addEventListener('click', () => dlImg(card));
      card.querySelector('.img-card-vary').addEventListener('click', () => {
        document.getElementById('imagePrompt').value = prompt;
        toast('Prompt set — click Generate for a variation');
      });
    } catch (err) {
      card.innerHTML =
        `<div class="loading-box" style="flex-direction:column;gap:6px;color:var(--err);font-size:11px;padding:14px;text-align:center;">` +
          `<span style="font-size:1.6rem">✕</span>${escHtml(err.message || 'Generation failed')}` +
        `</div>`;
      toast('Image failed: ' + (err.message || ''), 'error');
    }
  };

  await Promise.all(cards.map(genOne));
  btn.disabled  = false;
  btn.innerHTML = '✦ Generate Image';
}

function dlImg(card) {
  const src = card.querySelector('img')?.src;
  if (!src) return;
  const a    = document.createElement('a');
  a.href     = src;
  a.download = `neuraldock-${Date.now()}.png`;
  a.click();
  toast('Image downloaded');
}
