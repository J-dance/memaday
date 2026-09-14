# CLAUDE.md

Guidance for Claude Code when working in this repo. This is a first punt —
update it as real conventions emerge once code exists.

## Project

memaday: a group photo-sharing app. Members upload photos to a group's pool;
once a day a photo is randomly selected for the group to view and comment
on; when the next one is selected, the previous photo and its comments are
hard-deleted everywhere.

**Current status: auth + identity keys + group creation/join/key-exchange +
encrypted photo upload work end-to-end; rotation and purge aren't built
yet.** `apps/api` is a Hono app with `/v1/health`, Better Auth at
`/v1/auth` (CORS + `trustedOrigins` scoped to `WEB_ORIGIN`), `/v1/groups`
routes (`apps/api/src/routes/groups.ts`) for create/join/pending-members/
admit, and `/v1/groups/:id/photos` routes (`apps/api/src/routes/photos.ts`)
for presigned-upload/confirm/list, backed by R2. `apps/mobile` has
functional (not polished) sign-up/sign-in/unlock
(`src/components/auth-gate.tsx`) and a Groups tab (repurposed from the
Expo template's Explore tab, `src/app/explore.tsx`) for creating/joining
groups (new members silently auto-admitted by any online key-holding
member's client — see
[`docs/DECISIONS.md`](docs/DECISIONS.md#new-members-are-admitted-to-a-group-silently-not-via-an-approval-prompt))
and for picking, downsizing/EXIF-stripping, encrypting, and uploading a
photo, plus listing/decrypting the group's pool as thumbnails
(`src/lib/photo-pipeline.ts`, `src/lib/photos-client.ts`). Crypto lives in
`packages/core/src/` (`identity.ts`, `group-key.ts`, `invite-code.ts`,
`photo.ts`), tested, and was also verified against the real API, Neon
database, and a live R2 bucket — not just single-user browser clicking.
Still verify against the actual repo state before assuming specifics —
this file is a summary, not a substitute for reading the code.

Read these before making architectural suggestions or writing code:

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — stack, system diagram, data model, deployment, repo layout
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — why each stack choice was made and what was rejected; don't re-propose a rejected alternative without new information
- [`docs/OPEN_QUESTIONS.md`](docs/OPEN_QUESTIONS.md) — unresolved product questions; currently none open
- [`docs/SCALING.md`](docs/SCALING.md) — what would change if usage grows past friend-group scale; not relevant to current build work
- [`docs/ENCRYPTION.md`](docs/ENCRYPTION.md) — the end-to-end encryption design (keys, wrapping, member join flow); read before touching auth, groups, or photo upload code
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — intended build order

## Stack (once implementation starts)

Monorepo (pnpm + Turborepo) · Hono API on Cloudflare Workers · Postgres
(Neon) + Drizzle · Cloudflare R2 for photo blobs (client-side E2E
encrypted, see `docs/ENCRYPTION.md`) · Better Auth · Expo (React Native +
web), web-first, native deferred. Full reasoning in `docs/DECISIONS.md`.

## This project is a learning project for the user

The user is building this to understand how everything works, not just to
get a working app shipped. This changes how to work here, beyond the usual
"do the task well":

- **During implementation, ask discussion questions rather than silently
  making the call and moving on** — especially at points where there's a
  real design choice (like the encryption tier, or the key-exchange flow
  design). Explain the trade-off, then ask, the way `docs/ENCRYPTION.md`
  was arrived at. Don't over-ask on genuinely mechanical steps (e.g.
  variable naming), but do ask when a choice actually shapes how the
  system works or would be a useful thing to understand.
- **Documentation should teach, not just record.** When adding to `docs/`,
  explain *why* and *how something works*, not only *what was decided* —
  see `docs/ENCRYPTION.md`'s "Concepts" section for the tone to match.
  Code comments can stay minimal as usual (see below), but `docs/` is
  where the "how does this actually work" explanations belong.
- When writing actual code later, prefer walking through non-obvious logic
  (e.g. the key-wrapping flow, the rotation job's idempotency) in
  conversation or in `docs/`, rather than assuming it's self-evident from
  the diff.

## Working conventions

- Prefer editing/creating docs in `docs/` over reintroducing the same
  planning discussion in chat — if a decision changes, update
  `docs/DECISIONS.md` rather than letting the reasoning live only in
  conversation history.
- Business logic belongs in framework-free TypeScript (`packages/core`,
  once it exists) — not in Hono route handlers or React components. See
  the "portability discipline" section of `docs/ARCHITECTURE.md`.
- Photo bytes go in R2, never in Postgres, and are end-to-end encrypted
  client-side before upload — never add server-side image processing
  (thumbnails, resizing, blurhash) since the server can't read the bytes.
  See `docs/ENCRYPTION.md`.
- API routes are versioned (`/v1/...`) from the first route written —
  native clients can't be force-updated later.
- Migrations are files in git (Drizzle Kit), applied in CI — never
  click-edited in a hosting dashboard.
- When a new architectural or product decision gets made in conversation,
  add it to `docs/DECISIONS.md` (or `docs/OPEN_QUESTIONS.md` if it's
  raised but not yet resolved) rather than only acting on it silently.
