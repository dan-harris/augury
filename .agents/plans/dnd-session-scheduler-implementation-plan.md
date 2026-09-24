# Augury — Implementation Plan

> Companion to [dnd-session-scheduler-prd.md](./dnd-session-scheduler-prd.md). Investigation findings and a proposed build plan against the existing Astro 7 + Cloudflare + Supabase stack. **Plan only — nothing here is implemented yet.**

## 1. Where the repo is today

- **Astro 7.1** (`astro ^7.1.6`) with **Tailwind CSS v4** (vite plugin), oxlint/oxfmt, husky.
- **Cloudflare adapter already wired for SSR.** Despite "currently only static", `wrangler.jsonc` sets `main: "@astrojs/cloudflare/entrypoints/server"` with an `ASSETS` binding — the app deploys as a **Cloudflare Worker** (Workers-with-assets, not classic Pages). Only `src/pages/index.astro` exists, so every page happens to be prerendered, but the server runtime is already in place.
- No database, no auth, no Supabase project yet. `.agents/plans/` holds the PRD.

### Do we need other Workers?

**No.** The single Astro Worker covers everything server-side we need:

| Need                                                        | Covered by                                                              |
| ----------------------------------------------------------- | ----------------------------------------------------------------------- |
| SSR pages (`/g/<slug>`, `/admin/...`)                       | Astro on-demand routes in the existing Worker                           |
| Mutations (create group/session, submit votes, confirm day) | **Astro Actions** (supported by the Cloudflare adapter)                 |
| Magic-link confirm                                          | An Astro server endpoint (`/auth/confirm`)                              |
| Link unfurling (OG meta per group/session)                  | SSR-rendered `<meta>` tags — already possible                           |
| Real-time vote updates                                      | **Supabase Realtime**, browser → Supabase websocket; no Worker involved |
| Data, auth, RLS                                             | Supabase (Postgres + GoTrue)                                            |

No Durable Objects, no queues, no cron, no separate API Worker. Supabase Realtime replaces the one thing that would otherwise force a Durable Object (live fan-out).

## 2. Architecture decisions

### 2.1 Rendering strategy

Keep Astro's default static output and opt dynamic routes out of prerendering per-page (`export const prerender = false`). The landing page stays static/CDN-cached; everything under `/g/` and `/admin/` is SSR. This beats `output: 'server'` because the marketing/landing surface stays free and fast.

Real-time updates are progressive enhancement: SSR renders current tallies (satisfies "at minimum on reload"), then a client island subscribes to Supabase Realtime for live updates.

### 2.2 Supabase access pattern

