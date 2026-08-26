# CLAUDE.md

Guidance for Claude Code when working in this repo. This is a first punt —
update it as real conventions emerge once code exists.

## Project

memaday: a group photo-sharing app. Members upload photos to a group's pool;
once a day a photo is randomly selected for the group to view and comment
on; when the next one is selected, the previous photo and its comments are
hard-deleted everywhere.

**Current status: planning only. No application code exists yet.** Don't
assume any file structure beyond what's actually in the repo — check before
referencing paths like `apps/api` or `packages/core`, they may not exist
yet.

Read these before making architectural suggestions or writing code:

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — stack, system diagram, data model, deployment, repo layout
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — why each stack choice was made and what was rejected; don't re-propose a rejected alternative without new information
- [`docs/OPEN_QUESTIONS.md`](docs/OPEN_QUESTIONS.md) — unresolved product questions; currently just empty-pool handling
- [`docs/SCALING.md`](docs/SCALING.md) — what would change if usage grows past friend-group scale; not relevant to current build work
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — intended build order

## Stack (once implementation starts)

Monorepo (pnpm + Turborepo) · Hono API on Cloudflare Workers · Postgres
(Neon) + Drizzle · Cloudflare R2 for photo blobs · Better Auth ·
Expo (React Native + web), web-first, native deferred. Full reasoning in
`docs/DECISIONS.md`.

## Working conventions

- Prefer editing/creating docs in `docs/` over reintroducing the same
  planning discussion in chat — if a decision changes, update
  `docs/DECISIONS.md` rather than letting the reasoning live only in
  conversation history.
- Business logic belongs in framework-free TypeScript (`packages/core`,
  once it exists) — not in Hono route handlers or React components. See
  the "portability discipline" section of `docs/ARCHITECTURE.md`.
- Photo bytes go in R2, never in Postgres. Metadata/relationships only in
  the database.
- API routes are versioned (`/v1/...`) from the first route written —
  native clients can't be force-updated later.
- Migrations are files in git (Drizzle Kit), applied in CI — never
  click-edited in a hosting dashboard.
- When a new architectural or product decision gets made in conversation,
  add it to `docs/DECISIONS.md` (or `docs/OPEN_QUESTIONS.md` if it's
  raised but not yet resolved) rather than only acting on it silently.
