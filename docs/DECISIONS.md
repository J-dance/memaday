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

### Empty photo pool: nudge members to upload, don't skip silently or replay

**Decision:** If a group has no unshown photos when its rotation is due,
don't select anything that day — instead push a notification/in-app nudge
asking members to upload. (Replaying an old photo isn't on the table per
the "select once" decision above.)

**Why:** Confirmed by product owner. Keeps the "one shot per photo" rule
intact and turns an empty pool into a prompt that drives the core
loop (uploading) rather than a silent gap the group might not notice.

**Implication:** the rotation job needs a "no eligible photos" branch that
records nothing in `daily_selections` for that date and instead triggers a
notification — this is a `packages/core` concern, not just a UI concern for
the empty state.

---

### Photo privacy: full end-to-end encryption (E2EE)

**Decision:** Photos and comments are encrypted client-side with a
per-group symmetric key before ever reaching the server. The server stores
and moves ciphertext only — it cannot read photo or comment content, even
in principle. Full design and reasoning in
[`ENCRYPTION.md`](ENCRYPTION.md).

**Why:** Confirmed by product owner as a key feature, not a nice-to-have.
Three tiers were on the table: (0) access control only via a private
bucket + auth-gated URLs, (1) encryption at rest with a server-held key
(protects against a storage-layer breach, not against the server itself),
(2) full E2EE (protects even against us). Chose (2).

**Cost accepted knowingly:** no server-side image processing or EXIF
backstop (client-only now), no blurhash placeholders, no readable comment
text in push notification previews, no server-side content moderation ever.
New member join requires an existing member's client to be online at some
point to complete a key handoff — not instant the way adding a row to
`group_members` alone would be. All detailed in `ENCRYPTION.md`.

**Alternative considered:** Tier 1 (server-held key) was the pragmatic
default recommendation — meaningfully simpler, no client-side key
management, still protects against the most likely real failure (a leaked
storage credential or misconfigured bucket). Rejected in favor of Tier 2
because privacy was named as a key feature, and this project is explicitly
also a learning vehicle — E2EE is a substantially richer thing to build and
understand than at-rest encryption.

---

### Neon's HTTP driver, not a raw `pg` TCP connection

**Decision:** `packages/db` connects to Postgres via
`@neondatabase/serverless` (`drizzle-orm/neon-http`), which speaks to Neon
over HTTP/fetch, not `pg`'s usual pooled TCP connection.

**Why:** Cloudflare Workers can't hold a long-lived pooled TCP socket open
the way a normal Node server can — each Worker invocation is short-lived
and doesn't keep a persistent connection pool around between requests.
Neon's HTTP driver is built for exactly this: every query is a stateless
HTTP request, no connection pooling needed. This is forced by the
Workers + Neon combination already chosen, not really a free choice.

**Portability cost, named explicitly:** this ties `apps/api` to Neon's
driver specifically — the schema and raw SQL stay portable to any Postgres
host (per `docs/SCALING.md`), but *this file* would need to change to plain
`pg` if we ever moved off Workers to a long-running host (Node/Bun/Fly),
or to a different driver if we moved to a different edge-compatible
Postgres provider. Documented inline in `packages/db/src/index.ts` as well,
since it's exactly the kind of thing worth understanding when reading that
file, not just this doc.

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

---

### Email + password auth, not email OTP

**Decision:** Better Auth is configured for email + password login, not the
passwordless email-OTP flow originally sketched in `ROADMAP.md`.

**Why:** [`ENCRYPTION.md`](ENCRYPTION.md)'s identity-keypair design encrypts
each user's private key client-side with an Argon2id key derived from **the
user's password**, so the server can store `encrypted_private_key` without
ever being able to read it. Email OTP is passwordless — there'd be nothing
for that derivation to use. Reconciling this required one of the login
credential and the key-derivation secret to be the same thing (password
auth), or introducing a second secret purely for key derivation, or dropping
password-derived encryption and keeping the private key device-local only.

**Alternatives considered:**
- *OTP login + separate "encryption passphrase"* — keeps passwordless login,
  but adds a second secret the user has to set and remember that behaves
  exactly like a password in every way that matters (no recovery if
  forgotten), for no real security benefit over just using one password.
  Strictly more UI and more user burden than password auth, with the same
  trade-offs.
- *OTP login + device-only private key (never uploaded, even encrypted)* —
  breaks the multi-device property `ENCRYPTION.md` relies on (log in
  anywhere with the password, re-derive the key, done). Every new device
  would need the same re-wrap-and-invite handoff as a brand-new member
  joining a group, which is the heaviest flow in the whole crypto design —
  a bad trade for what should be the common case of "open the web app on a
  new browser."

