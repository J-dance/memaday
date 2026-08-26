# @memaday/mobile

The memaday client — Expo (React Native + Expo Router), web build only for
now. See the project root [`README.md`](../../README.md) and
[`docs/`](../../docs/) for what this app is and why.

Run from the repo root, not this directory — it's part of a pnpm/Turborepo
workspace, not a standalone project:

```bash
pnpm install    # once, from the repo root
pnpm --filter @memaday/mobile dev
```

See [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md) for the repo
layout and why this is a workspace package rather than its own repo.
