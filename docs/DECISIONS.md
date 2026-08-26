# Key decisions

A running log of the significant choices made during planning, why, and what
the alternative would have been. Add to this file as new decisions get made
— it's meant to save future-us from re-litigating the same trade-offs.

---

### Photo bytes go in object storage (R2), not the database

**Decision:** Image blobs live in Cloudflare R2; Postgres holds metadata and
relationships only (`storage_key` pointer).

**Why:** The original idea was "photos stored on db." Storing bytes in
Postgres bloats the database (the expensive, non-free resource), makes
backups slow and costly, routes every image byte through the API instead of
a CDN, and doesn't actually change the product — "delete everywhere" still
happens, it's just two calls (DB row + blob) behind one service method
instead of one.

**Alternative considered:** Bytes directly in a Postgres `bytea` column.
Simpler for a first prototype, but would need to be ripped out before any
real usage — not worth building twice. Kept behind a `PhotoStore` interface
either way so this is a reversible choice if we're wrong.

---

### Monorepo (pnpm workspaces + Turborepo), not separate repos

**Decision:** API, web/native app, and shared packages live in one git repo.

**Why:** The API and client share request/response shapes constantly
(comments, photos, group membership). A monorepo lets both sides import the
same Zod schema, so a shape change is a compile error in the client instead
of a runtime bug discovered in production. Turborepo adds build caching so
this doesn't slow CI down as the repo grows.

**Alternative considered:** Two separate repos (`memaday-api`,
`memaday-app`), hand-duplicating types on both sides. Simpler tooling, more
drift risk. Rejected because the type-safety win is worth the modest extra
setup for a project with this much API/client back-and-forth.

