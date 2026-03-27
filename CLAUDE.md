# CLAUDE.md — NeuralDock AI Studio

> Project context file for Claude (and any AI assistant) working on this codebase.
> Keep this file updated as the project evolves.

---

## Project Overview

**NeuralDock** is a fully client-side, single-page AI Studio web app with no build step.
It provides Chat, Code IDE, Image Generation, and Voice/TTS tabs — all powered by **Puter.js** for free AI model access, with optional **Supabase** for auth and cloud sync.

Live stack: **Cloudflare Pages** (hosting) + **Supabase** (auth + DB) + **Puter.js** (AI runtime).

---

## Architecture

### No Build Step
This is a **vanilla HTML/CSS/JS** project. There is no Webpack, Vite, or npm involved for the app itself. All dependencies are loaded from CDN inside `index.html`. Never suggest adding a bundler unless explicitly asked.

### File Load Order (critical)
Scripts in `index.html` must be loaded in this exact order — each depends on the previous:

```
utils.js       → no deps, must be first
config.js      → no deps
markdown.js    → depends on CDN globals (marked, hljs, katex, mermaid)
supabase.js    → Supabase client init
state.js       → app state (S object), depends on nothing
db.js          → all Supabase DB ops, depends on supabase.js + state.js
ui.js          → tabs, model selector, settings drawer
conversations.js → CRUD + sidebar, depends on ui.js + state.js
chat.js        → AI chat, depends on markdown.js + conversations.js
image.js       → image generation, depends on config.js + state.js
voice.js       → TTS + voice input, depends on config.js + state.js
ide.js         → Code IDE, depends on all above
ide-panels.js  → IDE panel resize/collapse, depends on ide.js
ide-terminal.js → xterm.js terminal, depends on ide.js + ide-panels.js
theme.js       → theming system, depends on state.js
auth.js        → auth (Supabase + Puter), must be LAST before effects.js
effects.js     → visual effects, no deps
```

### Global State Object (`S`)
The single source of truth lives in `js/state.js` as `const S = { ... }`.
- Persisted to `localStorage` immediately on every change via `saveSettings()` and `saveConvs()`
- Debounced sync to Supabase via `db.js` functions
- Never replace `S` — always mutate its properties in place

### Key Globals (available everywhere after load)
- `S` — application state
- `puter` — Puter.js SDK (AI calls, FS, KV, auth)
- `MODELS` — chat model registry (mutable — fetchAndMergeModels appends to it)
- `IMAGE_PROVIDERS` — image model registry
- `TEMPLATES` — IDE starter templates
- `IDE` — IDE module state object
- `escHtml()`, `toast()`, `relativeTime()`, `autoResize()` — utility functions

---

## Module Responsibilities

### `js/state.js`
- Defines `S` (global state)
- `saveSettings()` — saves to localStorage + triggers `dbSaveSettings()`
- `saveConvs(convId?)` — saves to localStorage + triggers `dbSaveConversation()`
- `updateCtxIndicator()` — no-op stub, kept for call-site compatibility

### `js/db.js`
- All Supabase DB operations (profiles, settings, conversations, IDE projects, images)
- Falls back gracefully when Supabase is not configured
- Uses `debounceSync()` internally — never call DB functions in tight loops
- Key functions: `dbUpsertProfile`, `dbLoadSettings`, `dbSaveSettings`, `dbLoadConversations`, `dbSaveConversation`, `dbDeleteConversation`, `dbSaveIdeProject`, `dbSignOut`

### `js/auth.js`
- Two auth systems work in parallel:
  1. **Supabase Auth** — NeuralDock account (GitHub/Google/Email). Stores data in DB.
  2. **Puter Auth** — required for all AI model calls. Free Puter account.
- If Supabase is not configured → falls back to Puter-only mode (original behaviour)
- `onFullyAuthed(user)` bootstraps the entire app after both auth systems are ready
- The Puter banner appears if user is Supabase-authed but hasn't connected Puter yet

### `js/ui.js`
- Client-side routing via `history.pushState` — routes: `/chat`, `/code`, `/image`, `/voice`
- `activateTab(tab)` — switches tab + updates URL
- `getModelInfo(id)` — looks up model metadata from `MODELS` registry
- `fetchAndMergeModels()` — fetches model list from Puter and merges into `MODELS`
- Settings drawer is full-screen (like claude.ai/settings), not a sidebar panel
- `buildAppearanceUI()` in `theme.js` dynamically renders the appearance section

