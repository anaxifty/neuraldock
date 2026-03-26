/**
 * image.js — Text-to-image logic using Puter.js
 * Refactored for New UI
 */

'use strict';

let activeImgProvider = 'openai';
let activeImgCount    = 1;
let activeAR          = '1:1';

const IMAGE_PROVIDERS = {
  'openai': {
    name:     'OpenAI DALL·E 3',
    puterKey: 'openai',
    models:   [['dall-e-3','DALL·E 3']],
    caps: {
      'dall-e-3': { size: true, quality: true, styleMode: true, formats: false, count: false },
      default:    { size: true, quality: true },
    },
  },
  'stability': {
    name:     'Stability AI',
    puterKey: 'stability-ai',
    models:   [['stable-diffusion-xl-1024-v1-0','SDXL 1.0'],['stable-diffusion-v1-6','SD 1.6']],
    caps: {
      default: { steps: true, guidance: true, neg: true, count: true },
    },
  },
};

const AR_SIZE_MAP = {
  'openai':    { '1:1': '1024x1024', '16:9': '1792x1024', '9:16': '1024x1792' },
  'stability': { '1:1': '1024x1024', '16:9': '1024x1024', '9:16': '1024x1024' },
};

function updateImageModels() {
  const sel = document.getElementById('image-model-select');
  if (!sel) return;
  sel.innerHTML = '';
  for (const [id, p] of Object.entries(IMAGE_PROVIDERS)) {
    const group = document.createElement('optgroup');
    group.label = p.name;
    p.models.forEach(([mId, mName]) => {
      const opt = document.createElement('option');
      opt.value = `${id}:${mId}`;
      opt.textContent = mName;
      group.appendChild(opt);
    });
    sel.appendChild(group);
  }
}

document.getElementById('image-gen-btn')?.addEventListener('click', generateImage);

async function generateImage() {
  const promptEl = document.getElementById('image-prompt');
  const prompt = promptEl?.value.trim();
  if (!prompt) { toast('Enter a prompt first'); return; }

  const modelVal = document.getElementById('image-model-select').value;
  const [providerKey, modelId] = modelVal.split(':');
  const p = IMAGE_PROVIDERS[providerKey];
  const ar = document.getElementById('image-ratio').value;
  const quality = document.getElementById('image-quality').value;

  const btn = document.getElementById('image-gen-btn');
  const loading = document.getElementById('image-loading');
  const placeholder = document.getElementById('image-canvas-placeholder');
  const resultCont = document.getElementById('image-result-container');
  const resultImg = document.getElementById('image-result');

  btn.disabled = true;
  loading.classList.remove('hidden');
  placeholder.classList.add('hidden');
  resultCont.classList.add('hidden');

  try {
    const opts = {
        prompt: prompt,
        provider: p.puterKey,
        model: modelId,
        size: AR_SIZE_MAP[providerKey]?.[ar] || '1024x1024',
        quality: quality
    };

    const image = await puter.ai.txt2img(opts);
    const src = image.src || image.url || (image instanceof Blob ? URL.createObjectURL(image) : String(image));

    resultImg.src = src;
    resultCont.classList.remove('hidden');

    document.getElementById('image-download').onclick = () => {
        const a = document.createElement('a');
        a.href = src;
        a.download = `neuraldock-img-${Date.now()}.png`;
        a.click();
    };
  } catch (err) {
    toast('Image failed: ' + err.message);
    placeholder.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    loading.classList.add('hidden');
  }
}
