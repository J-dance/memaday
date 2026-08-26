# Architecture

## Stack summary

| Layer | Choice | Why |
|---|---|---|
| Repo | pnpm workspaces + Turborepo monorepo | Web app and API share TypeScript types (Zod schemas) with no drift; native apps added later without a rewrite |
| API | Hono (TypeScript) on Cloudflare Workers | Free tier (100k req/day), fast, and portable — Hono runs unchanged on Node/Bun/Deno/Fly/Cloud Run if we ever migrate off Workers |
| Database | Postgres (Neon, free tier) + Drizzle ORM | Plain SQL schema we own; any Postgres host works, migration is a connection-string change |
| Blob storage | Cloudflare R2 (S3-compatible) | Free egress — matters a lot for an image-heavy app; swappable for any S3-compatible provider |
| Auth | Better Auth, self-hosted (tables live in our own Postgres) | Keeps the user table portable, unlike Clerk/Supabase Auth which own it |
| Scheduler | Cloudflare Cron Trigger (hourly) | Drives the daily rotation + purge job; replaceable with any cron runner |
| Client | Expo (React Native + Expo Router), web build only for now | One UI codebase; native iOS/Android added later via the same project, no rewrite |
| Push (future) | Expo Push | Free wrapper over APNs/FCM, added when native ships |
| Encryption | End-to-end via libsodium (client-side) | Server stores ciphertext only — can't read photos/comments even in principle. Full design in [`ENCRYPTION.md`](ENCRYPTION.md) |

See [`DECISIONS.md`](DECISIONS.md) for the reasoning and alternatives considered
for each of these.

Target scale is friend groups, not the general public — see
[`SCALING.md`](SCALING.md) for what would need to change if that ever
grows, and roughly when. None of it needs to be built now.

## System diagram

```
Expo app (web build now; iOS/Android later, same codebase)
        │  HTTPS, OpenAPI-typed client, Bearer session
        ▼
Hono API (Cloudflare Workers) ──┬── Postgres (Neon)   users, groups, photos, selections, comments
                                 ├── R2 (presigned)    photo blobs
                                 └── Queue             purge jobs, push fanout (future)
        ▲
Cron (hourly) → find groups due to rotate this hour → select photo → purge previous → notify
```

**Upload path (3-legged, bytes never touch our server in any readable
form):**
client downsizes the image, strips EXIF, and **encrypts it with the
group's key** → client asks API for a presigned R2 PUT URL → client
uploads the ciphertext directly to R2 → client calls `POST /photos/confirm`
(including the encryption nonce) to register it in Postgres. Full
encryption design, including where keys come from and how they're shared
between group members, is in [`ENCRYPTION.md`](ENCRYPTION.md) — read that
before touching upload or group-membership code.

## Data model (draft — will change during implementation)

```
users(id, email, display_name, avatar_key, created_at,
      public_key, encrypted_private_key, kdf_salt)             -- see ENCRYPTION.md

groups(id, name, timezone, rotation_hour, invite_code, created_by)

group_members(group_id, user_id, role, joined_at)              -- composite PK

group_keys(group_id, user_id, wrapped_key)                     -- see ENCRYPTION.md

photos(id, group_id, uploader_id, storage_key, width, height,
       nonce, caption, state: pending|ready|shown|purged, created_at)

daily_selections(id, group_id, photo_id, local_date, starts_at,
                  expires_at, purge_after)                     -- UNIQUE(group_id, local_date); purge_after = starts_at + 12h

comments(id, selection_id, user_id, body, created_at)          -- body is ciphertext; FK cascade on selection delete

views(selection_id, user_id, viewed_at)                        -- "who has seen today's photo"

reactions(selection_id, user_id, emoji)

devices(user_id, expo_push_token, platform)                    -- added when native ships
```

Notes:
- `comments` and `views` hang off the **daily selection**, not the photo
  directly — this makes the "delete everything" cascade unambiguous.
  Comments are fully deleted with the photo, no memory is kept (see
  [`DECISIONS.md`](DECISIONS.md)).
- `UNIQUE(group_id, local_date)` on `daily_selections` makes the rotation
  job idempotent — a double cron fire is a no-op, not a duplicate photo.
- Rotation is a **group-level** event on the group's own timezone +
  rotation hour, not a single global midnight — a group spread across
  timezones still sees the same photo at the same time.
- `photos.state` only ever moves forward (`pending → ready → shown →
  purged`) — a photo can be selected once, ever. No path back to `ready`.
- The previous day's selection is hard-purged (blob + rows) 12 hours after
  the new one starts, via the same hourly cron sweep.
- If a group has no eligible (unshown) photos at rotation time, no
  selection is recorded for that date — members are nudged to upload
  instead (see [`DECISIONS.md`](DECISIONS.md)).
- No `blurhash` column — a blurhash would leak visual content to the
  server, which the E2EE design doesn't allow. See
  [`ENCRYPTION.md`](ENCRYPTION.md) for what this and the other columns
  above mean and why.

## Repo layout

```
memaday/
├── apps/
│   ├── api/              Hono backend, deploys to Cloudflare Workers
│   └── mobile/            Expo app — web build now, iOS/Android later
├── packages/
│   ├── core/              Business logic (rotation rules, validation) — no framework imports
│   ├── db/                Drizzle schema + migrations, used only by apps/api
│   └── api-client/        Typed fetch client generated from the API's OpenAPI spec, used by apps/mobile
├── docs/
├── package.json           workspace root
├── pnpm-workspace.yaml
└── turbo.json
```

Nothing under `apps/` or `packages/` exists yet — this is the intended shape
once implementation starts.

## Deployment

API and web app deploy **independently**, even though they share a repo:

- **API**: push to `main` → GitHub Actions runs `wrangler deploy` (path-filtered
  to `apps/api/**`, `packages/core/**`, `packages/db/**`) → live on Cloudflare
  Workers in ~seconds. Rollback is redeploying the previous Worker version.
- **Web**: push to `main` → GitHub Actions runs `expo export -p web`
  (path-filtered to `apps/mobile/**`, `packages/core/**`) → static output
  deployed to Cloudflare Pages.
- **Native** (later): manual `eas build` + store submission. Not tied to
  every commit — App Store/Play Store review adds days of lag, so the API
  is versioned (`/v1`, `/v2`) to stay backward-compatible with whatever
  binary version is still installed on users' phones.

## Portability discipline

The point of these choices is that "free backend" doesn't become "locked
into one vendor's free tier forever." Concretely:

1. **Ports & adapters** — `PhotoStore`, `Mailer`, `PushSender`, `Clock` are
   interfaces in `packages/core`; R2/Expo Push/etc. are swappable
   implementations behind them.
2. **Business logic has zero framework imports** — rotation rules, purge
   logic, and validation live in plain TypeScript in `packages/core`. Hono
   route handlers stay thin (parse → call service → serialize), so leaving
   Workers means rewriting routing glue, not the app.
3. **No vendor-specific SQL** — e.g. no reliance on Supabase Row-Level
   Security as the only authorization layer; authorization is enforced in
   the service layer, where it's testable and portable.
4. **API is versioned from day one** (`/v1/...`) since native clients can't
   be force-updated.
5. **Migrations live in git** (Drizzle Kit) and run in CI — never
   click-edited in a hosting dashboard.
