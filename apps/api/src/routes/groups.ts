import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import {
  and,
  asc,
  createDb,
  eq,
  groupKeys,
  groupMembers,
  groups,
  isNull,
  photos,
  users,
} from "@memaday/db";
import { generateInviteCode } from "@memaday/core";
import { requireUser } from "../session.js";
import { assertHoldsGroupKey } from "../group-membership.js";
import { presignPhotoDownload } from "../r2.js";
import type { Bindings } from "../bindings.js";

export const groupsRoute = new Hono<{ Bindings: Bindings }>();

// Creates a group and, in the same request, records the creator's own
// wrapped copy of the group key it just generated client-side — one
// atomic write, same "no half-created state" principle as signup (see
// docs/DECISIONS.md). Neon's HTTP driver has no interactive transactions
// (each request is a stateless HTTP call — see docs/DECISIONS.md's "Neon's
// HTTP driver" entry), so this uses `db.batch()`, which sends multiple
// statements as one request that Neon runs atomically server-side. Because
// statements in a batch can't see each other's generated ids, the group id
// is generated here instead of relying on the column's `defaultRandom()`.
groupsRoute.post("/", async (c) => {
  const user = await requireUser(c);
  const body = await c.req.json<{
    name: string;
    timezone: string;
    rotationHour?: number;
    wrappedKeyForSelf: string;
  }>();

  if (!body.name || !body.timezone || !body.wrappedKeyForSelf) {
    throw new HTTPException(400, {
      message: "name, timezone, and wrappedKeyForSelf are required",
    });
  }

  const db = createDb(c.env.DATABASE_URL);
  const groupId = crypto.randomUUID();
  const inviteCode = generateInviteCode();

  await db.batch([
    db.insert(groups).values({
      id: groupId,
      name: body.name,
      timezone: body.timezone,
      rotationHour: body.rotationHour ?? 9,
      inviteCode,
      createdBy: user.id,
    }),
    db.insert(groupMembers).values({
      groupId,
      userId: user.id,
      role: "admin",
    }),
    db.insert(groupKeys).values({
      groupId,
      userId: user.id,
      wrappedKey: body.wrappedKeyForSelf,
    }),
  ]);

  return c.json(
    { id: groupId, name: body.name, timezone: body.timezone, inviteCode },
    201,
  );
});

// Joining only records membership — it does NOT hand over a group key.
// There's no wrapped copy for this user yet; some existing key-holding
// member's client has to notice and wrap one (see the pending-members and
// keys routes below). `.onConflictDoNothing()` makes re-joining with the
// same code (e.g. a retried request) harmless rather than a 500.
groupsRoute.post("/join", async (c) => {
  const user = await requireUser(c);
  const { inviteCode } = await c.req.json<{ inviteCode: string }>();
  if (!inviteCode) {
    throw new HTTPException(400, { message: "inviteCode is required" });
  }

  const db = createDb(c.env.DATABASE_URL);
  const group = await db.query.groups.findFirst({
    where: eq(groups.inviteCode, inviteCode),
  });
  if (!group) {
    throw new HTTPException(404, { message: "Invalid invite code" });
  }

  await db
    .insert(groupMembers)
    .values({ groupId: group.id, userId: user.id, role: "member" })
    .onConflictDoNothing();

  return c.json({ id: group.id, name: group.name });
});

// Lists the caller's groups, including their own wrapped key for each
// (null until an existing member has admitted them — see
// docs/ENCRYPTION.md#3-adding-a-member). The client polls this same
// endpoint on a freshly-joined group to notice when that key arrives,
// rather than there being a separate "get my key" route.
groupsRoute.get("/", async (c) => {
  const user = await requireUser(c);
  const db = createDb(c.env.DATABASE_URL);

  const rows = await db
    .select({
      id: groups.id,
      name: groups.name,
      timezone: groups.timezone,
      rotationHour: groups.rotationHour,
      inviteCode: groups.inviteCode,
      wrappedKey: groupKeys.wrappedKey,
    })
    .from(groupMembers)
    .innerJoin(groups, eq(groups.id, groupMembers.groupId))
    .leftJoin(
      groupKeys,
      and(
        eq(groupKeys.groupId, groupMembers.groupId),
        eq(groupKeys.userId, groupMembers.userId),
      ),
    )
    .where(eq(groupMembers.userId, user.id));

  return c.json(rows);
});