- **`@supabase/ssr`** `createServerClient` in Astro middleware (`src/middleware.ts`), bridging cookies via `Astro.cookies` / `context.cookies`. Confirmed working pattern for Astro on Workers (fetch-based client, no Node APIs).
- Store the per-request client + resolved user on `Astro.locals`.
- **All writes go through Astro Actions** using the request-scoped client (anon key + user's cookies). **RLS is the real enforcement layer**; actions add validation and friendly errors. This means a leaked action URL grants nothing RLS wouldn't already allow.
- **Avoid the service-role key entirely in v1.** Public voting writes are handled by a `SECURITY DEFINER` Postgres function (see §3.3) rather than by elevating the Worker's privileges.
- Client-side (islands): `@supabase/supabase-js` with the publishable/anon key, used **read-only** for Realtime subscriptions.

Env vars: `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY` (safe to expose; RLS-guarded). Local dev via `.dev.vars` / `.env`; production via `wrangler secret put` or the Cloudflare dashboard. Run `wrangler types` after adding bindings.

### 2.3 Auth (available site-wide, required only for admin)

- **Supabase Auth with email magic links** — no third-party OAuth provider at all. `supabase.auth.signInWithOtp({ email })` sends a sign-in link; no passwords, no Google/Discord app registration, no consent screens.
- Flow (**PKCE, default email template**): email form → `signInWithOtp` via the `requestMagicLink` action (`@supabase/ssr` writes the PKCE code-verifier cookie) → "check your email" state → the default template's `{{ .ConfirmationURL }}` link verifies at Supabase and redirects to `/auth/confirm?code=…&next=<path>` → server endpoint calls `exchangeCodeForSession(code)`, `@supabase/ssr` sets the cookies, redirects to `next` (validated as a same-origin relative path to prevent open redirects; defaults to `/admin`). PKCE is used because the free tier locks email-template editing while on Supabase's built-in sender; the `token_hash`/`verifyOtp` variant — which drops PKCE's same-browser requirement — is a **post-M5 addition** alongside Resend SMTP (see the M5 plan).
- **Sign-in is available from any page, not just `/admin`.** The shared layout header carries an `AuthMenu` island: signed-out it offers an email form (the action passes the current path as `next`, so a voter signing in from `/g/<slug>/<id>` lands back on that voting page); signed-in it shows the user's email, a sign-out button, and an admin link when relevant. Middleware resolves the session on every request either way — it only _enforces_ auth on `/admin/**`; public routes render both states.
- On the voting page, a signed-in user linked to a player gets that player pre-selected and locked (PRD §4: linked users can't select other players); unlinked signed-in users vote exactly like anonymous ones.
- **Admin invites are magic invite links**: admin generates an invite → row in `admin_invites` with a random `token` → shareable URL `/admin/join?token=…`. Invitee opens it, signs in via the same magic-link flow if needed, and the action consumes the token and inserts their `group_admins` row. No email-matching, no dependency on which address the invitee uses.
- **Email delivery**: Supabase's built-in sender is heavily rate-limited (a couple of emails/hour) and dev-grade, but acceptable at launch — sign-in volume is a handful of admins with long-lived sessions. Custom SMTP (Resend free tier) is a **post-M5 addition** (M5 plan), which also unlocks free-tier email-template editing and with it the `token_hash` flow. Local dev uses the Supabase CLI's bundled Inbucket/Mailpit inbox, so no SMTP needed locally. Flagged in §7.

### 2.4 UI interactivity

**Preact islands from the outset** via `@astrojs/preact` (~4 kB runtime, first-class Astro integration, JSX/hooks). Astro components render everything static (layouts, session cards, history); Preact islands own the interactive surfaces:

- `VotingForm` island — player picker → day multi-select → submit (calls the `submitVotes` action via `astro:actions` client), including the "re-select player to edit existing votes" state machine.
- `LiveTally` island — renders tallies/viability and holds the Supabase Realtime subscription, re-fetching the tally view on change events.
- Admin islands where forms need optimistic/interactive behavior (roster editing, day-picker on session creation); plain Astro `<form>` + actions elsewhere.

Setup: `npx astro add preact` (adds the integration and `jsxImportSource` tsconfig entry). Use `client:load` for the voting form (it's the page's purpose), `client:visible` where sensible.

## 3. Data model (Supabase migrations)

Managed with the Supabase CLI: `supabase/migrations/*.sql`, local stack via `supabase start`, deployed with `supabase db push` (or GitHub integration later).

### 3.1 Tables

```sql
create type session_status as enum ('open', 'confirmed', 'closed');

create table groups (
  id uuid primary key default gen_random_uuid(),
  slug_id text not null unique check (slug_id ~ '^[a-z0-9]{6}$'),  -- stable 6-char id; the ONLY lookup key
  name text not null,
  viability_threshold int not null default 4 check (viability_threshold >= 1),
  created_at timestamptz not null default now()
);

create table group_admins (
  group_id uuid not null references groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (group_id, user_id)
);

-- Allowlist gating who may create groups. Sign-up stays open (magic links
-- double as sign-up, and invited admins need accounts), but a fresh account
-- can do nothing until an existing admin invites them or they're added here.
-- Seeded with the owner in migration 0001; extendable via the Supabase dashboard.
create table group_creators (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table admin_invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  token text not null unique,           -- random, single-use; consumed by /admin/join
  expires_at timestamptz not null,      -- e.g. now() + interval '7 days'
  created_at timestamptz not null default now()
);

create table players (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  name text not null,
  user_id uuid references auth.users(id),   -- optional user↔player link (PRD §2)
  created_at timestamptz not null default now(),
  unique (group_id, name)
);

create table sessions (
  id text primary key,                  -- short public id (nanoid ~10 chars) for /g/<slug>/<id>
  group_id uuid not null references groups(id) on delete cascade,
  week_start date not null,             -- always a Monday; enforce via check (extract(isodow from week_start) = 1)
  candidate_days smallint[] not null,   -- 0=Mon … 6=Sun; check cardinality >= 1
  status session_status not null default 'open',
  confirmed_day smallint,               -- set when status = 'confirmed'
  created_at timestamptz not null default now(),
  check ((status = 'confirmed') = (confirmed_day is not null))
);

-- YES votes only: a row means "player can make this day".
create table votes (
  session_id text not null references sessions(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  day smallint not null,
  primary key (session_id, player_id, day)
);

-- Tracks who has responded (distinguishes "voted all-no" from "hasn't voted").
create table vote_responses (
  session_id text not null references sessions(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  updated_at timestamptz not null default now(),
  primary key (session_id, player_id)
);
```

Modeling notes:

- **Slug = slug-name + slug-id.** The full URL slug is `slugify(name)-{slug_id}` (e.g. `dungeons-and-dads-8efc4d`), composed at render time — never stored. Routes parse the **trailing 6-char slug-id** from the URL and look up by `slug_id` alone; the name part is cosmetic. Consequences: group renames are fully safe (old links still resolve via slug-id; optionally 301 to the canonical slug when the name part is stale), and no global uniqueness constraint on names is needed. Generate slug-ids with a 6-char lowercase-alphanumeric nanoid (ambiguity-reduced alphabet), retry on the (rare) unique-violation.
- **Sessions are not keyed by week** (PRD resolved decision #1) — overlapping sessions per week are naturally allowed. Short text ids keep `/g/<slug>/<id>` URLs pasteable.
- **"available" is not a stored state.** PRD §6 lists open → available → confirmed/closed, but "available" is fully derived (any day's yes-count ≥ threshold). Storing it invites drift; compute it in the tally view.
- **Yes-rows-only votes** make tallying trivial (`count(*) group by day`) and make Realtime events meaningful (insert = new yes, delete = retracted). `vote_responses` covers the "hasn't voted yet" social-pressure list.
- Threshold lives on `groups` (resolved decision #2); the session tally view joins it at read time, so mid-vote threshold edits reflect immediately — PRD's "surface how it affects viability" is a UI concern.

### 3.2 Views

```sql
-- One row per (session, candidate day): yes-count, voter ids, viable flag.
create view session_day_tallies with (security_invoker = true) as
select s.id as session_id, d.day,
       count(v.player_id) as yes_count,
       coalesce(array_agg(v.player_id) filter (where v.player_id is not null), '{}') as voter_ids,
       count(v.player_id) >= g.viability_threshold as viable
from sessions s
join groups g on g.id = s.group_id
cross join lateral unnest(s.candidate_days) as d(day)
left join votes v on v.session_id = s.id and v.day = d.day
group by s.id, d.day, g.viability_threshold;
```

"Best day" (most votes, earliest-in-week tiebreak) is a one-line `order by yes_count desc, day asc limit 1` on this view — compute in the page, not the DB.

### 3.3 Vote submission RPC

Anonymous voting must atomically replace a player's vote-set and enforce invariants the anon role can't be trusted with. One `SECURITY DEFINER` function, callable by `anon`:

```sql
create function submit_votes(p_session_id text, p_player_id uuid, p_days smallint[])
returns void language plpgsql security definer set search_path = public as $$
begin
  -- 1. session exists and status = 'open'         → else raise
  -- 2. player belongs to the session's group      → else raise
  -- 3. p_days ⊆ session.candidate_days            → else raise
  -- 4. delete existing votes for (session, player); insert new rows
  -- 5. upsert vote_responses (session, player, now())
end $$;
```

This is the **only** write path anonymous users have. Direct `insert`/`update`/`delete` on `votes` is denied to `anon` — the trust model ("nothing stops picking someone else's name") stays intact, but the structural invariants (open session, roster player, candidate day) become unforgeable.

### 3.4 Trigger-enforced invariants

- **Last-admin guard**: `before delete on group_admins` — raise if it's the group's final row (PRD hard rule).
- **Confirm/close locks votes**: `submit_votes` already checks `status = 'open'`; no separate trigger needed since it's the only write path.
- Roster removal warning ("player has votes in open sessions") is an **application-level check** in the delete action, not a DB constraint — the PRD wants a warn-and-confirm, not a block.

### 3.5 RLS policy matrix

RLS enabled on every table. `is_group_admin(group_id)` helper: `exists (select 1 from group_admins where group_id = $1 and user_id = auth.uid())` (`security definer` to avoid recursive-policy pitfalls on `group_admins` itself).

| Table            | `select`                               | `insert`                                       | `update`                   | `delete`                                     |
| ---------------- | -------------------------------------- | ---------------------------------------------- | -------------------------- | -------------------------------------------- |
| `groups`         | public (all data is public per PRD §4) | ✗ (`create_group` RPC only, allowlist-gated)   | admin                      | admin                                        |
| `group_admins`   | admin of that group                    | ✗ (RPCs only: `create_group`, `accept_invite`) | —                          | admin (trigger blocks last admin)            |
| `group_creators` | own row (to show/hide the create UI)   | ✗ (seeded by migration / dashboard only)       | —                          | —                                            |
| `admin_invites`  | admin                                  | admin                                          | —                          | admin (revoke) + consumed by `accept_invite` |
| `players`        | public                                 | admin                                          | admin                      | admin                                        |
| `sessions`       | public                                 | admin                                          | admin (confirm/close/edit) | admin                                        |
| `votes`          | public                                 | ✗ (RPC only)                                   | ✗                          | ✗ (RPC only)                                 |
| `vote_responses` | public                                 | ✗ (RPC only)                                   | ✗ (RPC only)               | —                                            |

Group creation nuance: "creating user becomes first admin" needs `groups` insert + `group_admins` insert to be atomic → a small `create_group(name)` RPC (security definer) that first checks `auth.uid()` is in `group_creators` (raise otherwise), then does both inserts and returns the `slug_id`. Invite acceptance is a second small RPC, `accept_invite(token)` — validates token + expiry, inserts the `group_admins` row for `auth.uid()`, deletes the invite.

Account/role summary: **sign-up is open** (magic link creates the account on first sign-in — required for the invite flow and harmless since a bare account grants nothing); **admin is per-group** (`group_admins` row, gained by creating a group or accepting an invite — no global role); **group creation is allowlisted** (`group_creators`, seeded with the owner). `/admin` hides the create-group UI for non-allowlisted users and just shows their groups (empty state: "ask a group admin for an invite link").

### 3.6 Realtime

- Add `votes`, `vote_responses`, and `sessions` to the `supabase_realtime` publication.
- Session page island subscribes to `postgres_changes` filtered by `session_id`; on any event, re-fetch the tally view for that session (simpler and more robust than patching state from raw change payloads).
- Group home page can subscribe to `sessions` changes (status flips to confirmed) — nice-to-have, reload is acceptable there.

## 4. Route map

All dynamic routes: `export const prerender = false`.

| Route                        | File                                          | Auth    | Purpose                                                                                                                 |
| ---------------------------- | --------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------- |
| `/`                          | `src/pages/index.astro` (replace placeholder) | —       | Landing; link to `/admin`                                                                                               |
| `/auth/confirm`              | `src/pages/auth/confirm.ts`                   | —       | Magic-link landing: `verifyOtp(token_hash)`, set cookies, redirect to validated `next` path                             |
| `/auth/signout`              | `src/pages/auth/signout.ts`                   | ✓       | Clear session                                                                                                           |
| `/admin`                     | `src/pages/admin/index.astro`                 | ✓       | Sign-in gate (email → magic link); list my groups; create group                                                         |
| `/admin/join`                | `src/pages/admin/join.astro`                  | ✓       | Accept invite token → become group admin (prompts sign-in first if needed)                                              |
| `/admin/[groupSlug]`         | `src/pages/admin/[groupSlug]/index.astro`     | ✓ admin | Roster CRUD, admins, threshold, session list, share link                                                                |
| `/admin/[groupSlug]/create`  | `src/pages/admin/[groupSlug]/create.astro`    | ✓ admin | New session; defaults from previous session's candidate days                                                            |
| `/g/[groupSlug]`             | `src/pages/g/[groupSlug]/index.astro`         | —       | Group home: open sessions + viability at a glance, confirmed days, history; optional link-my-player for signed-in users |
| `/g/[groupSlug]/[sessionId]` | `src/pages/g/[groupSlug]/[sessionId].astro`   | —       | Voting page: pick player → toggle days → submit; live tally; confirmed banner when locked                               |

All `[groupSlug]` params are parsed by taking the trailing 6-char slug-id (everything after the last hyphen); lookup is by `slug_id` only, with a 301 to the canonical slug when the name part is stale.

Astro Actions (`src/actions/index.ts`): `requestMagicLink`, `createGroup`, `updateGroup` (name/threshold), `addPlayer`, `renamePlayer`, `removePlayer` (two-step when open-session votes exist), `createInvite`, `revokeInvite`, `acceptInvite`, `removeAdmin`, `createSession`, `updateSession`, `confirmSession`, `closeSession`, `submitVotes` (wraps the RPC), `linkPlayerToUser`.

Supporting modules:

- `src/middleware.ts` — per-request Supabase server client, `locals.user`, `/admin/**` guard.
- `src/lib/supabase/server.ts` / `browser.ts` — client factories.
- `src/lib/viability.ts` — best-day suggestion, "3 of 4 needed" copy, closest-day-when-nothing-viable.
- `src/lib/weeks.ts` — week-window helpers (Monday-anchored, `Intl` day names, "week of 29 Sept" formatting).
- `src/lib/slugs.ts` — slugify names, generate 6-char slug-ids, compose `slugify(name)-{slug_id}`, parse slug-id from a route param.
- `src/components/` — static Astro components (`SessionCard`, `VoterList`, `OgMeta`, layout pieces); `src/components/islands/` — Preact islands (`VotingForm`, `LiveTally`, `DayPicker`, `PlayerPicker`, `AuthMenu` in the shared layout header, admin forms).

### Link unfurling (PRD non-functional)

SSR `<meta property="og:*">` on `/g/**`: group name + open-session count on the group page; group name, week window, and live status ("2 viable days · 4/6 voted") on session pages. Discord unfurls og:title/description without JS. Dynamic OG **images** (satori/resvg on the Worker) are a stretch goal — text unfurls satisfy the requirement.

## 5. Build milestones

Each milestone is shippable and testable on its own. **Each has a detailed, self-contained plan file for implementation sessions**: [M1](./dnd-session-scheduler-m1-foundations.md) · [M2](./dnd-session-scheduler-m2-groups-roster.md) · [M3](./dnd-session-scheduler-m3-sessions-voting.md) · [M4](./dnd-session-scheduler-m4-lifecycle-realtime.md) · [M5](./dnd-session-scheduler-m5-polish.md). M1's plan includes the manual Supabase setup steps (project creation, auth config, env vars, SMTP).

1. **M1 — Foundations.** Supabase project (cloud) + CLI local stack; migration 0001 (schema, RLS, RPCs, triggers, view, realtime publication); env plumbing (`.dev.vars`, wrangler secrets, `wrangler types`); `@astrojs/preact` integration; middleware + client factories; magic-link auth end-to-end (header `AuthMenu` email form → emailed link → `/auth/confirm` → back to the originating page via `next`), using the local CLI inbox for dev. _Exit: an authenticated user can hit `/admin` and see an empty group list backed by real queries._
2. **M2 — Groups & roster.** `createGroup` RPC + action (slug-id generation), `/admin` group list, `/admin/[groupSlug]` roster CRUD, threshold config, invite links (`createInvite` → `/admin/join` → `accept_invite` RPC) and admin removal (with last-admin guard surfaced), public `/g/[groupSlug]` shell with share link and slug-id routing. _Exit: create "Dungeons and Dads", add 6 players, open the public link at `/g/dungeons-and-dads-8efc4d`, and a second account joins as admin via an invite link._
3. **M3 — Sessions & voting.** Session creation with previous-session defaults; session voting page (player picker → day multi-select → `submitVotes`); re-select player shows existing votes for editing; signed-in users linked to a player get it pre-selected and locked; tally view rendering with viability highlighting, best-day suggestion, voted/not-voted lists. _Exit: full vote round-trip on mobile viewport, no auth, under 30 seconds; a signed-in linked user lands on the page with their player already selected._
4. **M4 — Lifecycle & realtime.** Confirm/close actions with locked-session UI; confirmed day prominent on session + group pages; history section (past + closed sessions); Realtime island on the session page; threshold/day edits surfacing viability impact. _Exit: two browsers open, a vote in one appears in the other without refresh; admin confirms Thursday and both pages reflect it._
5. **M5 — Polish.** OG meta tags verified in Discord; mobile-first pass over all pages; empty/error states ("nothing viable yet — Thursday is closest at 3 of 4"); landing page replacing the boilerplate; `AGENTS.md` notes for Supabase local dev.

## 6. Testing & tooling

- **DB-level**: pgTAP via `supabase test db` for RLS policies, `submit_votes` invariants, and the last-admin trigger — this is where the security actually lives, so it gets the most test attention.
- **App-level**: Vitest for `viability.ts` / `weeks.ts` pure logic. Playwright smoke (vote round-trip against local Supabase) as a later addition.
- **CI**: existing Cloudflare build; add `supabase db push` as a manual/scripted deploy step initially (automate later).

## 7. Risks

All previously open questions are resolved (auth = Supabase magic links, no third-party OAuth; invites = magic invite links; weeks = ISO Monday-start, noted in the PRD; slugs = name + stable 6-char slug-id). Remaining risks to watch:

1. **Magic-link email delivery** — Supabase's built-in sender is rate-limited to a couple of emails/hour and not production-grade. Accepted at launch (admin-only sign-in, long-lived refresh tokens keep round-trips rare); the post-M5 addition in the M5 plan wires Resend SMTP, which also unlocks template editing and the `token_hash` flow. Pull it forward if sign-ins bounce off the rate limit. Local dev uses the CLI's bundled inbox so this only affects deployed environments.
2. **Auth cookie size on Workers** — `@supabase/ssr` chunks large cookies; verified pattern on Cloudflare, but test the `/auth/confirm` flow early in M1 (it's the usual place this stack bites).
3. **Supabase free-tier realtime limits** — 200 concurrent connections; a friend group won't dent it, just don't leave the island subscribed on hidden tabs indefinitely (pause on `visibilitychange` if it ever matters).
4. **Magic-link sign-in friction** — an email round-trip per sign-in is slower than OAuth. Acceptable because admin sessions are long-lived (refresh tokens keep admins signed in for months); if it grates, an OAuth provider can be added later without schema changes.
5. **Magic links, PKCE, and in-app browsers** — the PKCE flow requires the emailed link to be opened in the **same browser** that requested it (the code verifier lives in a cookie). A voter who signs in from a Discord/WhatsApp in-app browser and opens the email in the system browser fails the code exchange — `/auth/confirm` shows a friendly "request a new link from this browser" error, never a broken session. Harmless for voting (auth is optional); mitigation is copy, admins doing real work will be in a proper browser, and the post-M5 `token_hash` flow removes the same-browser requirement entirely.

## 8. Explicitly not needed (answering the setup questions)

- **No extra Cloudflare Workers** — the existing Astro Worker + Supabase covers SSR, actions, the magic-link confirm endpoint, and unfurling; Realtime is browser↔Supabase.
- **No Cloudflare KV/DO/D1** — Postgres is the single store; Astro's session feature stays unused (`@supabase/ssr` cookies carry auth state), so the adapter's KV session driver never gets wired.
- **No third-party OAuth provider** — Supabase Auth's built-in email magic links are the whole admin identity story; no Google/Discord app registration anywhere.
- **No service-role key in the Worker** — RLS + three security-definer RPCs (`create_group`, `accept_invite`, `submit_votes`) keep the anon key sufficient.
