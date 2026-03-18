/**
 * config.js — Static registries: models, image providers, voice, IDE helpers
 * Depends on: nothing
 */

'use strict';

// ── Chat model provider metadata ──────────────────────────────────────────
const PROVIDER_META = {
  'openai':      { label: 'OpenAI',      color: '#10a37f' },
  'claude':      { label: 'Anthropic',   color: '#c96b3e' },
  'anthropic':   { label: 'Anthropic',   color: '#c96b3e' },
  'google':      { label: 'Google',      color: '#4285f4' },
  'gemini':      { label: 'Google',      color: '#4285f4' },
  'meta':        { label: 'Meta',        color: '#0064e0' },
  'meta-llama':  { label: 'Meta',        color: '#0064e0' },
  'deepseek':    { label: 'DeepSeek',    color: '#5b8dd9' },
  'mistral':     { label: 'Mistral',     color: '#e6a817' },
  'mistralai':   { label: 'Mistral',     color: '#e6a817' },
  'qwen':        { label: 'Qwen',        color: '#a855f7' },
  'xai':         { label: 'xAI',         color: '#d4d4d4' },
  'x-ai':        { label: 'xAI',         color: '#d4d4d4' },
  'together':    { label: 'Together',    color: '#ff6b35' },
  'groq':        { label: 'Groq',        color: '#f55036' },
  'cohere':      { label: 'Cohere',      color: '#3b7dd8' },
  'perplexity':  { label: 'Perplexity',  color: '#20b2aa' },
  'nvidia':      { label: 'NVIDIA',      color: '#76b900' },
  'microsoft':   { label: 'Microsoft',  color: '#00a4ef' },
  'amazon':      { label: 'Amazon',      color: '#ff9900' },
  'aws':         { label: 'Amazon',      color: '#ff9900' },
};