### `js/chat.js`
- `sendChat()` — reads input, calls `sendChatWith(text, attachments)`
- `sendChatWith()` — builds messages array, calls `puter.ai.chat()` with streaming
- Supports multimodal (images + text) via `image_url` content parts
- Web search: adds `tools: [{ type: 'web_search_20250305', name: 'web_search' }]` to opts
- DeepThink mode: forces model to `deepseek/deepseek-r1`
- `rewriteWithModel()` — rewrites a specific assistant message with a different model
- Message action bar (Copy, Rewrite, Other model, three-dot menu) is built per-message
- Global popups (`_pickerEl`, `_menuEl`) are body-level `position:fixed` elements

### `js/conversations.js`
- `newChat()` — creates new conv, sets `S.activeConvId`
- `loadConv(id)` — loads messages from `S.conversations[id]` into `S.chatMessages`
- `persistConversation(userText, assistantText)` — saves after each AI reply
- `autoTitleConv()` — calls `gpt-4o-mini` to generate a short title after first message
- `renderSidebar()` — groups convs by Pinned / Today / Yesterday / Last 7 Days / Older

### `js/ide.js`
- `IDE` object holds all IDE state (files, activeFile, CodeMirror instance, AI messages, etc.)
- **Puter FS**: every file auto-syncs to `~/NeuralDock-IDE/<projectName>/` via `puter.fs`
- **Puter KV**: AI chat history persisted per project via `puter.kv`
- **File ops**: AI can create/modify/delete/rename files using `<nd_file_op>` XML tags in responses
- `parseFileOps(text)` + `applyFileOp(op)` handle the file operation pipeline
- `_renderFileOpCards()` renders interactive apply/preview cards in the AI panel
- CodeMirror uses the custom `aistudio` theme defined in `style.css`
- `ideOnTabActivated()` is called by `ui.js` when switching to the code tab — always flushes CM content

### `js/theme.js`
- **Safe to remove**: deleting this file and its `<script>` tag restores original dark-gold appearance
- Applies via CSS custom properties on `:root` — never touches other JS
- `applyAllThemeSettings()` — called early in `onFullyAuthed()` before any rendering
- `THEMES` object has 100+ themes organised into `THEME_GROUPS`
- `buildAppearanceUI()` injects the full appearance settings section dynamically

### `js/markdown.js`
- Wraps `marked`, `hljs`, `katex`, and `mermaid`
- `renderMarkdown(text)` — protects math → parses markdown → restores math → augments code blocks
- `renderMermaidBlocks(container)` — async, uses `data-rendered` guard to avoid double-rendering

### `js/voice.js`
- TTS via `puter.ai.txt2speech()` with provider/voice/engine options
- Voice input via browser `SpeechRecognition` API
- Live voice conversation: record → `puter.ai.transcribe()` → `puter.ai.chat()` → TTS playback

### `js/image.js`
- Three providers: `openai-image-generation`, `together`, `xai`
- `updateImageCaps()` shows/hides controls based on model capabilities
- Prompt enhancement via `gpt-4o-mini`
- `generateImage()` calls `puter.ai.txt2img()` with provider-specific options

---

## Supabase Schema

Five tables (see `supabase-schema.sql`):
1. `profiles` — extends `auth.users`, auto-created via trigger on signup
2. `user_settings` — one row per user, upserted on settings change
3. `conversations` — stores messages as JSONB array
4. `ide_projects` — stores files as JSONB object
5. `generated_images` — log of generated images

All tables have **Row Level Security** enabled. Users can only read/write their own data.

### Supabase Configuration
Credentials live in `js/supabase.js`:
```js
const SUPABASE_URL  = 'https://oxlqyzdbsmltiiiqaife.supabase.co';
const SUPABASE_ANON = 'eyJ...';
```
`supabaseConfigured()` returns `false` if credentials are still placeholders → app runs in Puter-only mode.

---

## CSS Architecture

All styles are in `style.css` (single file, ~4500 lines). Additional IDE panel styles are in `ide-panels.css`.

### CSS Custom Properties (theme variables)
```css
--bg, --surface, --surface2       /* backgrounds */
--border, --border-focus           /* borders */
--accent, --accent2, --accent-dim  /* gold accent colours */
--text, --muted                    /* text */
--err, --ok                        /* status colours */
--radius                           /* border radius (controlled by theme.js) */
--font-ui, --font-head             /* fonts (controlled by theme.js) */
```

### Data Attributes Used for Styling
- `data-font-size="small|medium|large"` on `<html>`
- `data-theme="..."` on `<html>` (set by theme.js)
- `data-density="compact|comfortable|spacious"` on `<html>`
- `data-radius="sharp|default|pill"` on `<html>`
- `data-bg-texture="grid|dots|cross|none"` on `<html>`
- `data-bubble="default|minimal|bordered"` on `<html>`
- `data-light-theme` attribute on `<html>` for light theme overrides

