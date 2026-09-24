# Augury M4 — Lifecycle & Realtime

> Milestone 4 of 5. Parent docs: [PRD](./dnd-session-scheduler-prd.md) · [implementation plan](./dnd-session-scheduler-implementation-plan.md).
> **Prerequisites: [M3](./dnd-session-scheduler-m3-sessions-voting.md) complete** — sessions and voting work end-to-end on reload. `votes`, `vote_responses`, and `sessions` are already in the `supabase_realtime` publication (migration 0001).

## Goal

Session lifecycle (confirm / close) with locked-session UI, history, and live tally updates via Supabase Realtime.

**Exit criteria:**

- [ ] Two browsers on the same session page: a vote submitted in one appears in the other without refresh.
- [ ] Admin confirms Thursday → both the session page and the group home reflect it (realtime on the session page; reload is acceptable on the group page).
- [ ] A confirmed/closed session rejects further votes (already DB-enforced by `submit_votes`) **and** the UI shows a locked state instead of the form.
- [ ] Past and closed sessions appear in a history section on the group home ("we played Thursday the last three weeks" is visible at a glance).
- [ ] Editing candidate days or the group threshold while votes exist surfaces the viability impact before saving.

## Tasks

### 1. Lifecycle actions

- `confirmSession({ sessionId, day })` — validate `day ∈ candidate_days`; update `status = 'confirmed'`, `confirmed_day = day` (RLS: admin; the table CHECK keeps the pair consistent). The UI should suggest the best day (from `viability.ts`) but let the admin pick any candidate day — PRD: "the app suggests, the admin decides".
- `closeSession({ sessionId })` — `status = 'closed'` (abandoned without a pick).
- Reopen is intentionally out of scope (not in the PRD); if needed later it's a one-line action.

### 2. Session page states

- **Open** — as built in M3, plus admin-only confirm/close controls inline (visible when `locals.user` is a group admin): per-day "confirm this day" buttons with the best-day suggestion highlighted.
- **Confirmed** — replace the voting form with a prominent confirmed-day banner ("Thursday it is 🎲"); tallies remain visible read-only.
- **Closed** — muted read-only state ("closed without a pick"), tallies visible.

### 3. Group home & history

- Open sessions: visually delineated from confirmed ones (PRD §6) — confirmed upcoming sessions show their day prominently.
- History section: sessions whose week is in the past, plus closed ones — read-only rows (week, outcome day or "closed"), newest first.

### 4. Realtime — `LiveTally` island

- `src/components/islands/LiveTally.tsx` replaces the M3 reload-after-submit behavior on the session page.
- Uses the browser client (`src/lib/supabase/browser.ts`): one channel per session subscribing to `postgres_changes` on `votes` and `vote_responses` filtered by `session_id=eq.<id>`, plus `sessions` (status flips — swap to the confirmed banner live).
- On any event: **re-fetch** `session_day_tallies` + `vote_responses` for the session and re-render (do not patch state from raw payloads — parent plan §3.6).
- SSR-rendered tallies are the initial props; the island hydrates and takes over. The static `TallyBoard`/`VoterList` markup from M3 becomes the island's render output (convert or wrap — avoid maintaining two tally renderings).
- Free-tier hygiene (parent-plan risk #3): unsubscribe on `pagehide`, and pause/resume the channel on `visibilitychange` so backgrounded tabs don't hold connections.
- `VotingForm` submit → optimistic local update is unnecessary; the realtime event round-trip is fast enough. Just clear the "saving" state on the RPC response.

### 5. Edit-impact surfacing (PRD §6)

- Threshold edit (admin dashboard) and candidate-day edit (session edit): before saving, show what changes — e.g. "lowering to 3 makes Tue and Thu viable" / "removing Wednesday discards 4 yes-votes". Computed client-side from data already on the page (a small island or a confirm step in the form); no new DB surface.

## Verification

1. Two-browser manual test per exit criteria (one signed-in admin, one anonymous), on the local stack and once against `npm run preview`.
2. Confirm a session, attempt `submit_votes` via direct RPC call with the anon key → must raise (regression on the DB guard).
3. Check the network tab: exactly one websocket per session page; gone after tab hide + a grace period.
4. `supabase test db` + Vitest still green.