// ── Chat model list (grouped by provider) ──────────────────────────────────
// `tag` values: 'FREE' | 'FAST' | 'SMART' | 'CODE' | ''
let MODELS = [
  { provider: 'OpenAI', color: '#10a37f', models: [
    { id: 'gpt-4o',           name: 'GPT-4o',          tag: 'SMART' },
    { id: 'gpt-4o-mini',      name: 'GPT-4o Mini',     tag: 'FAST'  },
    { id: 'gpt-4.1',          name: 'GPT-4.1',         tag: 'CODE'  },
    { id: 'gpt-4.1-mini',     name: 'GPT-4.1 Mini',    tag: 'FAST'  },
    { id: 'gpt-4.1-nano',     name: 'GPT-4.1 Nano',    tag: 'FAST'  },
    { id: 'o1',               name: 'o1',               tag: 'SMART' },
    { id: 'o3-mini',          name: 'o3 Mini',          tag: 'SMART' },
    { id: 'o4-mini',          name: 'o4 Mini',          tag: 'SMART' },
  ]},
  { provider: 'Anthropic', color: '#c96b3e', models: [
    { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4',   tag: 'SMART' },
    { id: 'claude-sonnet-4-5',        name: 'Claude Sonnet 4.5', tag: 'SMART' },
    { id: 'claude-haiku-4-5',         name: 'Claude Haiku 4.5',  tag: 'FAST'  },
    { id: 'claude-opus-4',            name: 'Claude Opus 4',     tag: 'SMART' },
  ]},
  { provider: 'Google', color: '#4285f4', models: [
    { id: 'google/gemini-2.5-flash',   name: 'Gemini 2.5 Flash',      tag: 'FAST'  },
    { id: 'gemini-2.5-flash-lite',     name: 'Gemini 2.5 Flash Lite', tag: 'FAST'  },
    { id: 'google/gemini-2.5-pro',     name: 'Gemini 2.5 Pro',        tag: 'SMART' },
    { id: 'google/gemini-2.0-flash',   name: 'Gemini 2.0 Flash',      tag: 'FAST'  },
  ]},
  { provider: 'Meta', color: '#0064e0', models: [
    { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B', tag: 'FREE' },
    { id: 'meta-llama/llama-3.1-70b-instruct', name: 'Llama 3.1 70B', tag: 'FREE' },
    { id: 'meta-llama/llama-3.1-8b-instruct',  name: 'Llama 3.1 8B',  tag: 'FREE' },
  ]},
  { provider: 'DeepSeek', color: '#5b8dd9', models: [
    { id: 'deepseek/deepseek-chat', name: 'DeepSeek Chat', tag: 'SMART' },
    { id: 'deepseek/deepseek-r1',   name: 'DeepSeek R1',   tag: 'SMART' },
    { id: 'deepseek-chat',          name: 'DeepSeek (Alt)', tag: 'FAST' },
  ]},
  { provider: 'Mistral', color: '#e6a817', models: [
    { id: 'mistral/mistral-large-latest',     name: 'Mistral Large', tag: 'SMART' },
    { id: 'mistral-small-latest',             name: 'Mistral Small', tag: 'FAST'  },
    { id: 'mistralai/mixtral-8x7b-instruct',  name: 'Mixtral 8x7B', tag: 'FREE'  },
  ]},
  { provider: 'Qwen', color: '#a855f7', models: [
    { id: 'qwen/qwen-2.5-72b-instruct', name: 'Qwen 2.5 72B', tag: 'FREE' },
  ]},
  { provider: 'xAI', color: '#d4d4d4', models: [
    { id: 'grok-3-mini',      name: 'Grok 3 Mini', tag: 'FAST'  },
    { id: 'x-ai/grok-beta',   name: 'Grok Beta',   tag: 'SMART' },
    { id: 'x-ai/grok-2',      name: 'Grok 2',      tag: 'SMART' },
  ]},
];

// ── Image generation provider & model registry ────────────────────────────
const IMAGE_PROVIDERS = {
  'openai-image-generation': {
    label: 'OpenAI', color: '#10a37f', puterKey: 'openai-image-generation',
    models: [
      { id: 'gpt-image-1',      name: 'GPT Image 1',      badge: 'LATEST', info: 'Most capable OpenAI image model.' },
      { id: 'gpt-image-1-mini', name: 'GPT Image 1 Mini', badge: 'FAST',   info: 'Faster, lower-cost version.' },
      { id: 'dall-e-3',         name: 'DALL·E 3',          badge: 'HD',     info: 'HD quality with vivid/natural style modes.' },
      { id: 'dall-e-2',         name: 'DALL·E 2',          badge: '',       info: 'Classic DALL-E. Multiple output sizes.' },
    ],
    caps: {
      'gpt-image-1':      { sizes:[['1024x1024','1024×1024 (Square)'],['1536x1024','1536×1024 (Landscape)'],['1024x1536','1024×1536 (Portrait)'],['auto','Auto']], qualities:[['auto','Auto'],['high','High'],['medium','Medium'],['low','Low']], formats:true,  steps:false, guidance:false, neg:false, styleMode:false, count:true  },
      'gpt-image-1-mini': { sizes:[['1024x1024','1024×1024 (Square)'],['1536x1024','1536×1024 (Landscape)'],['1024x1536','1024×1536 (Portrait)'],['auto','Auto']], qualities:[['auto','Auto'],['high','High'],['medium','Medium'],['low','Low']], formats:true,  steps:false, guidance:false, neg:false, styleMode:false, count:false },
      'dall-e-3':         { sizes:[['1024x1024','1024×1024 (Square)'],['1792x1024','1792×1024 (Landscape)'],['1024x1792','1024×1792 (Portrait)']],                  qualities:[['standard','Standard'],['hd','HD']],                            formats:false, steps:false, guidance:false, neg:false, styleMode:true,  count:false },
      'dall-e-2':         { sizes:[['256x256','256×256 (Small)'],['512x512','512×512 (Medium)'],['1024x1024','1024×1024 (Large)']],                                  qualities:[],                                                               formats:false, steps:false, guidance:false, neg:false, styleMode:false, count:true  },
    },
  },
  together: {
    label: 'Together AI', color: '#ff6b35', puterKey: 'together',
    models: [
      { id: 'black-forest-labs/FLUX.1-schnell-Free',     name: 'FLUX.1 Schnell',       badge: 'FREE', info: 'Free FLUX model — fast with great quality.'         },
      { id: 'black-forest-labs/FLUX.1-schnell',          name: 'FLUX.1 Schnell Pro',   badge: 'FAST', info: 'Fastest FLUX model with premium features.'           },
      { id: 'black-forest-labs/FLUX.1.1-pro',            name: 'FLUX 1.1 Pro',         badge: 'BEST', info: 'Highest quality FLUX — best for professional use.'   },
      { id: 'black-forest-labs/FLUX.1-dev',              name: 'FLUX.1 Dev',            badge: '',     info: 'Dev model with guidance scale support.'              },
      { id: 'black-forest-labs/FLUX.1-pro',              name: 'FLUX.1 Pro',            badge: 'PRO',  info: 'Pro-tier FLUX with enhanced quality controls.'       },
      { id: 'black-forest-labs/FLUX.1-depth-dev',        name: 'FLUX.1 Depth',          badge: '',     info: 'Depth-aware model for structured scenes.'            },
      { id: 'black-forest-labs/FLUX.1-canny-dev',        name: 'FLUX.1 Canny',          badge: '',     info: 'Edge-guided model for precise composition control.'  },
      { id: 'stabilityai/stable-diffusion-xl-base-1.0',  name: 'SDXL Base 1.0',         badge: '',     info: 'Stable Diffusion XL — powerful open-source model.'   },
      { id: 'stabilityai/stable-diffusion-2-1',          name: 'Stable Diffusion 2.1',  badge: '',     info: 'Classic SD 2.1 with negative prompt support.'        },
      { id: 'SG161222/Realistic_Vision_V3.0_VAE',        name: 'Realistic Vision V3',   badge: '',     info: 'Fine-tuned for photorealistic portraits & scenes.'   },
      { id: 'prompthero/openjourney',                    name: 'OpenJourney v4',         badge: '',     info: 'Midjourney-inspired artistic style model.'           },
      { id: 'wavymulder/Analog-Diffusion',               name: 'Analog Diffusion',       badge: '',     info: 'Vintage analog photography aesthetic.'               },
    ],
    caps: {
      default: {
        sizes: [
          ['512x512','512×512'], ['768x768','768×768 (Square)'], ['1024x1024','1024×1024 (Square)'],
          ['1280x720','1280×720 (16:9 HD)'], ['720x1280','720×1280 (9:16 Portrait)'],
          ['1024x768','1024×768 (4:3)'], ['768x1024','768×1024 (3:4)'],
          ['1536x640','1536×640 (Ultrawide)'], ['640x1536','640×1536 (Tall)'],
        ],
        qualities: [], formats: false, steps: true, guidance: true, neg: true, styleMode: false, count: false,
        stepsRange: [10, 50, 28], guidanceRange: [1, 20, 7.5],
      },
    },
  },
  xai: {
    label: 'xAI / Grok', color: '#d4d4d4', puterKey: 'xai',
    models: [
      { id: 'grok-2-image',      name: 'Grok 2 Image',       badge: 'SMART', info: 'xAI image model with high coherence.'        },
      { id: 'grok-2-image-1212', name: 'Grok 2 Image 1212',  badge: '',      info: 'Updated December 2024 Grok image model.'    },
    ],
    caps: {
      default: {
        sizes: [['1024x1024','1024×1024 (Square)'], ['1792x1024','1792×1024 (Landscape)'], ['1024x1792','1024×1792 (Portrait)']],
        qualities: [], formats: false, steps: false, guidance: false, neg: false, styleMode: false, count: true,
      },
    },
  },
};

/**
 * Map of aspect-ratio labels → best matching resolution string per provider.
 * Used to auto-select the size dropdown when an AR button is clicked.
 */
const AR_SIZE_MAP = {
  'openai-image-generation': {
    '1:1': '1024x1024', '16:9': '1792x1024', '9:16': '1024x1792',
    '4:3': '1024x1024', '3:4': '1024x1792',  '3:2': '1792x1024',
  },
  together: {
    '1:1': '1024x1024', '16:9': '1280x720',  '9:16': '720x1280',
    '4:3': '1024x768',  '3:4': '768x1024',   '3:2': '1024x768',
  },
  xai: {
    '1:1': '1024x1024', '16:9': '1792x1024', '9:16': '1024x1792',
    '4:3': '1024x1024', '3:4': '1024x1792',  '3:2': '1792x1024',
  },
};

// ── Voice registry ─────────────────────────────────────────────────────────
const VOICE_REGISTRY = {
  'aws-polly': {
    voices: [
      ['Joanna','Joanna (F, en-US)'],['Matthew','Matthew (M, en-US)'],['Salli','Salli (F, en-US)'],
      ['Ivy','Ivy (F, en-US)'],['Kendra','Kendra (F, en-US)'],['Kimberly','Kimberly (F, en-US)'],
      ['Ruth','Ruth (F, en-US)'],['Kevin','Kevin (M, en-US)'],['Stephen','Stephen (M, en-US)'],
      ['Gregory','Gregory (M, en-US)'],['Danielle','Danielle (F, en-US)'],
      ['Amy','Amy (F, en-GB)'],['Brian','Brian (M, en-GB)'],['Emma','Emma (F, en-GB)'],['Arthur','Arthur (M, en-GB)'],
      ['Olivia','Olivia (F, en-AU)'],['Celine','Céline (F, fr-FR)'],['Mathieu','Mathieu (M, fr-FR)'],
      ['Lea','Léa (F, fr-FR)'],['Hans','Hans (M, de-DE)'],['Marlene','Marlene (F, de-DE)'],
      ['Vicki','Vicki (F, de-DE)'],['Conchita','Conchita (F, es-ES)'],['Enrique','Enrique (M, es-ES)'],
      ['Lucia','Lucia (F, es-ES)'],['Lupe','Lupe (F, es-US)'],['Miguel','Miguel (M, es-US)'],
      ['Bianca','Bianca (F, it-IT)'],['Giorgio','Giorgio (M, it-IT)'],
      ['Mizuki','Mizuki (F, ja-JP)'],['Takumi','Takumi (M, ja-JP)'],['Zhiyu','Zhiyu (F, cmn-CN)'],
    ],
    engines: [['neural','Neural'],['generative','Generative'],['standard','Standard']],
  },
  'openai': {
    voices: [['alloy','Alloy'],['ash','Ash'],['ballad','Ballad'],['coral','Coral'],['echo','Echo'],['fable','Fable'],['nova','Nova'],['onyx','Onyx'],['sage','Sage'],['shimmer','Shimmer'],['verse','Verse']],
    engines: [['gpt-4o-mini-tts','GPT-4o Mini TTS'],['gpt-4o-audio-preview','GPT-4o Audio Preview'],['tts-1-hd','TTS-1 HD'],['tts-1','TTS-1']],
  },
  'elevenlabs': {
    voices: [
      ['21m00Tcm4TlvDq8ikWAM','Rachel'],['EXAVITQu4vr4xnSDxMaL','Bella'],['MF3mGyEYCl7XYWbV9V6O','Elli'],
      ['TxGEqnHWrfWFTfGW9XjX','Josh'],['VR6AewLTigWG4xSOukaG','Arnold'],['pNInz6obpgDQGcFmaJgB','Adam'],
      ['yoZ06aMxZJJ28mfd3POQ','Sam'],['AZnzlk1XvdvUeBnXmlld','Domi'],['jBpfuIE2acCO8z3wKNLl','Ethan'],
      ['onwK4e9ZLuTAKqWW03F9','Daniel'],['XrExE9yKIg1WjnnlVkGX','Lily'],
    ],
    engines: [['eleven_v3','Eleven V3 (latest)'],['eleven_multilingual_v2','Multilingual V2'],['eleven_flash_v2_5','Flash V2.5'],['eleven_turbo_v2_5','Turbo V2.5'],['eleven_monolingual_v1','Monolingual V1']],
  },
  'playht': {
    voices: [
      ['s3://voice-cloning-zero-shot/d9ff78ba-d016-47f6-b0ef-dd630f59414e/female-cs/manifest.json','Female (US)'],
      ['s3://voice-cloning-zero-shot/6c4bef56-e454-4edd-af22-1e6bd56f4e8c/anthonymundell/manifest.json','Anthony (UK)'],
      ['s3://peregrine-voices/joe wo mixed/manifest.json','Joe'],
      ['s3://peregrine-voices/donna/manifest.json','Donna'],
    ],
    engines: [['PlayHT2.0-turbo','PlayHT2.0 Turbo'],['PlayHT2.0','PlayHT2.0'],['Play3.0-mini','Play3.0 Mini'],['PlayDialog','PlayDialog']],
  },
  'openai-fm': {
    voices: [['alloy','Alloy'],['ash','Ash'],['ballad','Ballad'],['coral','Coral'],['echo','Echo'],['fable','Fable'],['nova','Nova'],['onyx','Onyx'],['sage','Sage'],['shimmer','Shimmer']],
    engines: [['gpt-4o-mini-audio-preview','GPT-4o Mini Audio Preview'],['gpt-4o-audio-preview','GPT-4o Audio Preview']],
  },
};

// ── IDE: language + icon maps ──────────────────────────────────────────────
/** Map file extension → CodeMirror mode string */
const LANG_MAP = {
  js: 'javascript', jsx: 'javascript', mjs: 'javascript',
  ts: 'javascript', tsx: 'javascript',
  py: 'python',
  html: 'htmlmixed', htm: 'htmlmixed',
  css: 'css', scss: 'css', less: 'css',
  json: 'javascript',
  md: 'markdown',
  sh: 'shell', bash: 'shell', zsh: 'shell',
  c: 'clike', cpp: 'clike', h: 'clike', java: 'clike', cs: 'clike',
};

/** Map file extension → emoji icon */
const FILE_ICONS = {
  js: '🟨', jsx: '⚛', ts: '🔷', tsx: '⚛',
  py: '🐍', rb: '💎', php: '🐘', java: '☕',
  html: '🌐', htm: '🌐', css: '🎨', scss: '🎨',
  json: '📋', md: '📝', xml: '📄', yaml: '⚙', yml: '⚙',
  sh: '💻', sql: '🗃', svg: '🖼',
};

/** Get the emoji icon for a filename */
function getFileIcon(name) {
  return FILE_ICONS[name.split('.').pop().toLowerCase()] || '📄';
}

/** Get the CodeMirror language mode for a filename */
function getLang(name) {
  return LANG_MAP[name.split('.').pop().toLowerCase()] || 'null';
}

// ── IDE: starter templates ─────────────────────────────────────────────────
const TEMPLATES = {
  html: [
    {
      name: 'index.html',
      content: `<!DOCTYPE html>
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
</html>`,
    },
    {
      name: 'style.css',
      content: `* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: system-ui, sans-serif; padding: 2rem; background: #0f1117; color: #e8e2d9; min-height: 100vh; }
header { margin-bottom: 2rem; }
h1 { font-size: 2rem; color: #d4a853; }
p  { color: #aaa; margin-bottom: 1rem; }
button { padding: 10px 20px; background: #d4a853; border: none; border-radius: 8px; color: #0f1117; font-weight: 600; cursor: pointer; transition: all .2s; }
button:hover { background: #e0b96a; transform: translateY(-2px); }`,
    },
    {
      name: 'app.js',
      content: `const btn = document.getElementById('btn');
let count = 0;

btn.addEventListener('click', () => {
  count++;
  btn.textContent = \`Clicked \${count} time\${count !== 1 ? 's' : ''}!\`;
  console.log('Button clicked:', count);
});

console.log('App loaded!');`,
    },
  ],

  react: [
    {
      name: 'App.jsx',
      content: `import { useState } from 'react';
import './App.css';

export default function App() {
  const [count, setCount] = useState(0);
  const [items] = useState(['React', 'Vite', 'AI Studio']);

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
}`,
    },
    {
      name: 'App.css',
      content: `.app { font-family: system-ui, sans-serif; max-width: 640px; margin: 0 auto; padding: 2rem; background: #0f1117; color: #e8e2d9; min-height: 100vh; }
h1 { font-size: 2rem; color: #d4a853; margin-bottom: 1.5rem; }
.card { background: #1a1c1e; border: 1px solid #2a2c2e; border-radius: 12px; padding: 1.5rem; }
button { padding: 10px 24px; background: #d4a853; border: none; border-radius: 8px; color: #0f1117; font-weight: 600; cursor: pointer; margin-bottom: 1rem; }
button:hover { background: #e0b96a; }
ul { list-style: none; padding: 0; }
li { padding: 8px 0; border-bottom: 1px solid #2a2c2e; color: #aaa; }`,
    },
    {
      name: 'package.json',
      content: `{
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
}`,
    },
    {
      name: 'vite.config.js',
      content: `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({ plugins: [react()] });`,
    },
    { name: '.gitignore', content: `node_modules/\ndist/\n.env\n.DS_Store` },
  ],

  node: [
    {
      name: 'server.js',
      content: `const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (_req, res) => {
  res.json({ message: 'Hello from Node.js!', timestamp: new Date().toISOString() });
});

app.get('/api/data', (_req, res) => {
  res.json({ items: ['item1', 'item2', 'item3'] });
});

app.post('/api/data', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  res.status(201).json({ created: name, id: Date.now() });
});

app.listen(PORT, () => {
  console.log(\`✅ Server running at http://localhost:\${PORT}\`);
});`,
    },
    {
      name: 'package.json',
      content: `{
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
}`,
    },
    { name: '.env', content: `PORT=3000\n# DATABASE_URL=\n# API_KEY=` },
    { name: '.gitignore', content: `node_modules/\n.env\n*.log\ndist/\n.DS_Store` },
    {
      name: 'README.md',
      content: `# Node.js Server\n\n## Setup\n\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n\n## Endpoints\n\n- \`GET /\` — Health check\n- \`GET /api/data\` — Get items\n- \`POST /api/data\` — Create item\n`,
    },
  ],

  python: [
    {
      name: 'main.py',
      content: `#!/usr/bin/env python3
"""Main application script."""

from utils import greet, add

def main():
    name = input("Enter your name: ")
    print(greet(name))
    print(f"3 + 4 = {add(3, 4)}")

if __name__ == "__main__":
    main()`,
    },
    {
      name: 'utils.py',
      content: `"""Utility functions."""

def greet(name: str) -> str:
    """Return a personalized greeting."""
    return f"Hello, {name}! 🐍"

def add(a: float, b: float) -> float:
    """Add two numbers."""
    return a + b`,
    },
    { name: 'requirements.txt', content: `# Add dependencies here\n# requests==2.31.0\n# flask==3.0.0` },
    { name: '.gitignore', content: `__pycache__/\n*.pyc\n.env\nvenv/\n.venv/\n*.egg-info/\ndist/\n.DS_Store` },
    {
      name: 'README.md',
      content: `# Python Project\n\n## Setup\n\n\`\`\`bash\npython -m venv venv\nsource venv/bin/activate\npip install -r requirements.txt\n\`\`\`\n\n## Run\n\n\`\`\`bash\npython main.py\n\`\`\``,
    },
  ],
};