**Note:** a monorepo does **not** mean shared deployment or versioning — see
[`ARCHITECTURE.md#deployment`](ARCHITECTURE.md#deployment). API and web
deploy independently on every push; native ships on its own manual cadence.

---

### Hono + Cloudflare Workers for the API, not a framework tied to one host

**Decision:** API is written in Hono, deployed to Cloudflare Workers.

**Why:** Free tier (100k requests/day) is generous for a small group app,
and Hono is a thin, standards-based framework that runs unchanged on
Node/Bun/Deno/Fly/Cloud Run — migrating off Workers later is a deploy-config
change, not a rewrite.

**Alternative considered:** Supabase Edge Functions, or a framework bound to
one platform (e.g. Next.js API routes on Vercel specifically). Rejected in
favor of something more host-agnostic, given "flexible for future
migration" was an explicit requirement.

---

### Postgres (Neon) + Drizzle, not a vendor-managed all-in-one backend

**Decision:** Plain Postgres with hand-owned schema and migrations (Drizzle
Kit), rather than Supabase/Firebase as an all-in-one backend.

**Why:** Postgres is the most portable database choice — any host works,
and Drizzle migrations are just SQL we control in git. Supabase would be
faster to get to a first prototype (Auth + Storage + DB + Realtime in one
dashboard) but free-tier projects pause after ~a week of inactivity, which
is close to disqualifying for an app whose whole mechanic is a daily cron
job, and Storage egress isn't free there either.

**Alternative considered:** Full Supabase stack. Still on the table if
development speed turns out to matter more than portability — revisit if
the plain-Postgres setup feels like too much boilerplate once building
starts.

---

### Better Auth instead of Clerk / Supabase Auth

**Decision:** Self-hosted auth (Better Auth), with user/session tables in
our own Postgres database.

**Why:** Clerk and Supabase Auth both own the user table on their side —
migrating away later means an actual user migration, not a config change.
Better Auth keeps auth data in our database from day one.

**Alternative considered:** Clerk (nicer out-of-box UI/DX). Rejected for the
same portability reason as the Supabase-all-in-one decision above.

---

### Expo (React Native + web), web-first — native deferred, not abandoned

**Decision:** Build the web app first using Expo's web output
(`react-native-web`). Do not build native iOS/Android yet. When native is
committed to later, it's the same Expo project — no rewrite, just adding
`eas build` + store submission.

**Why:** The requirement is "website + potentially native app." Building the
UI in Expo from the start costs the same as building a plain web app (e.g.
Next.js) today, but keeps native as a cheap add-on later instead of a full
UI rewrite if/when it's committed to.

**Alternative considered:** Plain React/Next.js site now, treat native as a
possible future rewrite in React Native. Slightly better default web/SEO
ergonomics today, but throws away the "potentially native" requirement's
cheap path — rejected.

---

### Comments vaporize with the photo — no permanent memory

**Decision:** Comments are hard-deleted along with their photo at purge
time. No "memory" of past days is kept anywhere.

**Why:** Matches the original brief ("deleted from everywhere") exactly.
Confirmed — no change needed to the schema; `comments` already hangs off
`daily_selections` and cascade-deletes with it.

---

### A photo can only be selected once — no replay

**Decision:** Once a photo has been shown, it's gone for good.
`photos.state` is a one-way door: `pending → ready → shown → purged`, never
back to `ready`.

**Why:** Confirmed by product owner. Simplifies the selection query (no
need to track or reconsider previously-shown photos) and reinforces the
one-shot, ephemeral feel of the app.

**Implication:** this closes off "replay an old photo" as an option for the
empty-pool case in [`OPEN_QUESTIONS.md`](OPEN_QUESTIONS.md) — the only real
choices left there are skip-silently or nudge members to upload more.

---

### Saving/screenshotting the photo is encouraged, not discouraged

**Decision:** No screenshot detection, warnings, or save-prevention on
either platform. If anything, a save/download action should be made easy
and obvious in the UI.

**Why:** Confirmed by product owner — the ephemerality is about the shared
*group experience and pool* resetting daily, not about preventing any
individual from keeping a copy for themselves. This simplifies the client
considerably (screenshot detection is unreliable and a poor experience
anyway) and turns "save this" into a feature to design for rather than a
threat to defend against.

---

### Purge delay: 12 hours after the next rotation

**Decision:** When a new photo is selected, the previous day's selection
(photo blob + row, comments, views, reactions) is hard-deleted 12 hours
later, not immediately and not at end-of-day.

**Why:** Confirmed by product owner. Long enough that no one's mid-comment
gets yanked out from under them at the exact rotation moment; short enough
that "deleted everywhere" still feels true within the same day. Replaces
the draft ~1 hour placeholder in `ARCHITECTURE.md`.

---

### Scale target: friends, not the general public — for now

**Decision:** Design for small friend-group usage (a handful to low dozens
of groups, low tens of members each), not thousands of concurrent users.
Free-tier limits (Neon, R2, Cloudflare Workers) are treated as comfortable
headroom, not a near-term ceiling.

**Why:** Confirmed by product owner — this is being built for friends
first. Keeps the build simple: the hourly full-table-scan cron rotation
approach and single-region Postgres are both fine at this scale, no need to
build for scale that isn't needed yet.

**But:** the architecture should still not paint us into a corner if usage
grows. See [`SCALING.md`](SCALING.md) for what would actually need to
change and roughly when — nothing there needs to be built now.

---

### Rotation and deletion are cron-driven, not on-request

**Decision:** An hourly Cloudflare Cron Trigger checks which groups are due
to rotate (based on each group's own timezone + rotation hour), selects a
new photo, and hard-purges the previous selection's blob + rows shortly
after (see [`OPEN_QUESTIONS.md`](OPEN_QUESTIONS.md) for the exact purge
delay, still open).

**Why:** Rotation must happen even if no user opens the app that day —
"each day, a photo is selected" is a scheduled event, not something that
should be triggered lazily on someone's next request.

**Scale note:** an hourly sweep over all groups is fine up to roughly tens
of thousands of groups. If the app ever grows past that, this moves to a
queue-based fanout instead of a full-table scan — not a concern for launch.
