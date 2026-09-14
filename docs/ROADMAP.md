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
2. **✅ Auth + identity keypair** — Better Auth wired up with email +
   password login (see
   [`DECISIONS.md`](DECISIONS.md#email--password-auth-not-email-otp) for
   why not OTP). On signup, the client generates the user's X25519 keypair
   (`generateIdentityKeypair` in
   [`packages/core/src/identity.ts`](../packages/core/src/identity.ts)) and
   uploads the public key plus the password-encrypted private key in the
   same request. `apps/mobile` has minimal but functional sign-up/sign-in
   screens wired to it (`AuthGate` in `src/components/auth-gate.tsx`),
   including the "session cookie survived a reload but the in-memory key
   didn't" unlock-only path — see [`ENCRYPTION.md`](ENCRYPTION.md).
   Verified end-to-end against a real Neon database and `wrangler dev`, not
   just typechecked.
3. **✅ Groups + key exchange** — create group (`POST /v1/groups`, generates
   + wraps the group key for the creator in one atomic `db.batch()`), join
   by invite code (`POST /v1/groups/join`, membership only — no key yet),
   and the "existing member wraps the key for a new member" handoff flow
   (`GET /v1/groups/:id/pending-members` + `POST /v1/groups/:id/keys`,
   silent/automatic — see
   [`DECISIONS.md`](DECISIONS.md#new-members-are-admitted-to-a-group-silently-not-via-an-approval-prompt)).
   Crypto in `packages/core/src/group-key.ts`
   (`crypto_box_seal`/`crypto_box_seal_open`), tested. `apps/mobile`'s
   Groups tab (repurposed from the Expo template's Explore tab) can
   create, join, and auto-admit. Verified end-to-end with a two-identity
   integration check against the real API (not just single-user
   browser-clicking) — member B ends up with the exact same group key
   member A generated, and a non-member is correctly forbidden from the
   pending-members/keys routes.
4. **✅ Photo upload (encrypted)** — client-side downsize + EXIF strip
   (`expo-image-manipulator` re-encode) + encrypt with XChaCha20-Poly1305
   under the group key (`packages/core/src/photo.ts`), presigned R2 upload
   flow (`apps/api/src/routes/photos.ts`), `POST /v1/groups/:id/photos/confirm`
   with separate nonces for the photo bytes and caption (two independent
   ciphertexts need independent nonces — reusing one is a real AEAD
   vulnerability, not just style), list + decrypt a group's photo pool.
   `apps/mobile`'s Groups tab can pick, upload, and render the pool as
   thumbnails (`src/lib/photo-pipeline.ts`, `src/lib/photos-client.ts`).
   Verified in a real browser session against the live R2 bucket and Neon
   database, end to end: pick → resize/strip EXIF → encrypt → presign → PUT
   → confirm → list → decrypt → render. Also surfaced that presigned R2
   URLs work from curl but need an explicit bucket CORS policy for browser
   PUT/GET — see
   [`DECISIONS.md`](DECISIONS.md#r2-bucket-needs-an-explicit-cors-policy-for-browser-uploadsdownloads)
   (staging/prod will each need their own).
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
8. **Deploy** — staging + prod environments (Neon branch, Worker, R2
   bucket, secrets — one full set per environment, see
   [`ARCHITECTURE.md`](ARCHITECTURE.md#environments)), wired to CI: push to
   `staging` deploys staging, merging `staging` into `main` deploys prod.
9. **(Later, once web is validated) Native** — swap `libsodium-wrappers`
   (WASM, doesn't run under Hermes) for a native-bindings crypto library,
   `eas build`, TestFlight, push notifications via Expo Push, App Store /
   Play Store submission.
