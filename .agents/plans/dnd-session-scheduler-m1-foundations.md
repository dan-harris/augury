# Augury M1 — Foundations

> Milestone 1 of 5. Parent docs: [PRD](./dnd-session-scheduler-prd.md) · [implementation plan](./dnd-session-scheduler-implementation-plan.md) (architecture rationale lives there — read §2–§3 before starting).
> **Prerequisites: none.** This is the first implementation milestone.

## Goal

Supabase project (cloud + local CLI stack), the full database migration (schema, RLS, RPCs, triggers, tally view, realtime publication), env plumbing, Preact integration, Supabase middleware/client factories, and magic-link auth working end-to-end from the site header.

**Exit criteria:**

- [ ] `supabase start` runs the local stack; migration 0001 applies cleanly; pgTAP tests pass via `supabase test db`.
- [ ] An unauthenticated user on any page can enter their email in the header `AuthMenu`, click the link in the local dev inbox, land on `/auth/confirm`, and be redirected back to the page they started on, signed in.
- [ ] An authenticated user can hit `/admin` and see an empty group list backed by a real Supabase query.
- [ ] `/admin/**` redirects unauthenticated users to `/admin`'s sign-in state; public routes render fine signed-out.
- [ ] Auth round-trip verified via `npm run preview` (wrangler dev, workerd runtime) — this validates cookie handling on Workers (risk #2 in the parent plan).

## Manual setup steps (human required)

These need dashboard access / accounts and cannot be done by an agent. Do them first — everything else blocks on the env values.

1. **Create the Supabase cloud project** at <https://supabase.com/dashboard> (free tier, pick a nearby region, e.g. Sydney). Record:
   - Project ref (in the project URL)
   - `Project URL` → becomes `PUBLIC_SUPABASE_URL`
   - `anon` / `publishable` API key → becomes `PUBLIC_SUPABASE_ANON_KEY`
   - Do **not** put the `service_role` / secret key anywhere in this repo — the design never uses it.
2. **Install prerequisites locally**: Docker Desktop (the local Supabase stack runs in containers) and the Supabase CLI (`brew install supabase/tap/supabase`), then `supabase login`.
3. **Auth URL configuration** (cloud dashboard → Authentication → URL Configuration):
   - Site URL: `https://augury.danharris.dev`
   - Redirect allow-list: `https://augury.danharris.dev/**` and `http://localhost:4321/**`
4. **No email-template customization needed (deliberate).** New free-tier projects on Supabase's built-in sender cannot edit email templates (anti-phishing restriction; custom SMTP would unlock it). Instead of setting up SMTP now, the app uses the **default Magic Link template** — its `{{ .ConfirmationURL }}` link — with the **PKCE code-exchange flow** (agent task 6). Accepted trade-off: the emailed link must be opened in the **same browser** that requested it (the PKCE code verifier lives in a cookie); opening it elsewhere fails with a clear error, not a broken session. The Resend SMTP setup + `token_hash` flow that removes this limitation is documented as a **post-M5 addition** in the [M5 plan](./dnd-session-scheduler-m5-polish.md).
5. **Local env file**: create `.env` (Vite/Astro reads it for dev + build) and `.dev.vars` (wrangler reads it for `npm run preview`) — same two values in both. Ensure both files are gitignored. For local dev use the **local stack's** values from `supabase status` (URL `http://127.0.0.1:54321` + the local anon key), not the cloud project's.

   ```sh
   PUBLIC_SUPABASE_URL=...
   PUBLIC_SUPABASE_ANON_KEY=...
   ```

6. **Production env** (can wait until first deploy): both values are public-by-design (RLS is the guard), so add them as plain `vars` in `wrangler.jsonc` with the cloud project's values. They must also be present at **build time** (Astro inlines `PUBLIC_*` into client code), which the local `.env` covers since `npm run deploy` builds locally.
7. **Custom SMTP — deferred to post-M5.** Launch runs on Supabase's built-in sender (~2 emails/hour, dev-grade) — tolerable because sign-in volume is a handful of admins with long-lived sessions. The Resend setup lives in the M5 plan's post-M5 section. Local dev needs no SMTP either way — the CLI bundles a Mailpit/Inbucket inbox (URL shown by `supabase status`, typically `http://127.0.0.1:54324`).
8. **Allowlist seeding** (after first sign-in): migration 0001 cannot seed `group_creators` because your `auth.users` row won't exist until you first sign in. After signing in once (cloud or local), insert your user id into `group_creators` via the SQL editor / `psql`:

   ```sql
   insert into group_creators (user_id) select id from auth.users where email = 'me.danharris@gmail.com';
   ```

## Agent tasks

Follow repo conventions: dev server via `astro dev --background` (see `AGENTS.md`), run `npm ci` after dependency changes to verify the lockfile, `npm run lint` / `npm run format` before committing.

### 1. Dependencies & integrations

- `npm install @supabase/ssr @supabase/supabase-js nanoid`
- `npx astro add preact` (adds `@astrojs/preact` + tsconfig `jsxImportSource`)
- Run `npm ci` to confirm lockfile sync; run `npm run generate-types` after any wrangler config change.

### 2. Supabase project scaffold

- `supabase init` (creates `supabase/config.toml`), then `supabase link --project-ref <ref>` (needs manual step 1–2 done).
- In `config.toml`: set `auth.site_url = "http://localhost:4321"` and add `http://localhost:4321/**` to `additional_redirect_urls`. **No template customization** — the default Magic Link template's `{{ .ConfirmationURL }}` is exactly what the PKCE flow consumes, and keeping local identical to cloud (where the free tier locks templates) means one code path.

### 3. Migration 0001 — the whole database

One file: `supabase/migrations/0001_init.sql`. The schema SQL below is normative (from the parent plan §3.1–§3.2); RPC/trigger/policy specs follow.

```sql
create type session_status as enum ('open', 'confirmed', 'closed');

create table groups (
  id uuid primary key default gen_random_uuid(),
  slug_id text not null unique check (slug_id ~ '^[a-z0-9]{6}$'),
  name text not null,
  viability_threshold int not null default 4 check (viability_threshold >= 1),
  created_at timestamptz not null default now()
);

create table group_admins (
  group_id uuid not null references groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (group_id, user_id)
);

create table group_creators (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table admin_invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table players (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  name text not null,
  user_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (group_id, name)
);

create table sessions (
  id text primary key,                  -- short public id (nanoid ~10 chars), generated app-side
  group_id uuid not null references groups(id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),
  candidate_days smallint[] not null check (cardinality(candidate_days) >= 1),
  status session_status not null default 'open',
  confirmed_day smallint,
  created_at timestamptz not null default now(),
  check ((status = 'confirmed') = (confirmed_day is not null))
);

create table votes (
  session_id text not null references sessions(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  day smallint not null,
  primary key (session_id, player_id, day)
);

create table vote_responses (
  session_id text not null references sessions(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  updated_at timestamptz not null default now(),
  primary key (session_id, player_id)
);

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

**Helper function** — `is_group_admin(p_group_id uuid) returns boolean`, `security definer`, `stable`, `set search_path = public`: `exists (select 1 from group_admins where group_id = p_group_id and user_id = auth.uid())`. Security definer avoids recursive-policy issues on `group_admins` itself.

**RLS** — `alter table … enable row level security` on all seven tables, then policies per this matrix (no policy = denied):

| Table            | select                     | insert               | update               | delete                     |
| ---------------- | -------------------------- | -------------------- | -------------------- | -------------------------- |
| `groups`         | `true` (public)            | —                    | `is_group_admin(id)` | `is_group_admin(id)`       |
| `group_admins`   | `is_group_admin(group_id)` | —                    | —                    | `is_group_admin(group_id)` |
| `group_creators` | `user_id = auth.uid()`     | —                    | —                    | —                          |
| `admin_invites`  | admin                      | admin (`with check`) | —                    | admin                      |
| `players`        | `true`                     | admin                | admin                | admin                      |
| `sessions`       | `true`                     | admin                | admin                | admin                      |
| `votes`          | `true`                     | —                    | —                    | —                          |
| `vote_responses` | `true`                     | —                    | —                    | —                          |

Writes marked `—` happen only through the security-definer RPCs below (or dashboard, for `group_creators`).

**RPCs** — all `security definer`, `set search_path = public`; `revoke execute … from public` then grant explicitly:

- `create_group(p_name text) returns text` — grant to `authenticated`. Raise unless `auth.uid()` is in `group_creators`. Generate a 6-char lowercase-alphanumeric `slug_id` in a retry loop on unique violation (use an ambiguity-reduced alphabet, e.g. `23456789abcdefghjkmnpqrstuvwxyz`). Insert `groups` row + `group_admins (group_id, auth.uid())` atomically; return the `slug_id`.
- `accept_invite(p_token text) returns uuid` — grant to `authenticated`. Look up the invite; raise if missing or `expires_at < now()`. Insert `group_admins (group_id, auth.uid())` (`on conflict do nothing` — re-clicking is fine), delete the invite row, return `group_id`.
- `submit_votes(p_session_id text, p_player_id uuid, p_days smallint[]) returns void` — grant to `anon, authenticated`. Raise unless: session exists with `status = 'open'`; player belongs to the session's group; `p_days <@ session.candidate_days`. Then delete existing `votes` for (session, player), insert one row per day, upsert `vote_responses` with `updated_at = now()`.

**Trigger** — `before delete on group_admins`: raise if the row being deleted is the group's last admin (PRD hard rule: ≥1 admin always).

**Realtime** — `alter publication supabase_realtime add table votes, vote_responses, sessions;`

### 4. pgTAP tests

`supabase/tests/` run by `supabase test db`. Minimum coverage (this is where the security lives):

- anon cannot insert/update/delete `votes`, `vote_responses`, `groups`, `players`, `sessions` directly.
- `submit_votes` rejects: closed session, player from another group, day not in `candidate_days`; and correctly replaces a vote-set.
- `create_group` raises for a non-allowlisted user; creates group + first admin for an allowlisted one.
- `accept_invite` rejects expired/unknown tokens; consumes the token.
- Last-admin delete raises; deleting a non-last admin succeeds.

### 5. App plumbing

- `src/lib/supabase/server.ts` — `createServerClient` factory (from `@supabase/ssr`) bridging `Astro.cookies` (`getAll`/`setAll` pattern).
- `src/lib/supabase/browser.ts` — `createBrowserClient` singleton for islands (Realtime later; unused-but-present is fine in M1).
- `src/middleware.ts` — per-request server client on `locals.supabase`, resolved user on `locals.user` (use `auth.getUser()`, not `getSession()`, for server-side trust). Enforce auth **only** on `/admin/**` (redirect signed-out users to `/admin`, which renders the sign-in state); every other route resolves the session but never blocks. Add the `App.Locals` types in `src/env.d.ts`.
- Generate DB types: `supabase gen types typescript --local > src/lib/supabase/types.ts` and thread through both client factories.

### 6. Auth flow

- **Flow shape (PKCE, default template):** `signInWithOtp` (server-side, `@supabase/ssr` defaults to PKCE and writes the code-verifier cookie) → email's `{{ .ConfirmationURL }}` link verifies at Supabase's `/auth/v1/verify` → Supabase redirects to our `emailRedirectTo` with `?code=` appended → `/auth/confirm` exchanges the code for a session.
- **Action** `requestMagicLink` (`src/actions/index.ts`): input `{ email, next }` (`next` = the caller's current path); calls `signInWithOtp({ email, options: { emailRedirectTo } })` where `emailRedirectTo = new URL('/auth/confirm?next=' + encodeURIComponent(next), url.origin).toString()` — this URL must be covered by the redirect allow-list (manual step 3 / `config.toml`).
- **Endpoint** `src/pages/auth/confirm.ts` (`prerender = false`): read `code` + `next`; call `exchangeCodeForSession(code)`; on success redirect to the validated `next` — **validation**: parse it, accept only a same-origin relative path (`/...`, not `//...`, no scheme), else fall back to `/admin`. On failure (expired link, or opened in a different browser so the verifier cookie is absent) render an error state with a "request a new link" affordance and a "open the link in the same browser you started in" hint. _(Post-M5, once Resend SMTP unlocks template editing, this endpoint gains the `token_hash`/`verifyOtp` variant — see the M5 plan's post-M5 section.)_
- **Endpoint** `src/pages/auth/signout.ts` — POST, `auth.signOut()`, redirect to `/`.
- **Island** `src/components/islands/AuthMenu.tsx` — lives in the shared layout header on every page. Signed-out: email input → `requestMagicLink` (via `astro:actions` client, passing `location.pathname` as `next`) → "check your email" state. Signed-in: user email, sign-out button, link to `/admin`. Receives initial user state as a prop from the layout (SSR), so no client-side auth fetch on load.
- **Layout** `src/layouts/Layout.astro` — shared shell with the header carrying `AuthMenu`; used by all pages from now on.

### 7. Pages

- `/admin` (`src/pages/admin/index.astro`, `prerender = false`) — signed-out: sign-in prompt (the header form is the mechanism, the page just says so). Signed-in: query `group_admins`-joined groups for the user and render the (empty, for now) list. Create-group UI is **M2** — but do query `group_creators` for the current user so the empty state can already differ ("create your first group" vs "ask an admin for an invite link").
- Keep `/` static; just make it use the new layout so the header/AuthMenu is present.

## Verification

1. `supabase start` + `supabase test db` — all green.
2. `astro dev --background`; sign in from the header on `/` — email arrives in Mailpit (`supabase status` shows the URL), link redirects back to `/`, header shows the signed-in state.
3. Repeat starting from `/admin` while signed out: page shows sign-in state, and after confirming you land on `/admin` with the empty group list.
4. `npm run preview` (workerd runtime) and repeat step 2 — confirms cookies behave on Workers.
5. Tamper test: `/auth/confirm?...&next=https://evil.example` must redirect to `/admin`, not off-site.
6. Cross-browser test (PKCE caveat): request a link in one browser, open it in a private window — must land on the friendly "open the link in the same browser" error, not a raw failure.
