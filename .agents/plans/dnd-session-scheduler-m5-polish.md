# Augury M5 — Polish & Launch

> Milestone 5 of 5. Parent docs: [PRD](./dnd-session-scheduler-prd.md) · [implementation plan](./dnd-session-scheduler-implementation-plan.md).
> **Prerequisites: [M4](./dnd-session-scheduler-m4-lifecycle-realtime.md) complete** — the app is functionally done; this milestone makes it presentable and deployable for real use.

## Goal

Link unfurling, a mobile-first pass, empty/error states, a real landing page, and production readiness (SMTP, secrets, deploy).

**Exit criteria:**

- [ ] Pasting a group link and a session link into Discord unfurls with meaningful title/description (session: group name, week window, live status like "2 viable days · 4/6 voted").
- [ ] Every page is comfortable at 375px width; the vote flow is thumb-friendly (large tap targets, no horizontal scroll).
- [ ] All empty/error states have real copy — no raw errors or blank sections anywhere in the main flows.
- [ ] The landing page explains the product.
- [ ] Deployed to `augury.danharris.dev` against the cloud Supabase project; a real magic-link sign-in works in production (built-in sender is fine for launch — SMTP is the post-M5 section).
- [ ] `AGENTS.md` documents Supabase local dev for future sessions.

## Tasks

### 1. Link unfurling (PRD non-functional)

- `src/components/OgMeta.astro` — `og:title`, `og:description`, `og:url`, `twitter:card` (summary); used by the shared layout with per-page props.
- `/g/[groupSlug]` — title: group name; description: "N sessions open for voting".
- `/g/[groupSlug]/[sessionId]` — title: "<Group> — week of 29 Sept"; description from live tally state ("2 viable days · 4/6 voted", "Confirmed: Thursday", "Closed").
- These pages are SSR so the meta is live per-request — no extra work for freshness. Dynamic OG **images** (satori/resvg) are a stretch goal; skip unless everything else is done.
- Verify with Discord's actual unfurler (paste in a real channel) — cached previews may need a cache-busting query param while iterating.

### 2. Mobile-first pass

- Audit every route at 375×667: voting page first (it's the product), then group home, then admin.
- Tap targets ≥44px on `DayPicker`/`PlayerPicker`; sticky submit button on the voting form if the day list scrolls.
- The under-30-seconds vote flow (PRD) re-timed on a real phone against the deployed site.

### 3. Empty & error states

- Group home with no sessions; session with no votes; nothing-viable state ("nothing viable yet — Thursday is closest at 3 of 4" via `viability.ts`); `/admin` for a user with no groups and no allowlist entry ("ask a group admin for an invite link").
- Action failures surface as inline messages, not unhandled rejections: expired invite token, magic-link `verifyOtp` failure ("link expired — request a new one"), unique-name violation on players, last-admin removal.
- 404 page for unknown slugs/session ids.
- In-app-browser / same-browser copy (parent-plan risk #5): on the "check your email" state, hint to open the link in the same browser — with the PKCE flow a link opened elsewhere fails the code exchange outright, so the `/auth/confirm` error state (built in M1) must read as "request a new link from this browser", not as a bug.

### 4. Landing page

- Replace the boilerplate `src/pages/index.astro`: what Augury is (one paragraph, the PRD's problem statement condensed), how it works (create group → share link → players vote → confirm a day), sign-in pointer to the header, footer link to the repo. Keep it prerendered.

### 5. Production readiness (manual steps flagged inline)

- Launch runs on Supabase's **built-in email sender** (~2 emails/hour, dev-grade) — accepted for now because sign-in volume is a handful of admins with long-lived refresh tokens. Custom SMTP is the post-M5 section below; pull it forward if sign-ins bounce off the rate limit during launch testing.
- **Manual:** confirm Auth URL configuration matches production (`https://augury.danharris.dev` site URL + redirect allow-list). No email-template changes exist to port — the app uses the default Magic Link template (PKCE flow, M1).
- `supabase db push` the accumulated migrations to the cloud project; run the allowlist seed (M1 manual step 8) against cloud.
- Confirm `PUBLIC_SUPABASE_URL` / `PUBLIC_SUPABASE_ANON_KEY` production values are in `wrangler.jsonc` `vars` and present at build time; `npm run deploy`.
- Smoke-test production: sign in, create a real group, vote from a phone via a Discord-shared link.

### 6. Docs

- `AGENTS.md` additions: `supabase start`/`stop`/`status`, where the local inbox lives, `supabase test db`, `supabase gen types typescript --local` after schema changes, migration conventions (new numbered files, never edit pushed ones), and the env-var table (`.env` + `.dev.vars` for local, `wrangler.jsonc` vars for prod).
- Optional stretch: Playwright smoke test (vote round-trip against the local stack) wired as an npm script — only if time allows; it's listed as a later addition in the parent plan.

## Verification

1. Exit-criteria walk on production with a real phone and a real Discord channel.
2. Lighthouse mobile run on `/g/**` pages — no regressions from islands (Preact runtime should keep JS tiny).
3. Full local suite one last time: `supabase test db`, Vitest, `npm run lint`, `npm run format:check`, `npm run build`.

## Post-M5 addition — custom SMTP (Resend) + `token_hash` flow

Not part of the M5 exit bar. Do this after launch, or sooner if the built-in sender's ~2 emails/hour rate limit bites. It fixes two things at once: production-grade email delivery, and — because custom SMTP unlocks email-template editing on the free tier — the ability to switch from PKCE to the `token_hash` flow, removing the "open the link in the same browser" limitation.

**Manual steps:**

1. Create a free [Resend](https://resend.com) account, verify the sending domain (`danharris.dev`), create an API key.
2. Supabase dashboard → Authentication → Emails → SMTP Settings: enable custom SMTP — host `smtp.resend.com`, port 465, user `resend`, password = the API key; sender like `augury@danharris.dev`. Send a test email.
3. The Templates tab is now editable. In the Magic Link template, replace the link with:

   ```html
   <a
     href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next={{ .RedirectTo }}"
     >Sign in to Augury</a
   >
   ```

**Agent tasks:**

- Switch `/auth/confirm` from `exchangeCodeForSession(code)` to `verifyOtp({ token_hash, type })`, reading `token_hash`, `type`, and `next` (the `next` validation is unchanged). Keep the `code` branch during rollout if in-flight emails matter (links expire within an hour, so a brief dual-read is enough — then delete the PKCE branch).
- `requestMagicLink`'s `emailRedirectTo` becomes just the raw `next` path resolved against the origin (it now feeds `{{ .RedirectTo }}` in the template rather than being the landing URL itself) — verify against the allow-list behavior.
- Mirror the template locally: `supabase/config.toml` gets `[auth.email.template.magic_link]` with `content_path = "./supabase/templates/magic_link.html"`, and that file carries the same link shape, so local and cloud stay one code path.
- Soften the same-browser copy from M5 task 3 (the constraint disappears; a link can now be opened on any device).
- Update parent-plan risk #1/#5 notes and `AGENTS.md` if they still describe the PKCE-era behavior.
