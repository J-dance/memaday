// Drizzle schema — mirrors the data model documented in
// docs/ARCHITECTURE.md and docs/ENCRYPTION.md. Keep those docs and this
// file in sync when either changes.
//
// NOTE on `users`: this table is a draft. Wiring up Better Auth
// (docs/ROADMAP.md step 2) will likely require reconciling these columns
// with whatever shape its Drizzle adapter expects for its own
// user/session/account tables — expect this file to change then.

import {
  date,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

export const photoStateEnum = pgEnum("photo_state", [
  "pending",
  "ready",
  "shown",
  "purged",
]);

export const groupRoleEnum = pgEnum("group_role", ["admin", "member"]);

export const devicePlatformEnum = pgEnum("device_platform", [
  "ios",
  "android",
]);

// --- Identity -------------------------------------------------------------

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  avatarKey: text("avatar_key"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),

  // E2EE identity keypair — see docs/ENCRYPTION.md.
  publicKey: text("public_key").notNull(),
  encryptedPrivateKey: text("encrypted_private_key").notNull(),
  kdfSalt: text("kdf_salt").notNull(),
});

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
  nonce: text("nonce").notNull(), // AEAD nonce for this photo's ciphertext
  caption: text("caption"), // ciphertext, or null
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

export const reactions = pgTable(
  "reactions",
  {
    selectionId: uuid("selection_id")
      .notNull()
      .references(() => dailySelections.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    emoji: text("emoji").notNull(),
  },
  (t) => [primaryKey({ columns: [t.selectionId, t.userId, t.emoji] })],
);

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
