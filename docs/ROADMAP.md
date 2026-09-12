# Roadmap

Planned build order. Steps are checked off as they land — check the actual
repo state before assuming a step is fully done, this list can drift.

1. **✅ Scaffold the monorepo** — pnpm workspaces, Turborepo,
   `packages/core` (empty placeholder), `packages/db` (Drizzle schema +
   first migration generated, not yet run against a real database),
   `apps/api` (Hono skeleton with `/v1/health`, deployable via
   `wrangler dev`/`deploy`), `apps/mobile` (Expo's default template, web
   target only). Everything typechecks and the one placeholder test
   passes (`pnpm typecheck`, `pnpm test`). Uses Node 22 (pinned via
   `.nvmrc` — Node 23 hit real Corepack/React Native tooling
   incompatibilities during setup) and Wrangler v4.
2. **Auth + identity keypair** — Better Auth wired up with email + password
   login (see [`DECISIONS.md`](DECISIONS.md#email--password-auth-not-email-otp)
   for why not OTP). On signup, client generates the user's X25519 keypair,
   uploads the public key, stores the password-encrypted private key. This
   has to be built alongside auth, not bolted on later — see
   [`ENCRYPTION.md`](ENCRYPTION.md).
3. **Groups + key exchange** — create group (generates + wraps the group
   key for the creator), join by invite code, and the "existing member
   wraps the key for a new member" handoff flow. The trickiest non-crypto
   part of the whole build — worth its own milestone rather than folding
   into generic "groups" work.
4. **Photo upload (encrypted)** — client-side downsize + EXIF strip +
   encrypt, presigned R2 upload flow, `POST /photos/confirm` with nonce,
   list + decrypt a group's photo pool.
5. **Rotation engine + purge job** — cron trigger, group-timezone-aware "is
   this group due" check, random selection excluding already-shown photos,
   idempotent write via the `UNIQUE(group_id, local_date)` constraint,
   empty-pool nudge-to-upload path, and the purge job that deletes the
   previous selection's blob + rows.
6. **Today's-photo screen + comments** — the main daily view, decrypt +
   display, encrypted comment thread, view tracking ("who's seen today's
   photo"), and an explicit save/download action — saving the photo is
   encouraged, not something the client tries to prevent.
7. **Polish pass** — reactions, member-removal key rotation, notifications-
   lite (in-app, no push yet since native isn't built).
8. **Deploy** — API to Cloudflare Workers, web to Cloudflare Pages, both
   wired to CI on push to `main`.
9. **(Later, once web is validated) Native** — swap `libsodium-wrappers`
   (WASM, doesn't run under Hermes) for a native-bindings crypto library,
   `eas build`, TestFlight, push notifications via Expo Push, App Store /
   Play Store submission.
