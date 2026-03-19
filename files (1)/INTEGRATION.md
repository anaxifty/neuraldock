# NeuralDock Theme System — Integration Guide

## File overview

| File | Action |
|------|--------|
| `js/theme.js` | **NEW FILE** — drop into your `js/` folder |
| `js/state.js` | **REPLACE** your existing `js/state.js` with this one |
| `theme-additions.css` | **APPEND** to the bottom of `style.css` |
| `index.html` | Three small patches (below) |
| `js/auth.js` | One small patch (below) |

---

## Patch 1 — index.html: Add script tag

In `index.html`, find the script tags at the bottom and add `theme.js`
**before** `auth.js`:

```html
<!-- ADD THIS LINE — before auth.js -->
<script src="js/theme.js"></script>
<script src="js/auth.js"></script>
```

---

## Patch 2 — index.html: Add Google Font preconnect

In the `<head>` section, add these two lines right after the
`<meta name="viewport">` line:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
```

---

## Patch 3 — js/auth.js: Call applyAllThemeSettings on boot

In `auth.js`, find the `onFullyAuthed` function.
At the TOP of that function body (right after the `if (authPollInterval)` line),
add this call:

```javascript
// Apply all saved theme/font/density settings
if (typeof applyAllThemeSettings === 'function') applyAllThemeSettings();
if (typeof buildAppearanceUI     === 'function') buildAppearanceUI();
```

Also add the same two calls inside `openSettings()` in `ui.js`
so the appearance panel rebuilds when settings are opened:

```javascript
// In ui.js → openSettings() function, add these two lines:
if (typeof buildAppearanceUI === 'function') buildAppearanceUI();
```

---

## Patch 4 — js/ui.js: Add applyAllThemeSettings to applySettingsUI

Find `applySettingsUI()` in `ui.js` and add at the top:

```javascript
function applySettingsUI() {
  // NEW: apply theme settings
  if (typeof applyAllThemeSettings === 'function') applyAllThemeSettings();
  
  // ... rest of existing function unchanged ...
}
```

---

## db.js: Extend dbSaveSettings for cloud sync (optional but recommended)

In `db.js`, inside `dbSaveSettings()`, add the new keys to the upsert object:

```javascript
// Add these 7 lines to the upsert object in dbSaveSettings():
theme:         S.theme,
font_ui:       S.fontUi,
font_head:     S.fontHead,
density:       S.density,
radius:        S.radius,
bg_texture:    S.bgTexture,
bubble_style:  S.bubbleStyle,
```

And in `dbLoadSettings()`, add to the KEYS array:

```javascript
'theme', 'font_ui', 'font_head', 'density', 'radius', 'bg_texture', 'bubble_style',
```

And add the camelCase mapping handling — the existing camelCase converter
(`k.replace(/_([a-z])/g, ...)`) already handles snake_case → camelCase,
so the load side works automatically.

---

## Supabase schema update (optional)

If you want to persist themes to cloud, run this in Supabase SQL Editor:

```sql
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS theme        text DEFAULT 'dark-gold',
  ADD COLUMN IF NOT EXISTS font_ui      text DEFAULT 'dm-mono',
  ADD COLUMN IF NOT EXISTS font_head    text DEFAULT 'fraunces',
  ADD COLUMN IF NOT EXISTS density      text DEFAULT 'comfortable',
  ADD COLUMN IF NOT EXISTS radius       text DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS bg_texture   text DEFAULT 'grid',
  ADD COLUMN IF NOT EXISTS bubble_style text DEFAULT 'default';
```

---

## What each file does

### js/theme.js
- Defines 10 colour themes: Dark Gold, Ocean, Forest, Midnight, Rose, Carbon,
  Nord, Amber, Slate, Light
- Defines 6 UI fonts: DM Mono, JetBrains Mono, Fira Code, IBM Plex Mono,
  Space Mono, Inconsolata
- Defines 6 heading fonts: Fraunces, Playfair Display, DM Serif Display,
  Cormorant Garamond, Lora, Libre Baskerville
- `applyTheme(id)` — sets CSS custom properties on `:root`
- `applyFontUi(id)` — sets `--font-ui`, lazy-loads Google Font
- `applyFontHead(id)` — sets `--font-head`, lazy-loads Google Font
- `applyDensity(id)` — sets `data-density` attribute (compact/comfortable/spacious)
- `applyRadius(id)` — sets `--radius` variable (sharp/default/pill)
- `applyBgTexture(id)` — sets `data-bg-texture` (grid/dots/cross/none)
- `applyBubbleStyle(id)` — sets `data-bubble` (default/minimal/bordered)
- `applyAllThemeSettings()` — call once on boot, applies all S.* values
- `buildAppearanceUI()` — rebuilds the Appearance settings section with
  live theme swatches, font cards, and all option pickers

### theme-additions.css
- `--font-ui` / `--font-head` CSS variable application rules
- Density system: compact / comfortable / spacious padding overrides
- Background textures: dots, cross, none variants
- Bubble styles: minimal, bordered
- Light theme overrides: inverted colors, light CodeMirror, etc.
- All Appearance UI component styles (theme grid, font cards, option rows)

### js/state.js
- Identical to original but with 7 new fields in `S` and in `saveSettings()`

---

## Testing checklist

1. Open Settings → Appearance
2. Click each theme swatch — page should repaint instantly, no layout shift
3. Click a different UI font — code areas should change
4. Click a different heading font — header/logo should change
5. Toggle density — padding should visibly change
6. Toggle radius — corners should go sharp/rounded/pill
7. Toggle texture — background pattern should change
8. Toggle bubble — chat messages should change style
9. Reload page — all settings should persist (localStorage)
10. Light theme: verify all text readable, no dark-on-dark issues
