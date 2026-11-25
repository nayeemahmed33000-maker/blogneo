# BlogNeo — Your Blog, On Autopilot

BlogNeo is a subscription SaaS: a customer connects their Blogger blog and
Pinterest account, picks a niche, and BlogNeo generates one AI SEO article
a day, generates a cover image, publishes it to Blogger automatically, and
publishes SEO pins to Pinterest automatically. Pro costs ৳499/month (manual
bKash/Nagad payment — no online checkout, Stripe/PayPal are unavailable
from Bangladesh).

Live site: https://blogneo.vercel.app
API server: https://blogneo-api.nayeemahmed33000.workers.dev
GitHub: https://github.com/nayeemahmed33000-maker/blogneo
Backend source: ~/workspace/blogneo-api/src/index.js
Deploy script: ~/workspace/blogneo-api/deploy.py

## v3 — Fast Login + Mail Verification (2026-11-25)

- **Fast login (frontend first screen)** — clean light login card:
  big BlogNeo logo, "Continue with Google" (1 tap), divider, Email +
  Password, Login / Create Account toggle, Remember Me (checked by
  default), "Continue as guest (demo)". Top nav shows Login when logged
  out, the user's email + Logout when logged in. After login → Dashboard.
  No page reload, no heavy images.
- **Backend auth** — POST /api/auth/signup, POST /api/auth/login,
  GET /api/auth/me, POST /api/auth/logout. Users table in D1 (email
  unique, salted SHA-256 password hash via WebCrypto — NEVER plain text),
  sessions table (token stored hashed, 30-day expiry). Login returns a
  Bearer session token; the device is linked to the account (devices
  table gets email + user_id + plan) so articles/runs/auto-settings
  follow the account. Guest demo still works, labelled "Guest demo —
  your work is saved only in this browser".
- **Mail verification** — signup does NOT activate the account.
  POST /api/auth/send-code and POST /api/auth/verify: 6-digit code,
  stored only as a SHA-256 hash, 10-minute expiry, 3 attempts max.
  Login with an unverified account returns 403 "Please verify your
  email first" and re-sends the code. After verification the user is
  auto-logged in. Sending uses MailChannels (Cloudflare Workers free
  email sending, no API key) — see sending status below.
- **Continue with Google** — GET /api/auth/google/status,
  GET /api/auth/google, GET /api/auth/google/callback (reuses the
  Blogger Google OAuth client, openid/email/profile scopes). Returns
  an honest 503 "Google sign-in is not configured yet" until
  GOOGLE_CLIENT_ID/SECRET are set — never faked.

## Email sending status — VERIFIED LIVE 2026-11-25 (BLOCKED, owner step)

- **MailChannels (free, no key): BLOCKED.** Live test from the Worker
  returns `401 Authorization Required` (same from a shell test).
  MailChannels now needs a DKIM-verified sending domain; BlogNeo has no
  custom domain on Cloudflare, so the unauthenticated path is closed.
  The signup/login/verify endpoints and UI are complete and honest
  about this — they never claim a code "was sent" when it was not.
- **Owner step (free, ~5 min): Resend.** Create a free Resend account
  (100 emails/day, no card), copy the API key, set it as Worker secret
  `RESEND_API_KEY` on `blogneo-api`. The Worker then sends via Resend
  from `onboarding@resend.dev` (no domain verification needed on the
  free tier). No code change needed — the Worker checks for the secret
  first and falls back to MailChannels only when it is absent.
- Until the key is set, a new user can sign up but cannot receive the
  code by email, so they cannot verify or log in. That is the one
  remaining login blocker.

## v2 — what is REAL now (verified 2026-11-25)

- **Real AI article** — POST /api/generate-article calls Cloudflare
  Workers AI (free tier), model `@cf/meta/llama-3.3-70b-instruct-fp8-fast`.
  Verified live: 1,061-word article with H1, linked table of contents,
  4 H2 sections, FAQs, meta description and slug. The frontend uses the
  template generator ONLY as a labelled offline fallback when the AI call
  fails — never passed off as AI.
- **Real AI cover image** — Workers AI `@cf/black-forest-labs/flux-1-schnell`.
  Verified live: a real AI image came back with the article (278 KB base64).
  If the image model fails, the frontend uses labelled canvas placeholders.
- **Real AI pin copy** — POST /api/pins returns 5 AI pin concepts.
  Verified live.
- **D1 storage** — database `blogneo-db`: devices, connections, auto
  settings, articles, runs, oauth_states. Dashboard stats, auto settings
  and run log now come from the backend, not localStorage.
- **Pro gating (server-side)** — the daily auto run and the manual
  /api/cron/run-now run only for devices with plan='pro'. Free devices get
  HTTP 403. Verified live.
- **Daily auto flow (server code)** — the Worker's `scheduled()` handler
  runs for every Pro device with Auto Flow ON: generate 1 real AI article
  for the niche, publish to Blogger if connected, publish a pin if
  Pinterest is connected, log the run in D1.
- **Blogger OAuth + publish (code-complete)** — GET /api/blogger/auth,
  GET /api/blogger/callback (code exchange, AES-GCM token storage,
  blog detection), GET /api/blogger/blogs, POST /api/blogger/publish
  (with token refresh). Same proven patterns as ContentPilot.
