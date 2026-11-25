# BlogNeo — Your Blog, On Autopilot

BlogNeo is a new, separate SaaS tool (not ContentPilot). A customer connects
their Blogger blog and Pinterest account, picks a niche, and BlogNeo is built
to generate one AI-style SEO article a day, generate images for it, publish
it to Blogger automatically, and publish SEO-optimised pins to Pinterest
automatically. The customer pays a subscription (Pro ৳499/month) for the
daily auto flow.

Live URL (after Vercel deploy): https://blogneo.vercel.app

## What is in this repo

- `index.html` — single-page app: Landing, Dashboard, Article Writer,
  Pin Generator, Connections, Daily Auto Flow, Subscription
- `styles.css` — dark green + gold theme, responsive, mobile-first
- `app.js` — all client-side logic, localStorage demo state, article
  generator, canvas images, pin generator, auto-flow log
- `vercel.json` — static site config, no build step
- `oauth-callback.html` — simple page shown after an OAuth redirect;
  it reads the `code` / `error` from the URL and tells the user to go back
  to BlogNeo Connections and confirm the connection

## Vercel deploy (no build step)

1. Push this folder to a new GitHub repo (for example `blogneo`).
2. In Vercel (account `nayeemahmed33000` — the 33000 account, not 200001):
   Add New Project → Import the GitHub repo.
3. Framework Preset: **Other** (static site).
4. Build Command: leave empty / none. Output Directory: `.` (root).
5. Project name: `blogneo` → live at https://blogneo.vercel.app
6. Deploy. No environment variables, no secrets, no API keys are needed
   for this MVP — everything demo runs in the browser.

## Demo vs real — read this before selling

This MVP is honest about what works in the browser and what needs the
owner's OAuth apps:

**Works now (demo, in the browser, no server):**
- Full UI, all tabs, all buttons do something visible.
- Article Writer generates a real structured SEO article from the topic
  (H1, intro, 4 sections, tips, FAQ, meta description, slug) — generated
  client-side from templates, not from a paid AI API.
- 3 article images are generated on canvas / SVG with the topic text and
  are clearly labelled as generated images.
- Pin Generator makes 3 Pinterest pin designs (1000×1500 canvas),
  SEO title + description + hashtags, board picker.
- Daily Auto Flow (demo): toggle ON, pick a time, "Run Now (demo)"
  generates + publishes one article + pin in the demo and writes a run log.
- Subscription: Free vs Pro ৳499/month, manual bKash/Nagad instructions,
  "I paid" marks Pro as Pending in localStorage.

**Demo only — says so in the UI:**
- "Publish to Blogger" and "Publish to Pinterest" when not connected say:
  "Demo — connect Blogger/Pinterest in Connections to publish for real."
- Connected state in this MVP is stored in localStorage after the user
  confirms; there is no server, no database, and no real Blogger /
  Pinterest API call yet.

## The 2 owner steps still needed for REAL auto-publish

Do NOT invent client IDs. The owner must do these two things; until then
real publishing cannot work for customers:

### 1. Google OAuth Client ID — for Blogger API
- In Google Cloud Console, under the owner's Google account, create an
  OAuth 2.0 Client ID (Web application).
- Add Authorized redirect URI: `https://blogneo.vercel.app/oauth-callback.html`
- Paste that Client ID into BlogNeo → Connections → Owner Settings
  ("Google Client ID"). BlogNeo then builds the real Blogger authorize URL:
  `https://accounts.google.com/o/oauth2/v2/auth` with scope
  `https://www.googleapis.com/auth/blogger`.
- A server / Worker endpoint is still needed later to exchange the OAuth
  code for a token and to call the Blogger API to insert posts. That is
  not in this static MVP.

### 2. Pinterest App ID + approval — for Pinterest API
- In Pinterest Developers, create an app and get its App ID (Client ID).
- Add Redirect URI: `https://blogneo.vercel.app/oauth-callback.html`
- Paste that App ID into BlogNeo → Connections → Owner Settings
  ("Pinterest App ID"). BlogNeo then builds the real Pinterest authorize URL:
  `https://www.pinterest.com/oauth/` with scopes for pins and boards.
- Pinterest must approve the app for the `pins:write` scope before
  customers can auto-publish pins for real. A server endpoint is still
  needed later to exchange the code and call the Pinterest API.

No bKash/Nagad number is printed anywhere in the app — none is on file.
Payment is manual: customer pays ৳499, sends screenshot + BlogNeo email
to nayeemahmed33000@gmail.com, Pro is activated within 24h.

## Pricing (as ordered)

- Free: 1 blog, 3 articles/month, manual pins, no daily auto flow.
- Pro ৳499/month: unlimited blogs, daily auto article, auto pins,
  auto Blogger + Pinterest publish (once the 2 owner steps above are done).
