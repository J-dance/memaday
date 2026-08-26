# memaday

A group photo-sharing app: each group gets one randomly-selected photo per day.
Members view it and comment. When the next day's photo is selected, the
previous one — image and comments — is permanently deleted, everywhere.

**Status:** planning — no application code has been written yet.

## Start here

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — stack, system diagram, data model, deployment
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — key decisions made so far and why
- [`docs/OPEN_QUESTIONS.md`](docs/OPEN_QUESTIONS.md) — unresolved product questions to settle before building
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — planned build order once planning is done

## Core concept

1. A user creates a **group** and invites others.
2. Members **upload photos** to a shared pool over time.
3. Once a day (per group, on its own timezone/schedule), the app **randomly
   selects one unshown photo** from the pool.
4. Members **view and comment** on that photo through the day.
5. At the next rotation, the old photo and its comments are **hard-deleted**
   (blob storage + database rows) before the new one appears.

## Repo layout (planned)

This will become a monorepo once implementation starts — see
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md#repo-layout) for the intended
structure. Nothing has been scaffolded yet.
