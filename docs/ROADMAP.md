# Roadmap

Planned build order once implementation starts. Nothing here has been built
yet — see [`OPEN_QUESTIONS.md`](OPEN_QUESTIONS.md) for what should probably
be settled first.

1. **Scaffold the monorepo** — pnpm workspaces, Turborepo, `packages/core`,
   `packages/db` (Drizzle schema + first migration), `apps/api` (Hono
   skeleton with health check), `apps/mobile` (Expo skeleton, web target
   only).
2. **Auth** — Better Auth wired up, email OTP to start. Sign up, sign in,
   session middleware on the API.
3. **Groups** — create group, join by invite code, list my groups.
4. **Photo upload** — presigned R2 upload flow, `POST /photos/confirm`,
   list a group's photo pool.
5. **Rotation engine + purge job** — the riskiest, most novel piece; build
   and test this in isolation before layering UI on top. Covers: cron
   trigger, group-timezone-aware "is this group due" check, random
   selection excluding already-shown photos, idempotent write via the
   `UNIQUE(group_id, local_date)` constraint, and the purge job that
   deletes the previous selection's blob + rows.
6. **Today's-photo screen + comments** — the main daily view, comment
   thread, view tracking ("who's seen today's photo"), and an explicit
   save/download action — saving the photo is encouraged, not something
   the client tries to prevent.
7. **Polish pass** — reactions, empty-pool handling, notifications-lite
   (in-app, no push yet since native isn't built).
8. **Deploy** — API to Cloudflare Workers, web to Cloudflare Pages, both
   wired to CI on push to `main`.
9. **(Later, once web is validated) Native** — `eas build`, TestFlight,
   push notifications via Expo Push, App Store / Play Store submission.