// Members of this group who don't have a wrapped key yet. A key-holding
// member's client calls this (on app foreground, or a manual refresh —
// see docs/DECISIONS.md's "silent admit" choice) to find out who it needs
// to wrap a fresh key for.
groupsRoute.get("/:groupId/pending-members", async (c) => {
  const user = await requireUser(c);
  const groupId = c.req.param("groupId");
  const db = createDb(c.env.DATABASE_URL);

  await assertHoldsGroupKey(db, groupId, user.id);

  const pending = await db
    .select({ userId: users.id, publicKey: users.publicKey })
    .from(groupMembers)
    .innerJoin(users, eq(users.id, groupMembers.userId))
    .leftJoin(
      groupKeys,
      and(
        eq(groupKeys.groupId, groupMembers.groupId),
        eq(groupKeys.userId, groupMembers.userId),
      ),
    )
    .where(and(eq(groupMembers.groupId, groupId), isNull(groupKeys.wrappedKey)));

  return c.json(pending);
});

// The group's photo pool — everything uploaded and not yet shown or
// purged (`state: "ready"`). "Shown" (today's selected photo) and "purged"
// aren't part of this list; those belong to the daily-selection screen
// (docs/ROADMAP.md step 6), not the upload pool. Requires holding the group
// key for the same reason presign/confirm do (docs/ENCRYPTION.md) — a
// download URL is useless without the key to decrypt what it fetches, but
// this also keeps the URLs themselves from being handed to a keyless
// pending member. One presigned GET URL is signed per photo, per call —
// see docs/DECISIONS.md's "Photo downloads use presigned GET URLs too"
// entry for why this isn't a public bucket instead.
groupsRoute.get("/:groupId/photos", async (c) => {
  const user = await requireUser(c);
  const groupId = c.req.param("groupId");
  const db = createDb(c.env.DATABASE_URL);

  await assertHoldsGroupKey(db, groupId, user.id);

  const rows = await db
    .select({
      id: photos.id,
      uploaderId: photos.uploaderId,
      storageKey: photos.storageKey,
      width: photos.width,
      height: photos.height,
      nonce: photos.nonce,
      caption: photos.caption,
      createdAt: photos.createdAt,
    })
    .from(photos)
    .where(and(eq(photos.groupId, groupId), eq(photos.state, "ready")))
    .orderBy(asc(photos.createdAt));

  const withDownloadUrls = await Promise.all(
    rows.map(async ({ storageKey, ...photo }) => {
      const { downloadUrl, expiresInSeconds } = await presignPhotoDownload(
        c.env,
        storageKey,
      );
      return { ...photo, downloadUrl, expiresInSeconds };
    }),
  );

  return c.json(withDownloadUrls);
});

// Uploads a freshly-wrapped key for a pending member. `.onConflictDoNothing()`
// on the (groupId, userId) primary key is what makes it safe for two
// key-holding members to both be online and both attempt this for the same
// new member at once — whichever insert lands first wins, the other is a
// harmless no-op (see docs/DECISIONS.md).
groupsRoute.post("/:groupId/keys", async (c) => {
  const user = await requireUser(c);
  const groupId = c.req.param("groupId");
  const { userId, wrappedKey } = await c.req.json<{
    userId: string;
    wrappedKey: string;
  }>();
  if (!userId || !wrappedKey) {
    throw new HTTPException(400, {
      message: "userId and wrappedKey are required",
    });
  }

  const db = createDb(c.env.DATABASE_URL);
  await assertHoldsGroupKey(db, groupId, user.id);

  const targetIsMember = await db.query.groupMembers.findFirst({
    where: and(
      eq(groupMembers.groupId, groupId),
      eq(groupMembers.userId, userId),
    ),
  });
  if (!targetIsMember) {
    throw new HTTPException(404, { message: "Not a member of this group" });
  }

  await db
    .insert(groupKeys)
    .values({ groupId, userId, wrappedKey })
    .onConflictDoNothing();

  return c.body(null, 204);
});
