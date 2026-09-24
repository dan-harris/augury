# Augury — Product Requirements (v2)

> **Naming:** After the [2nd-level divination spell](https://roll20.net/compendium/dnd5e/Augury#content) used to foresee whether a specific course of action will bring weal or woe — much like trying to get six employed adults into the same room on a Tuesday evening.

## Problem statement

Organising a recurring D&D group is a "find one day this week that enough players can make" problem. General-purpose tools make you enumerate dates and eyeball results yourself. This app narrows the model to days of the week within a specific week, makes viability a first-class computed concept, and anchors everything to a persistent **group** so the roster and the history of sessions live in one place.

## Domain model

```
User (authenticated)
 └─ admin of ──► Group ("Dungeons and Dads")
                  ├─ Players (the roster — named people, defined once)
                  └─ Sessions (one per week window, many per group)
                       └─ Votes (player × day, yes/no)
 └─ member of ──► Group ("Dungeons and Dads")
 └─ linked to ──► ├─ Specific Player (the roster — named people, defined once)
                  └─ Sessions (one per week window, many per group)
                       └─ Votes (player × day, yes/no)
```

- **Group** — the root entity. A named D&D group with its own roster and its own sessions. Groups are fully separate: "Dungeons and Dads" and another group never share players or sessions.
- **Player** — a named member of a group's roster (e.g. "Dan", "Steve"). Players belong to the group, not to any session, so the roster is defined once and reused every week. The DM is just a player — no special voting role.
- **Admin user** — an authenticated user who manages a group: edits the roster, creates sessions, confirms days. A group must always have at least one admin. A user can be an admin of multiple groups, and can be linked to player identities across multiple groups (user ↔ player is 1-to-many across groups).
- **Session** — a voting poll belonging to a group, scoped to a specific week window. One group has many sessions over time, and can have multiple open at once (e.g. voting on the next two weeks in parallel). Sessions are unique entities and are **not keyed by their week window** — an admin may create overlapping sessions for the same week if they choose.
- **Vote** — a yes/no per player per candidate day within a session. Yes/No only, no "maybe".

## User roles

**Admin user (authenticated)** — creates and configures the group, manages the player roster, creates sessions for specific week windows, and confirms/closes sessions. Admins are the only ones who need accounts.

**Public voter (unauthenticated)** — anyone with the group or session link. They don't type a free-text name; they **select which player they are** from the group's roster, then vote. This replaces name-matching entirely: identity is the roster, editing your vote means selecting your player again.

**User voter (authenticated)** — anyone with the group or session link. Their account gets tied to a specific player if the user chooses.

## Functional requirements

### 1. Group management (admin only)

- `/admin`
  - Create a group with a name (slug generated from this, suffixed with a stable 6-character slug-id — see resolved decision 5); the creating user becomes its first admin.
- `/admin/<group-slug>`
  - Manage the roster: add, rename, remove players. Removing a player should warn if they have votes in open sessions.
  - Manage admins: invite/remove other admin users, with a hard rule that the last admin cannot be removed (a group always has ≥1 admin).
  - Configure the group's **viability threshold** — a static, absolute number of yes-votes required for a day to be viable (e.g. 4). It does not scale with roster size; sessions inherit it from the group.
  - The group has a shareable public link that serves as its home page for players.

### 2. Group home page (public)

- `/g/<group-slug>`
  - Shows the group name and **all sessions currently open for voting**, each with its week window and live viability status at a glance.
  - Past (confirmed/closed) sessions are viewable read-only for history — "we played Thursday the last three weeks."
  - This page is the one link players ever need; individual sessions are reachable from it (and still directly linkable for "vote on this one" nudges).
  - If the user is authenticated (not required) then the user can choose to 'link' their user to a session player.

### 3. Session creation (admin only)

- `/admin/<group-slug>/create`
  - Admin creates a session within a group for a **specific week window** (e.g. week of 29 Sept). The week is explicit, so "Tuesday" is always unambiguous and multiple future weeks can be polled concurrently.
  - Configuration per session:
    - Candidate days — any subset of the seven weekdays.
  - The viability threshold comes from the group's configuration (see Group management) rather than being set per session.
  - Sensible defaults carried from the group's previous session (same candidate days) so weekly creation is a two-click affair.

### 4. Voting (public)

- `/g/<group-slug>/<session-id>`
  - Voter opens the session, selects their player from the roster (if not already linked to a player via authenticated user), and multi-selects every candidate day they can make.
  - Re-selecting the same player shows their existing votes for editing — one vote-set per player per session, ever. Linked, autheticated users can't select other users.
  - All votes are public within the group: everyone sees who has voted, who hasn't, and what each player picked. The "hasn't voted yet" list is deliberate social pressure.
  - Trust model: nothing stops a voter selecting someone else's name. Accepted trade-off for friend groups; the roster constraint already prevents drive-by strangers adding noise.

### 5. Results and viability

- Live per-day tally: count, which players are in, and progress toward threshold ("3 of 4 needed").
- Days meeting the threshold are highlighted as **viable**. Multiple viable days all highlight; the app suggests a "best" day (most votes, earliest-in-week tiebreak) but the admin decides.
- If nothing is viable, say so plainly and show the closest day.
- Admin can **confirm** a day, locking the session and displaying the decided day prominently on both the session and the group home page.

### 6. Session lifecycle

- States: **open** (accepting votes) → **available** (has viable days) → **confirmed** (day locked) or **closed** (abandoned without a pick).
- All session that are in the future are shown, open ones will be visually delineated from 'confirmed' ones. Closed ones + sessions in the past will be in history.
- Editing a session's config (days, week) — or the group-level threshold — after votes exist is admin-only and should surface how it affects current viability.

## Non-functional expectations

- **Auth is admin-only.** Voters never sign in — the link plus roster selection is the whole identity story. This is the WhenAvailable-style low-friction core, now with the added structure of a fixed roster. Admin auth uses **Supabase Auth email magic links** — no passwords and no third-party OAuth provider.
- **Real-time or near-real-time results** — new votes appear without a manual refresh, or at minimum on reload.
- **Mobile-first** — players vote from a phone via a Discord/WhatsApp link; pick-your-name → tap days → done in under 30 seconds.
- **Link unfurling** — group and session links should preview nicely in Discord/messaging apps (group name, week, vote status). Group URLs use the name+slug-id slug (resolved by slug-id only); sessions use short ids.

## Explicitly out of scope (v1)

- Time-of-day granularity — days only.
- Voter accounts, or linking players to real user accounts for voting purposes (the user↔player link matters only for admins in v1).
- Notifications (Discord webhook when a day becomes viable / when confirmed) — strongest v2 candidate.
- Auto-created recurring weekly sessions — natural v2 once manual creation with defaults feels smooth.
- Calendar integration, exports, chat, multiple guest groups.

## Resolved decisions

1. **Overlapping sessions are allowed.** Each session is a unique entity, not keyed by its week window — an admin can create multiple sessions covering the same week if they choose.
2. **The viability threshold is static and group-level.** It's an absolute number configured on the group, inherited by sessions, and does not change when the roster grows or shrinks mid-vote (a newly added player can simply vote in open sessions).
3. **Admin auth is Supabase magic links.** Admin users sign in with an email magic link via Supabase Auth — no passwords, no third-party OAuth provider (one could be added later without schema changes). Admin invites work the same way: a shareable single-use invite link, not email-address matching. Future direction: "normal" (non-admin) users can also log in to view the groups they belong to and be attached to player identities within them.
4. **Week windows are ISO weeks.** A session's week starts on Monday and is stored as the week-start date. The unit is days-of-week, not datetimes, so the model is timezone-free by design.
5. **Group slugs are name + stable slug-id.** The full slug is the slugified group name plus a stable 6-character id suffix (e.g. `dungeons-and-dads-8efc4d`). Only the trailing slug-id is parsed from the URL to resolve the group — the name part is cosmetic, so renames never break shared links.
