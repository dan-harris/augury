# Augury M3 — Sessions & Voting

> Milestone 3 of 5. Parent docs: [PRD](./dnd-session-scheduler-prd.md) · [implementation plan](./dnd-session-scheduler-implementation-plan.md).
> **Prerequisites: [M2](./dnd-session-scheduler-m2-groups-roster.md) complete** — groups exist with rosters and thresholds; `/g/[groupSlug]` shell renders; `submit_votes` RPC and `session_day_tallies` view already exist from migration 0001.

## Goal

Admins create sessions for a specific ISO week; anyone with the link votes: pick your player from the roster, multi-select days, submit, edit by re-selecting. Tallies render server-side with viability highlighting (live updates are M4 — "on reload" is the M3 bar).

**Exit criteria:**

- [ ] Admin creates a session for next week in two clicks (defaults carried from the previous session's candidate days).
- [ ] Full vote round-trip on a mobile viewport, signed out, in under 30 seconds: open link → pick player → tap days → submit.
- [ ] Re-selecting the same player shows their existing votes pre-checked for editing; resubmitting replaces the vote-set (including down to zero days = "voted all-no").
- [ ] A signed-in user linked to a player lands on the voting page with that player pre-selected and locked (cannot pick another).
- [ ] Tally shows per-day counts, "3 of 4 needed" progress, viable-day highlighting, best-day suggestion, and voted / not-yet-voted player lists.
- [ ] Group home lists open sessions with week window + at-a-glance viability.

## Tasks

### 1. Pure logic (`src/lib/`, Vitest-covered)

- `weeks.ts` — Monday-anchored ISO week helpers: `weekStart(date)`, next-N-weeks options for the create form, day-index (0=Mon…6=Sun) ↔ localized day names via `Intl`, and "Week of 29 Sept" formatting. Timezone-free by design: `week_start` is a plain date, days are indices.
- `viability.ts` — given tally rows + threshold: viable days, best day (most votes, earliest-in-week tiebreak), progress copy ("3 of 4 needed"), and closest-day-when-nothing-viable ("nothing viable yet — Thursday is closest at 3 of 4").

### 2. Actions

- `createSession({ groupId, weekStart, candidateDays })` — validate Monday + non-empty days; generate the id app-side (nanoid, ~10 chars, URL-safe alphabet); insert (RLS: admin). Redirect to the session's admin/public view.
- `updateSession({ sessionId, weekStart?, candidateDays? })` — admin edit of an **open** session's config. If votes exist, the page surfaces the viability impact (M4 polishes this; a simple warning is enough here). Note: shrinking `candidate_days` can orphan `votes` rows for removed days — delete those rows in the action (votes are admin-deletable? **No** — votes have no delete policy. Do it inside `updateSession` via a small addition: either extend the RPC surface with a `security definer` `update_session_days` function in a new migration, or leave orphaned rows and filter them in the view — the view already only unnests current `candidate_days`, so orphaned rows are invisible and harmless. **Prefer the do-nothing option; document it in a code comment.**)
- `submitVotes({ sessionId, playerId, days })` — wraps the `submit_votes` RPC; the only anonymous write path.

### 3. Routes

- `/admin/[groupSlug]/create.astro` — week picker (next ~8 Mondays, default = upcoming week), candidate-day multi-select defaulting to the group's most recent session's `candidate_days` (all seven checked if no prior session). Submit → `createSession`.
- `/admin/[groupSlug]/index.astro` — replace the M2 placeholder: list sessions (open first) with week window, status, vote-count summary, link to public page.
- `/g/[groupSlug]/index.astro` — populate: open sessions as cards (week window, per-day mini-tally or viability badge, link to vote); confirmed/closed/past sessions can remain a stub until M4's history section.
- `/g/[groupSlug]/[sessionId].astro` — the voting page. SSR fetches: session, roster, `session_day_tallies` rows, `vote_responses` (who has voted), current votes per player, and — if `locals.user` — the roster row with `user_id = locals.user.id` for the pre-select/lock. Renders tally + `VotingForm` island.

### 4. Preact islands (`src/components/islands/`)

- `PlayerPicker` — roster list; selecting a player loads their existing votes into the form (pass all players' current votes down as props from SSR — group data is public by design, so no extra fetch needed). When a `linkedPlayerId` prop is set, render it selected and disabled.
- `DayPicker` — candidate days as large tap targets with day name + date; multi-select toggles.
- `VotingForm` (`client:load` — it is the page's purpose) — composes the two, tracks the pick-player → edit-days → submit state machine, calls `submitVotes` via the `astro:actions` client, then refreshes tallies (simplest M3-correct behavior: `location.reload()` or re-fetch; the Realtime island replaces this in M4).
- Static Astro components: `SessionCard` (group home), `TallyBoard` (per-day rows: count, progress, voter names, viable highlight, best-day badge), `VoterList` (voted / not-yet-voted — the social-pressure list, PRD §4).

### 5. User↔player linking (PRD §2)

- `linkPlayerToUser({ playerId })` action — sets `players.user_id = auth.uid()` where currently null. **RLS gap check**: `players` update policy is admin-only, so a voter can't do this directly — add a small `security definer` RPC `link_player(p_player_id uuid)` in a **new migration** (grant to `authenticated`; raise if the player already has a `user_id` or the caller is already linked to another player in that group), plus an `unlink` variant for the admin dashboard.
- Group home page: signed-in unlinked users get a "this is me" affordance per roster player.

## Verification

1. Vitest green on `weeks.ts` / `viability.ts` (tiebreaks, empty-viability closest-day, ISO edge cases around year boundaries).
2. pgTAP for the new `link_player` RPC (already-linked player, double-link attempts).
3. Manual mobile-viewport run of the exit-criteria list against local Supabase, both signed-out and as a linked user.
4. Regression: `supabase test db` still green; anon still cannot write `votes` directly.