- **Pinterest OAuth + publish (code-complete)** — GET /api/pinterest/auth,
  GET /api/pinterest/callback, POST /api/pinterest/publish (media upload
  then pin create, pins:write scope).

## What is still BLOCKED — owner steps (nothing else is missing)

### 1. Blogger — needs Google OAuth secrets (BLOCKER)
The Worker reports `google_configured: false`. The ContentPilot Google
OAuth client exists (Google Cloud project "ContentPilot", Blogger API
enabled, OAuth app IN PRODUCTION), but its client ID/secret values cannot
be read from the ContentPilot Worker — secrets are write-only. So the
owner must supply them once, through the secure entry flow:
- Secret names on Worker `blogneo-api`: `GOOGLE_CLIENT_ID`,
  `GOOGLE_CLIENT_SECRET` (set with the Cloudflare API / dashboard).
- In the SAME Google Cloud OAuth client, add this Authorized redirect URI:
  `https://blogneo-api.nayeemahmed33000.workers.dev/api/blogger/callback`
  (If the ContentPilot client cannot take another redirect URI, create a
  new OAuth client in the same project and supply its ID/secret instead.)
- After the secrets are set, test: open the BlogNeo Connections page and
  click Connect Blogger — it must open Google's authorize page, and after
  approval the Dashboard must show Blogger: Connected.

### 2. Pinterest — needs a Pinterest app (BLOCKER, the one remaining app)
No Pinterest App ID exists anywhere verifiable: the ContentPilot Worker
has no Pinterest secrets, and no App ID is on file. Steps:
- Create an app at Pinterest Developers, request the `pins:write` scope
  (and `boards:read`, `pins:read`), wait for Pinterest approval.
- Add this redirect URI in the Pinterest app:
  `https://blogneo-api.nayeemahmed33000.workers.dev/api/pinterest/callback`
- Set Worker secrets `PINTEREST_CLIENT_ID` and `PINTEREST_CLIENT_SECRET`
  on Worker `blogneo-api`.
- After that, Connect Pinterest in BlogNeo must open Pinterest's authorize
  page and the Dashboard must show Pinterest: Connected.

### 3. Daily Cron Trigger — dashboard step (API currently rejects it)
The Worker code has the `scheduled()` handler ready, but the Cloudflare
schedules PUT endpoint currently rejects every body shape with error
10026 (verified 2026-11-25 on blogneo-api AND on contentpilot, whose
working schedule was set on 2026-11-14 — the endpoint changed since).
Until the trigger is set, the daily run can be started manually from the
BlogNeo Daily Auto Flow page ("Run Now", Pro only) — it runs the exact
same server code path. Dashboard step: Cloudflare dashboard → Workers &
Pages → blogneo-api → Settings → Triggers → Add Cron Trigger:
`0 2 * * *` (02:00 UTC = 08:00 Asia/Dhaka).

### 4. Pro activation — manual, as designed
A customer marks "I paid" → plan becomes `pro-pending` in D1. The owner
activates Pro after confirming the bKash/Nagad payment by running a D1
update on database `blogneo-db` (uuid in deploy.py / Cloudflare dashboard):
`UPDATE devices SET plan='pro' WHERE device_id='<the customer device id>'`
(List pro-pending devices with
`SELECT device_id, email FROM devices WHERE plan='pro-pending'`.)

## Notes

- **Model change (2026-11-25):** `@cf/meta/llama-3.1-8b-instruct-fp8`
  was deprecated by Cloudflare on 2026-11-20 (API error 5028). BlogNeo
  uses `@cf/meta/llama-3.3-70b-instruct-fp8-fast` instead. ContentPilot
  still uses the deprecated model — its AI generation is very likely
  broken the same way now; that is a separate fix, not done here.
- **Word counts vary:** verified articles came back at 1,061 words and
  at 3,180 words for the same prompt shape — the 70B model sometimes
  overshoots the 1,000–1,600 target. Generation takes 20–70 seconds.
- **Workers AI free tier:** no key, no payment. If the free allowance is
  ever exhausted, /api/generate-article returns an error and the frontend
  falls back to the labelled offline template.
- **No secrets in this repo.** OAuth client IDs/secrets and the token
  encryption key live only as Cloudflare Worker secrets on `blogneo-api`.
  `TOKEN_ENCRYPTION_KEY` was generated during deploy and is not stored
  anywhere in files.

## Frontend files

- `index.html` — single-page app: Landing, Dashboard, Article Writer,
  Pin Generator, Connections, Daily Auto Flow, Subscription
- `styles.css` — dark green + gold theme, responsive, mobile-first
- `app.js` — calls the BlogNeo API; device UUID per browser
  (`X-BlogNeo-Device` header); template article generator is the labelled
  offline fallback only
- `vercel.json` — static site config, no build step
- `oauth-callback.html` — legacy landing page; v2 OAuth callbacks go to
  the API Worker, which redirects back to the site with ?connected=...

## Vercel deploy

Push this folder to GitHub repo `nayeemahmed33000-maker/blogneo` (the
Vercel project `blogneo` is already connected to it and auto-deploys).
Framework Preset: Other (static). No build command, no env vars.
