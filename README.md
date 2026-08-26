# memaday

A group photo-sharing app: each group gets one randomly-selected photo per day.
Members view it and comment. When the next day's photo is selected, the
previous one — image and comments — is permanently deleted, everywhere.

**Status:** monorepo scaffolded (workspaces, empty `packages/core`, the
Drizzle schema + first migration in `packages/db`, a health-check-only
Hono API, and a default Expo skeleton). No product features built yet —
see [`docs/ROADMAP.md`](docs/ROADMAP.md) for what's next.

## Start here

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — stack, system diagram, data model, deployment
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — key decisions made so far and why
- [`docs/OPEN_QUESTIONS.md`](docs/OPEN_QUESTIONS.md) — unresolved product questions to settle before building
- [`docs/SCALING.md`](docs/SCALING.md) — what would need to change if usage grows beyond friend groups (not needed now)
- [`docs/ENCRYPTION.md`](docs/ENCRYPTION.md) — how the end-to-end encryption works, explained from first principles
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — planned build order once planning is done

## Core concept

1. A user creates a **group** and invites others.
2. Members **upload photos** to a shared pool over time.
3. Once a day (per group, on its own timezone/schedule), the app **randomly
   selects one unshown photo** from the pool.
4. Members **view and comment** on that photo through the day.
5. At the next rotation, the old photo and its comments are **hard-deleted**
   (blob storage + database rows) before the new one appears.

Privacy is a core feature, not an afterthought: photos and comments are
**end-to-end encrypted** — encrypted on a member's device before upload, so
the server only ever stores ciphertext it cannot read. See
[`docs/ENCRYPTION.md`](docs/ENCRYPTION.md).

## Repo layout

pnpm workspaces + Turborepo monorepo — see
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md#repo-layout) for the full
structure and why it's set up this way. Requires Node 22 (see `.nvmrc`) and
pnpm (via Corepack — run `corepack enable` if you don't have pnpm yet).

```bash
pnpm install
pnpm dev         # runs every app's dev script in parallel via Turborepo
pnpm typecheck   # tsc --noEmit across every package
pnpm test        # vitest across every package
```