### Z-Index Layers
```
10   — sidebar
200  — header (above tab-nav, so model dropdown renders on top)
300  — canvas panel overlay + panel
500  — IDE AI panel (mobile: fixed overlay)
600  — toasts
800  — settings overlay + live voice overlay
900  — global popups (model picker, message menu dropdown)
1000 — share modal, login screen
1100 — shortcuts modal
9999 — IDE modal (confirm dialogs)
```

---

## Key Patterns & Conventions

### AI Calls (Puter)
```js
// Streaming chat
const resp = await puter.ai.chat(messages, { model: 'gpt-4o', stream: true, temperature: 0.7 });
for await (const part of resp) {
  const text = part?.text || part?.message?.content || '';
}

// Non-streaming
const resp = await puter.ai.chat(messages, { model: 'gpt-4o-mini', stream: false });
const text = typeof resp === 'string' ? resp : resp?.message?.content || '';

// Image generation
const image = await puter.ai.txt2img({ prompt, provider: 'openai-image-generation', model: 'dall-e-3' });
const src = image.src || image.url;

// TTS
const audio = await puter.ai.txt2speech(text, { provider: 'openai', model: 'tts-1', voice: 'alloy' });
audio.play();

// Transcription
const result = await puter.ai.transcribe(audioBlob);
const text = typeof result === 'string' ? result : result?.text || '';
```

### HTML Escaping
Always use `escHtml(str)` before inserting user content into `innerHTML`. Never use template literals with raw user data in `innerHTML`.

### Toasts
```js
toast('Message');           // success (green left border)
toast('Error msg', 'error'); // error (red)
toast('Info', 'info');       // info
```

### Modals (IDE)
Use `ideModal({ title, message, input?, confirmLabel, cancelLabel })` — returns a Promise. Returns `true`/value on confirm, `null` on cancel. Never use native `confirm()` or `prompt()`.

### Debounced Sync
`debounceSync(key, fn, delay)` in `db.js` batches frequent saves. The key is unique per resource (e.g., `'conv_' + conv.id`).

### CodeMirror Refresh
After any layout change (panel resize, tab switch, etc.), always call:
```js
requestAnimationFrame(() => requestAnimationFrame(() => { IDE.cm?.refresh(); }));
```
Double rAF is intentional — ensures the DOM has fully painted.

---

## IDE File Operations (AI Protocol)

The IDE AI assistant uses XML tags to perform file operations. The system prompt defines this protocol. When parsing AI responses:

1. `parseFileOps(text)` extracts all `<nd_file_op>` tags
2. `stripFileOps(text)` removes them from the visible markdown
3. `_renderFileOpCards(ops, container)` renders interactive Apply/Preview cards
4. `applyFileOp(op)` applies a single operation (create/modify/delete/rename)

All file operations also sync to Puter FS via `pfsSave()`, `pfsDelete()`, `pfsRename()`.

---

## Common Gotchas

1. **Model dropdown z-index**: The model dropdown must be `z-index: 9999` to render above everything including settings overlay and canvas panel. The header is `z-index: 200` for the same reason.

2. **CodeMirror height**: `#ide-monaco .CodeMirror` must have `height: 100%`. The flex chain from `.ide-editor-body` → `#ide-monaco` → `.CodeMirror` must all have `height: 100%` or `flex: 1` with `min-height: 0`.

3. **Streaming abort**: Check `S.abortStream` (chat) or `IDE.abortIde` (IDE AI) in the async iterator loop before processing each chunk. Never rely on cancelling the Puter promise itself.

4. **Tab activation and CM**: `ideOnTabActivated()` must handle both cases — CM already initialised (flush + refresh) and CM not yet initialised (create). The old pattern of `if (IDE.cm) IDE.cm.refresh(); else ideOnTabActivated()` caused stale content bugs.

5. **Puter auth check**: Always wrap in try/catch — `puter.auth.isSignedIn()` can throw if Puter SDK isn't ready.

6. **Message action bar opacity**: `.msg-actions` has `opacity: 0` by default and becomes visible on `.message:hover`. Both the bar and its buttons must be in the DOM before hover triggers.

7. **Global popup positioning**: `_pickerEl` and `_menuEl` are appended to `document.body` once and repositioned via `positionPopup()`. They must not be inside any `overflow: hidden` container.

