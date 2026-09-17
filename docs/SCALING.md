# Scaling notes

This app is being built for friend groups — a handful to low dozens of
groups, low tens of members each (see [`DECISIONS.md`](DECISIONS.md)).
Nothing in this document should be built now. It exists so that if usage
ever grows, the "what would need to change" thinking has already been done
once, instead of being figured out under pressure.

Rough order in which things would actually start to hurt, and what fixes
each:

## 1. Free-tier ceilings (first thing to hit, if anything does)

- **Neon free tier**: limited compute hours / storage. Fix is simply
  upgrading to a paid Neon tier — no migration, same connection string.
- **R2**: free tier is 10GB storage + free egress always (egress is free
  on all R2 tiers, not just free). Storage overage is billed per GB, cheap.
  No migration needed, just cost.
- **Cloudflare Workers**: 100k requests/day free. A paid plan raises this
  by orders of magnitude with no code change.

None of these require an architecture change — they're billing changes.
This is the payoff of the portability decisions in `DECISIONS.md`: scaling
past free tier is "add a credit card," not "rewrite the backend."

## 2. Hourly cron sweep stops being the right shape

The rotation job currently scans all groups every hour to find who's due.
Fine up to roughly tens of thousands of groups. Past that:

- Move to a **queue-based fanout**: instead of one job scanning everything,
  schedule each group's next rotation as its own delayed job at creation
  time (or after each rotation). Cloudflare Queues or a similar
  delayed-job mechanism replaces the full-table scan.
- This is a `packages/core` change (the rotation-selection logic stays the
  same) plus swapping the trigger mechanism — not a data model change,
  since `daily_selections` and its `UNIQUE(group_id, local_date)`
  constraint work the same either way.

## 3. Single-region Postgres becomes a latency issue

If members are geographically spread and the app feels slow, options in
rough order of effort:
- Add a **read replica** in a second region for read-heavy paths (viewing
  today's photo, comment list) — writes still go to the primary.
- Move to a **distributed Postgres** (e.g. Neon's read replicas, or a
  provider like PlanetScale for Postgres/CockroachDB) if reads alone don't
  solve it.
- This is transparent to `packages/core` if the DB access stays behind
  Drizzle — no service-layer rewrite, just connection/infra config.

## 4. Object storage and CDN

R2 already fronts through Cloudflare's CDN network by default, so this one
mostly scales itself. If image transformation (thumbnails, resizing) is
ever added, Cloudflare Images or a Worker-based resize-on-request pattern
would be the next step rather than doing it at upload time.

## 5. Authorization / abuse surface

At friend-group scale, trust is high and abuse isn't a real concern. If
the app ever opens to less-trusted or public groups:
- Add rate limiting at the Worker level (Cloudflare has built-in rate
  limiting rules).
- Revisit invite-code security — a short random code is fine for friends
  who share it deliberately, not fine if codes need to resist guessing at
  scale.

## 6. Error visibility: Workers Logs stops being enough

Errors currently go to Cloudflare's built-in Workers Logs (see
`DECISIONS.md`'s "Errors are logged via Cloudflare Workers Logs" entry) —
queryable in the dashboard, but nothing pages or emails anyone when
something breaks, and the free plan only retains 3 days of logs. Fine
while checking in occasionally is good enough. Worth revisiting once
either stops being true — e.g. once people other than the person building
this actually depend on it daily, so a missed rotation nobody notices for
a few days is a real complaint instead of a shrug, or once there's a
staging/prod split (`docs/ROADMAP.md` step 8) and "did last night's deploy
break something" needs an answer faster than "go look."

- Add a **third-party error tracker** (Sentry or similar) alongside
  Workers Logs, not instead of it — for proactive alerting (email/Slack
  the moment something breaks) and error grouping/stack traces that
  Workers Logs doesn't do.
- This is additive, not a migration: the `console.error` calls already in
  place keep working either way: most Sentry-style SDKs wrap them, or a
  Tail Worker can forward Workers Logs output to a third party without
  touching call sites at all.
- Worth a deliberate look at what context gets attached to reported errors
  before wiring this up — see `ENCRYPTION.md` for what this app is
  otherwise careful not to expose to any third party.

## What doesn't need to change

The core design choices — R2 for blobs, Postgres for metadata, ports &
adapters around storage/auth/push, versioned API — all hold at any scale
discussed here. The point of those decisions was exactly to avoid a
rewrite; this document is mostly about *infrastructure and cron dials*,
not architecture.