**Trade-off accepted:** normal password UX friction (reset flows, password
manager dependency), and a "forgot password" reset genuinely loses access to
the old encrypted private key — no recovery. This is the same trade-off
`ENCRYPTION.md` already documents as low-stakes given the 12-hour purge
window; it just now also gates login, not only key recovery.

---

### Staging environment set up now, on a `staging` branch, before deploy CI exists

**Decision:** A full staging environment (Neon branch, separate Worker,
separate R2 bucket, separate `BETTER_AUTH_SECRET`) is provisioned as part
of the initial deploy setup, not added after prod is live. Deploys are
gated by branch: pushes to `staging` deploy to staging, and only merging
`staging` into `main` deploys to prod. Full layout in
[`ARCHITECTURE.md#environments`](ARCHITECTURE.md#environments).

**Why:** Two things pushed toward doing this early rather than
retrofitting it. First, migrations are risky to rehearse for the first
time against real data — `packages/db`'s schema already changes
non-trivially (Better Auth's tables were just added), and every future
schema change needs somewhere to run first that isn't prod. Second, the
E2EE design (`ENCRYPTION.md`) means prod data can't be inspected to debug
issues — you can't "just look at" a ciphertext photo or comment — so a
throwaway staging environment with data you generated yourself is the only
practical way to poke at real request/response flows while building.

**Alternatives considered:**
- *Single environment, add staging later* — less setup now, but every
  migration between now and "later" would have gone straight to prod with
  no rehearsal, and "later" tends to arrive after the first bad migration,
  not before it.
- *Neon: separate project instead of a branch* — more isolated (its own
  compute/storage limits), but two projects means running every migration
  twice by hand with no shared lineage between them. A branch is
  copy-on-write off `main` and resettable in seconds, which fits
  "throwaway test data" better, and this project's scale doesn't need the
  extra isolation a second project would buy.
- *Deploy to both environments on every push to `main`* — simplest CI, and
  still on the table if the two-branch flow ends up feeling like
  unnecessary process for a project this size. Rejected for now in favor
  of `staging` acting as a real pre-prod gate, since the whole point is
  catching a bad migration or rotation-logic edge case before it's live.

---

### New members are admitted to a group silently, not via an approval prompt

**Decision:** When an existing member's client notices a group member who
has joined (via invite code) but has no wrapped group key yet, it wraps
and uploads one automatically, in the background — no "someone wants in,
let them in?" prompt. See
[`ENCRYPTION.md#3-adding-a-member`](ENCRYPTION.md#3-adding-a-member) for
the mechanism and `apps/api/src/routes/groups.ts` /
`apps/mobile/src/app/explore.tsx` for the implementation.

**Why:** Confirmed by product owner. The invite code is already the
stated gate for joining a group — nothing in the product design calls for
a second, per-member approval step on top of it. Silent admission is also
less to build: no notification/approval UI, no "pending requests" state
for members to manage.

**Alternative considered:** An explicit prompt ("X wants to join — let
them in?"). Gives real-time visibility into who's joining and would be a
natural place to add moderation later, but nothing has asked for that yet,
and it's more UI for a guarantee (gatekeeping beyond the invite code) the
product doesn't currently want.

**Mechanics this implies:**
- `group_members` (membership) and `group_keys` (has-the-key) are already
  separate tables, so "joined but keyless" needed no schema change — it's
  just a `group_members` row with no matching `group_keys` row.
- Any key-holding member can admit any pending member — there's no
  "admin-only" restriction on this action. `group_keys`'s composite
  `(groupId, userId)` primary key plus `.onConflictDoNothing()` makes it
  safe for two members to race to admit the same person at once.
- Discovery is polling, not push: a member's client checks for pending
  members whenever it fetches its group list (app foreground, pull-to-
  refresh). No websocket/Durable Object infra exists yet, and friend-group
  scale doesn't need it — see `docs/SCALING.md`.

---

### Neon's HTTP driver has no interactive transactions — use `.batch()` instead

**Decision:** Multi-row atomic writes (e.g. creating a group: the `groups`
row, the creator's `group_members` row, and their `group_keys` row all at
once) use Drizzle's `db.batch([...])`, not `db.transaction(...)`.

**Why:** Neon's HTTP driver (see the earlier ["Neon's HTTP driver" entry](#neons-http-driver-not-a-raw-pg-tcp-connection))
has no persistent connection to hold a multi-statement transaction open —
every call is a stateless HTTP request. `db.transaction()` needs exactly
that and isn't available on `neon-http`. `db.batch()` is Neon's answer:
it sends several independent statements in one HTTP request that Neon
still runs atomically server-side. The one real consequence: statements in
a batch can't see ids generated by earlier statements in the same batch,
so a batch that needs a shared id (like the new group's) generates it
client-side (`crypto.randomUUID()`) up front instead of relying on the
column's `defaultRandom()`.
