# AI Studio

A free, browser-based AI platform powered by [Puter.js](https://js.puter.com) — no API keys, no backend, no build step required. Sign in with a free Puter account and get instant access to GPT-4o, Claude, Gemini, Llama, DeepSeek, Mistral, Grok, and more.

## Features

- **Chat** — Full conversation memory, DeepThink mode (step-by-step reasoning via DeepSeek R1), Web Search toggle, voice input via microphone, and per-conversation persistence in localStorage.
- **Code** — Dedicated coding assistant with a programming-optimized system prompt and streamed responses with syntax-highlighted code blocks.
- **Image** — AI image generation via OpenAI (DALL-E 3, GPT Image), Together AI (FLUX), or xAI (Grok). Style presets for quick prompt enhancement.
- **Voice** — Text-to-speech via AWS Polly, OpenAI TTS, or ElevenLabs.
- **Sidebar** — Conversation history grouped by Today / Yesterday / Last 7 Days / Older, with per-item delete and a New Chat button.
- **Model Selector** — Color-coded provider dropdown with 30+ models.
- **Settings** — Font size, temperature, system prompt, speak-responses toggle, export to JSON, clear all history.

## File Structure

```
index.html   — HTML shell: structure, CDN links, no inline styles or logic
style.css    — All CSS: variables, layout, components, animations, responsive
app.js       — All JavaScript: auth, sidebar, chat, image, voice, settings, toasts
README.md    — This file
```

## Running Locally

No build tools required. Simply open `index.html` in any modern browser:

```bash
# Option 1: Direct file open
open index.html

# Option 2: Simple local server (avoids any CORS quirks)
npx serve .
# or
python3 -m http.server 8080
```

## Deployment

### Netlify (drag-and-drop)
1. Go to [app.netlify.com](https://app.netlify.com) → "Add new site" → "Deploy manually"
2. Drag the project folder onto the deploy area
3. Done — Netlify auto-detects the static site

Add a `netlify.toml` for SPA routing:
```toml
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### Vercel
```bash
npm i -g vercel
vercel
```

Add a `vercel.json`:
```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

### GitHub Pages
1. Push the project to a GitHub repository
2. Go to **Settings → Pages → Source** → select `main` branch, root folder
3. Your site is live at `https://<username>.github.io/<repo>`

## Tech Stack

- [Puter.js](https://js.puter.com/v2/) — AI inference (chat, image, TTS), auth
- [marked.js](https://cdn.jsdelivr.net/npm/marked/) — Markdown rendering
- [highlight.js](https://cdnjs.cloudflare.com/ajax/libs/highlight.js/) — Code syntax highlighting
- [Google Fonts](https://fonts.google.com) — DM Mono + Fraunces
- Vanilla JS, no framework, no bundler