8. **localStorage key names**:
   - `aistudio_convs` — conversations JSON
   - `aistudio_settings` — settings JSON
   - `nd_ide_panels` — IDE panel sizes/state

9. **Puter FS path**: IDE files live at `NeuralDock-IDE/<projectName>/<filename>`. No leading slash.

10. **Theme removal**: `theme.js` is designed to be fully removable. It only uses `document.documentElement.style.setProperty()` and `setAttribute()`. No other file imports from it.

---

## Development Workflow

Since there is no build step:
1. Edit files directly
2. Hard-refresh the browser (`Ctrl+Shift+R`)
3. Check browser console for errors
4. For Supabase changes, run SQL in Supabase Dashboard → SQL Editor

### Testing Supabase Locally
The Supabase credentials are hardcoded in `js/supabase.js`. There is no `.env` file. For local dev, either use the same project or replace with a local Supabase instance URL.

### Deployment
Push to GitHub → Cloudflare Pages auto-deploys. No build command. Output directory is `/` (root).

```
Build command:    (empty)
Build output:     /
```

---

## Feature Flags / Modes

| Condition | Behaviour |
|-----------|-----------|
| `supabaseConfigured()` returns `false` | Puter-only mode, localStorage only, no accounts |
| `supabaseConfigured()` returns `true` + Puter not signed in | App loads, Puter banner shown, AI features locked |
| Both authed | Full feature set |
| `S.deepThink = true` | Forces model to `deepseek/deepseek-r1`, disables web search |
| `S.webSearch = true` | Adds web_search tool to Puter chat call, disables DeepThink |
| `S.memoryEnabled = false` | Only last message sent as context (no history) |

---

## Extending the Project

### Adding a New Chat Model
Add to the appropriate provider group in `MODELS` array in `js/config.js`:
```js
{ id: 'provider/model-name', name: 'Display Name', tag: 'SMART' }
```
Tags: `'FREE'` | `'FAST'` | `'SMART'` | `'CODE'` | `''`

### Adding a New Image Provider
Add to `IMAGE_PROVIDERS` in `js/config.js` with a `caps` object defining which controls to show. Add corresponding AR mappings to `AR_SIZE_MAP`.

### Adding a New Theme
Add to the `_T` object in `js/theme.js` using either:
- `{ label, bg, main, sec, isLight? }` — auto-derives all 12 CSS vars
- `{ label, manual: { '--bg': ..., '--accent': ..., ... } }` — fully manual

Then add the theme ID to the appropriate group in `THEME_GROUPS`.

### Adding a New Settings Section
1. Add a `<button class="sp-nav-item" data-section="my-section">` in the nav
2. Add a `<section class="sp-section" id="sp-my-section">` in the content area
3. Wire up in `applySettingsUI()` and `openSettings()` if needed

---

## File Map

```
/
├── index.html              ← entire app HTML, all CDN imports, all tab panels
├── style.css               ← all styles (~4500 lines, single file)
├── ide-panels.css          ← IDE panel resize/toggle styles
├── _redirects              ← Cloudflare Pages SPA fallback (/* → /index.html 200)
├── supabase-schema.sql     ← paste into Supabase SQL Editor to set up DB
├── SETUP.md                ← deployment guide
├── CLAUDE.md               ← this file
└── js/
    ├── utils.js            ← escHtml, toast, relativeTime, autoResize, file readers
    ├── config.js           ← MODELS, IMAGE_PROVIDERS, VOICE_REGISTRY, TEMPLATES, LANG_MAP
    ├── markdown.js         ← renderMarkdown, renderMermaidBlocks
    ├── supabase.js         ← ⚠ Supabase credentials live here
    ├── state.js            ← S (global state), saveSettings, saveConvs
    ├── db.js               ← all Supabase DB operations
    ├── ui.js               ← tabs/routing, model selector, settings, canvas panel
    ├── conversations.js    ← conversation CRUD, sidebar rendering
    ├── chat.js             ← AI chat, streaming, message rendering, action bar
    ├── image.js            ← image generation, provider/model UI
    ├── voice.js            ← TTS, voice input, live voice conversation
    ├── ide.js              ← IDE core, CodeMirror, Puter FS/KV, AI file ops
    ├── ide-panels.js       ← resizable/collapsible IDE panels
    ├── ide-terminal.js     ← xterm.js terminal (JS runner + Puter Terminal launcher)
    ├── theme.js            ← theming system (safe to remove)
    ├── auth.js             ← Supabase Auth + Puter Auth orchestration
    └── effects.js          ← login particles, ripple, cursor glow, placeholder cycling
```
