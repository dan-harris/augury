# Augury M2 — Groups & Roster

> Milestone 2 of 5. Parent docs: [PRD](./dnd-session-scheduler-prd.md) · [implementation plan](./dnd-session-scheduler-implementation-plan.md).
> **Prerequisites: [M1](./dnd-session-scheduler-m1-foundations.md) complete** — migration 0001 applied (all tables, RLS, `create_group` / `accept_invite` RPCs, last-admin trigger already exist), auth working, `/admin` renders an empty group list. Your user must be seeded into `group_creators` (M1 manual step 8).

## Goal

Group creation (allowlist-gated), the admin group dashboard with roster CRUD / threshold config / admin management, magic invite links, and the public group page shell with slug-id routing.

**Exit criteria:**

- [ ] An allowlisted user creates "Dungeons and Dads" from `/admin` and lands on its dashboard; a non-allowlisted user sees no create UI, only the invite-hint empty state.
- [ ] Add 6 players, rename one, remove one; set the viability threshold.
- [ ] Open the public link `/g/dungeons-and-dads-<slugid>` signed-out and see the group shell.
- [ ] `/g/renamed-name-<slugid>` and `/g/<slugid>` both resolve; a stale name part 301s to the canonical slug.
- [ ] A second account (use a second email in the local Mailpit inbox) becomes an admin via an invite link; removing the last admin is blocked with a friendly error.

## No new migrations expected

All DB objects for this milestone shipped in migration 0001. If a gap is found (e.g. a missing policy), add a new numbered migration — never edit 0001 after it has been pushed anywhere.

## Tasks

### 1. `src/lib/slugs.ts`

- `slugifyName(name)` — lowercase, hyphenate, strip non-alphanumerics, collapse/trim hyphens.
- `composeSlug(name, slugId)` → `slugify(name)-{slugId}`; handle empty slug-name (name that slugifies to nothing → slug is just the slug-id).
- `parseSlugId(param)` — take the trailing 6-char `[a-z0-9]{6}` segment after the last hyphen (or the whole param if it's exactly 6 chars); return `null` if malformed. **This is the only thing routes use for lookup.**
- Unit-test these with Vitest (set up Vitest here if not already present — first pure-logic module).

### 2. Actions (`src/actions/index.ts`)

All admin actions rely on RLS as the enforcement layer; the action just validates inputs and surfaces friendly errors.

- `createGroup({ name })` — calls the `create_group` RPC; redirect to `/admin/<composed-slug>`. Map the not-allowlisted raise to a clear error.
- `updateGroup({ groupId, name?, viabilityThreshold? })` — plain `update` on `groups` (RLS: admin only).
- `addPlayer({ groupId, name })`, `renamePlayer({ playerId, name })` — surface unique-name violations nicely.
- `removePlayer({ playerId, confirmed })` — two-step: if the player has `vote_responses` rows in any **open** session and `confirmed !== true`, return a warning payload instead of deleting (PRD wants warn-and-confirm, not block).
- `createInvite({ groupId })` — insert `admin_invites` with a random token (nanoid, ≥21 chars) and `expires_at = now() + 7 days`; return the full `/admin/join?token=…` URL.
- `revokeInvite({ inviteId })` — delete.
- `acceptInvite({ token })` — calls the `accept_invite` RPC; redirect to the group dashboard.
- `removeAdmin({ groupId, userId })` — delete on `group_admins`; map the last-admin trigger raise to "a group must always have at least one admin".

### 3. Routes

All `prerender = false`. Group-scoped routes resolve via `parseSlugId` → `select … where slug_id = …`; 404 on no match; **301 to the canonical slug** when the request's name part doesn't match `composeSlug(current name)`.

- `/admin` — extend the M1 page: create-group form (name input) shown only when the user has a `group_creators` row; group list links to dashboards.
- `/admin/[groupSlug]/index.astro` — guard: 404 (or redirect to `/admin`) unless `locals.user` is an admin of the group (the RLS-filtered `group_admins` select doubles as the check). Sections:
  - Group settings: rename, viability threshold (plain forms + actions).
  - Roster: list / add / rename / remove players (removal confirm dialog driven by the two-step action).
  - Admins: list admins, remove (blocked-last-admin error surfaced), pending invites with copy-link + revoke, "create invite link" button.
  - Share: the public URL `/g/<slug>` with a copy button.
  - Sessions section placeholder linking to `/admin/[groupSlug]/create` (M3).
- `/admin/join.astro` — reads `?token=`. Signed-out: show sign-in prompt (header AuthMenu; the `next` param brings them back here with the token intact). Signed-in: show group name ("You've been invited to administer …" — fetch via the invite's group, which needs the invite row; note `admin_invites` select is admin-only, so fetch the group name through the `accept_invite` RPC's return or make this a confirm-button-first flow: button → `acceptInvite` action → redirect to dashboard).
- `/g/[groupSlug]/index.astro` — public shell: group name, empty "open sessions" section (populated in M3), placeholder history. Renders identically signed-in/out except the header.

### 4. Components

Prefer plain Astro `<form method="post">` + actions for admin CRUD (roster, settings, invites) — no islands needed unless an interaction genuinely requires client state. Small Preact islands only where optimistic behavior matters (e.g. copy-to-clipboard buttons can be a tiny island or inline script).

## Verification

1. Vitest green on `slugs.ts` (canonical, stale-name, bare-id, malformed cases).
2. Walk the exit-criteria list manually against the local stack, including the second-account invite flow via Mailpit.
3. pgTAP additions if any DB gap was patched; otherwise re-run `supabase test db` to confirm nothing regressed.
4. Signed-out probe: attempt roster mutation via direct PostgREST call with the anon key — must be rejected by RLS.
