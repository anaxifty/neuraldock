# NeuralDock — Deployment Setup Guide

Stack: **Cloudflare Pages** (hosting) + **Supabase** (auth + database)

---

## Step 1 — Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Click **New Project**
3. Choose a name (e.g. `neuraldock`), set a strong DB password, pick the closest region
4. Wait ~2 minutes for the project to provision

---

## Step 2 — Set Up the Database

1. In your Supabase dashboard, click **SQL Editor** in the left sidebar
2. Click **New query**
3. Open the file `supabase-schema.sql` from this repo
4. Paste the entire contents into the editor
5. Click **Run** (bottom right)
6. You should see "Success" — all tables and policies are created

---

## Step 3 — Enable Auth Providers

### GitHub OAuth
1. Go to **Authentication → Providers** in Supabase
2. Enable **GitHub**
3. Go to [github.com/settings/developers](https://github.com/settings/developers)
4. Click **New OAuth App**
   - Application name: `NeuralDock`
   - Homepage URL: `https://your-site.pages.dev`
   - Authorization callback URL: copy from Supabase (looks like `https://xxxx.supabase.co/auth/v1/callback`)
5. Copy the Client ID and Client Secret back into Supabase
6. Save

### Google OAuth
1. Go to **Authentication → Providers** in Supabase
2. Enable **Google**
3. Go to [console.cloud.google.com](https://console.cloud.google.com)
4. Create a project → **APIs & Services → Credentials → Create OAuth Client ID**
   - Application type: Web application
   - Authorized redirect URIs: copy from Supabase
5. Copy Client ID and Client Secret into Supabase
6. Save

### Email/Password
1. Go to **Authentication → Providers**
2. Enable **Email** — it's on by default
3. Optionally disable "Confirm email" during testing (Authentication → Settings → Email)

---

## Step 4 — Get Your Supabase Credentials

1. In Supabase, go to **Settings → API**
2. Copy:
   - **Project URL** — looks like `https://xxxxxxxxxxxx.supabase.co`
   - **anon public** key — the long `eyJ...` string
3. Open `js/supabase.js` in your code editor
4. Replace:
   ```js
   const SUPABASE_URL  = 'YOUR_SUPABASE_PROJECT_URL';
   const SUPABASE_ANON = 'YOUR_SUPABASE_ANON_KEY';
   ```
   with your actual values:
   ```js
   const SUPABASE_URL  = 'https://xxxxxxxxxxxx.supabase.co';
   const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
   ```

---

## Step 5 — Deploy to Cloudflare Pages

1. Push your code to a GitHub repository (if not already):
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/neuraldock.git
   git push -u origin main
   ```

2. Go to [pages.cloudflare.com](https://pages.cloudflare.com)
3. Click **Create a project → Connect to Git**
4. Select your GitHub repo
5. Configure build settings:
   - **Framework preset**: None
   - **Build command**: (leave empty)
   - **Build output directory**: `/` (root)
6. Click **Save and Deploy**
7. Your site will be live at `https://neuraldock.pages.dev` (or similar)

---

## Step 6 — Add Your Site URL to Supabase

1. In Supabase → **Authentication → URL Configuration**
2. Set **Site URL** to your Cloudflare Pages URL (e.g. `https://neuraldock.pages.dev`)
3. Add to **Redirect URLs**: `https://neuraldock.pages.dev/**`
4. If you have a custom domain, add that too

---

## Step 7 — Custom Domain (Optional)

### On Cloudflare Pages:
1. Go to your Pages project → **Custom domains**
2. Click **Set up a custom domain**
3. Enter your domain (e.g. `neuraldock.com`)
4. Follow the DNS instructions (add a CNAME record)

### Update Supabase:
- Add your custom domain to Supabase → Authentication → URL Configuration → Redirect URLs

---

## File Structure

```
/
├── index.html              ← main app
├── style.css               ← all styles
├── _redirects              ← Cloudflare Pages SPA routing
├── netlify.toml            ← (if using Netlify instead)
├── supabase-schema.sql     ← paste into Supabase SQL editor
├── SETUP.md                ← this file
└── js/
    ├── utils.js            ← shared utilities
    ├── config.js           ← model/provider registries
    ├── markdown.js         ← markdown + mermaid rendering
    ├── supabase.js         ← ⚠ ADD YOUR CREDENTIALS HERE
    ├── state.js            ← app state + persistence
    ├── db.js               ← all Supabase database operations
    ├── ui.js               ← tabs, model selector, settings
    ├── conversations.js    ← chat history management
    ├── chat.js             ← AI chat sending + rendering
    ├── image.js            ← image generation
    ├── voice.js            ← TTS + voice input
    ├── ide.js              ← code IDE
    ├── auth.js             ← authentication (Supabase + Puter)
    └── effects.js          ← visual effects
```

---

## How It Works (Architecture)

```
User visits site
      ↓
Supabase Auth checks session
      ↓ (if no session)
Login screen → GitHub / Google / Email
      ↓ (after auth)
Load user data from Supabase (conversations, settings)
      ↓
App boots — Puter banner appears if not connected
      ↓ (user clicks "Connect Puter")
Puter Auth → AI models unlocked
      ↓
All conversations auto-sync to Supabase in background
```

---

## Fallback Mode (No Supabase)

If you haven't filled in the Supabase credentials yet, the app automatically falls back to:
- Original Puter-only login
- localStorage for all data (no cloud sync)
- Everything still works — just no accounts

---

## Free Tier Limits

| Service | Free Limit | Notes |
|---|---|---|
| Cloudflare Pages | Unlimited bandwidth | Best for public apps |
| Supabase Auth | 50,000 MAU | More than enough to start |
| Supabase DB | 500MB storage | ~500k conversations |
| Supabase Storage | 1GB | User file uploads |
| Puter AI | Unlimited | Users bring their own account |

---

## Troubleshooting

**OAuth redirect not working:**
- Make sure the callback URL in GitHub/Google matches exactly what Supabase shows
- Check Supabase → Authentication → URL Configuration has your site URL

**"Invalid API key" error:**
- Double-check you copied the `anon public` key, not the `service_role` key
- The anon key is safe to use in frontend code

**Users stuck on login screen after OAuth:**
- Check browser console for errors
- Make sure `js/supabase.js` has the correct URL and key
- Verify your site URL is in Supabase → Authentication → Redirect URLs

**Conversations not syncing:**
- Open browser console, look for `[db]` warning messages
- Check Supabase → Table Editor → conversations to see if rows are being created
- Make sure RLS policies were created (run the SQL schema again if unsure)
