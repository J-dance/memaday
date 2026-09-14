// Drizzle schema — mirrors the data model documented in
// docs/ARCHITECTURE.md and docs/ENCRYPTION.md. Keep those docs and this
// file in sync when either changes.
//
// `users`, `sessions`, `accounts`, `verifications` are Better Auth's own
// tables (email+password auth — see docs/DECISIONS.md for why not OTP).
// Their shape started from `npx better-auth generate` against
// apps/api/src/auth.ts, then was hand-adjusted to fit this repo's
// conventions: uuid ids (defaultRandom(), like every other table here,
// instead of Better Auth's default string ids — see `generateId: false`
// in auth.ts) and `withTimezone: true` timestamps. If auth.ts config
// changes (new fields, renamed models), regenerate and re-diff rather than
// hand-editing blind.

import {
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

// No "purged" state — a purged photo's row is hard-deleted outright (see
// docs/DECISIONS.md's "Purge deletes the photos row entirely" entry)
// rather than transitioning to a terminal state, so there's nothing for a
// fourth enum value to ever record.
export const photoStateEnum = pgEnum("photo_state", [
  "pending",
  "ready",
  "shown",
]);

export const groupRoleEnum = pgEnum("group_role", ["admin", "member"]);

export const devicePlatformEnum = pgEnum("device_platform", [
  "ios",
  "android",
]);

// --- Identity / auth --------------------------------------------------
//
// `users` mixes three kinds of columns: Better Auth's own core fields
// (id, displayName, email, emailVerified, image, createdAt, updatedAt),
// this app's fields (avatarKey), and the E2EE identity keypair fields
// Better Auth doesn't know about but stores for us via `additionalFields`
// (see docs/ENCRYPTION.md). `sessions`/`accounts`/`verifications` are
// entirely Better Auth's — `accounts` is where the hashed password lives
// for email+password login (one row per user, providerId "credential"),
// not on `users` itself.

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  displayName: text("display_name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  // Better Auth's generic profile-picture field. Unused for now — avatar
  // upload isn't built yet, and `avatarKey` below (an R2 key, not a URL)
  // is what that feature will actually use once it exists.
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),

  avatarKey: text("avatar_key"),

  // E2EE identity keypair — see docs/ENCRYPTION.md.
  publicKey: text("public_key").notNull(),
  encryptedPrivateKey: text("encrypted_private_key").notNull(),
  kdfSalt: text("kdf_salt").notNull(),
});

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("sessions_user_id_idx").on(t.userId)],
);

export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    password: text("password"), // hashed, only set for providerId "credential"
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
    }),
    scope: text("scope"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("accounts_user_id_idx").on(t.userId)],
);

// Short-lived tokens for flows like email verification / password reset —
// not user-facing accounts, no FK to `users` (identified by `identifier`,
// e.g. an email address, before an account necessarily exists).
export const verifications = pgTable(
  "verifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("verifications_identifier_idx").on(t.identifier)],
);

// --- Groups -----------------------------------------------------------

export const groups = pgTable("groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  timezone: text("timezone").notNull(),
  rotationHour: integer("rotation_hour").notNull().default(9),
  inviteCode: text("invite_code").notNull().unique(),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const groupMembers = pgTable(
  "group_members",
  {
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: groupRoleEnum("role").notNull().default("member"),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.groupId, t.userId] })],
);

// One row per (group, member): that member's copy of the group's
// symmetric key, encrypted for their public key. See docs/ENCRYPTION.md.
export const groupKeys = pgTable(
  "group_keys",
  {
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    wrappedKey: text("wrapped_key").notNull(),
  },
  (t) => [primaryKey({ columns: [t.groupId, t.userId] })],
);

// --- Photos & rotation ------------------------------------------------

export const photos = pgTable("photos", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("group_id")
    .notNull()
    .references(() => groups.id, { onDelete: "cascade" }),
  uploaderId: uuid("uploader_id")
    .notNull()
    .references(() => users.id),
  storageKey: text("storage_key").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  nonce: text("nonce").notNull(), // AEAD nonce for the photo bytes' ciphertext
  caption: text("caption"), // ciphertext, or null
  // A second, independent AEAD nonce for `caption` — required because it's
  // a second ciphertext under the same group key as the photo bytes, and
  // AEAD nonces must never repeat under one key (see docs/DECISIONS.md's
  // "Separate AEAD nonce for the caption" entry). Null exactly when
  // `caption` is null.
  captionNonce: text("caption_nonce"),
  state: photoStateEnum("state").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const dailySelections = pgTable(
  "daily_selections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    photoId: uuid("photo_id")
      .notNull()
      .references(() => photos.id),
    localDate: date("local_date").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    // starts_at + 12h — see docs/DECISIONS.md
    purgeAfter: timestamp("purge_after", { withTimezone: true }).notNull(),
  },
  (t) => [
    // Makes the rotation cron job idempotent: a double fire is a no-op.
    unique().on(t.groupId, t.localDate),
  ],
);

// --- Comments, views, reactions ----------------------------------------

export const comments = pgTable("comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  selectionId: uuid("selection_id")
    .notNull()
    .references(() => dailySelections.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  body: text("body").notNull(), // ciphertext
  // AEAD nonce for `body` — every comment is its own ciphertext under the
  // same group key as every photo and every other comment, so (per
  // docs/DECISIONS.md's "Separate AEAD nonce for the caption" entry, which
  // generalizes to any ciphertext sharing a key) it needs its own nonce,
  // not a shared or omitted one.
  nonce: text("nonce").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const views = pgTable(
  "views",
  {
    selectionId: uuid("selection_id")
      .notNull()
      .references(() => dailySelections.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    viewedAt: timestamp("viewed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.selectionId, t.userId] })],
);

// Shaped like `comments` (own uuid id, ciphertext + nonce), not a
// composite key on (selectionId, userId, emoji) — see
// docs/DECISIONS.md#reactions-are-e2e-encrypted-so-they-need-an-id-not-a-composite-key
// for why: once the emoji itself is ciphertext, two encryptions of the
// same emoji never produce the same bytes (fresh nonce every time), so
// the server can't use emoji equality to dedupe or to know which row to
// delete on "un-react." The client (which already decrypts every
// reaction to render them) is what decides "do I already have a reaction
// with this emoji" and either POSTs a new row or DELETEs the specific
// row it already knows the id of.
export const reactions = pgTable("reactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  selectionId: uuid("selection_id")
    .notNull()
    .references(() => dailySelections.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  emoji: text("emoji").notNull(), // ciphertext
  nonce: text("nonce").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// --- Devices (added when native ships) ----------------------------------

export const devices = pgTable("devices", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expoPushToken: text("expo_push_token").notNull(),
  platform: devicePlatformEnum("platform").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
