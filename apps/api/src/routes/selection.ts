import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import {
  asc,
  comments,
  createDb,
  dailySelections,
  desc,
  eq,
  photos,
  users,
  views,
  type Database,
} from "@memaday/db";
import { requireUser } from "../session.js";
import { assertHoldsGroupKey } from "../group-membership.js";
import { presignPhotoDownload } from "../r2.js";
import type { Bindings } from "../bindings.js";

export const selectionRoute = new Hono<{ Bindings: Bindings }>();

// A group's "today's photo" is just its most recent selection — during the
// ~12h overlap window after a rotation (see docs/DECISIONS.md's "Purge
// delay" entry) an older, not-yet-purged row can still exist alongside it,
// but the newest one is always what the screen shows. No selection at all
// (empty pool, or the group hasn't had its first rotation yet) is a valid,
// expected state, not an error — every route below treats `null` as
// "nothing to show/comment on/view" rather than throwing.
async function getCurrentSelection(db: Database, groupId: string) {
  return db.query.dailySelections.findFirst({
    where: eq(dailySelections.groupId, groupId),
    orderBy: desc(dailySelections.startsAt),
  });
}

// Today's selection, with a presigned download URL for its photo (same
// short-lived-GET approach as the group photo pool — see
// docs/DECISIONS.md's "Photo downloads use presigned GET URLs too" entry)
// and the list of members who've viewed it so far.
selectionRoute.get("/:groupId/today", async (c) => {
  const user = await requireUser(c);
  const groupId = c.req.param("groupId");
  const db = createDb(c.env.DATABASE_URL);

  await assertHoldsGroupKey(db, groupId, user.id);

  const selection = await getCurrentSelection(db, groupId);
  if (!selection) {
    return c.json({ selection: null });
  }

  const photo = await db.query.photos.findFirst({
    where: eq(photos.id, selection.photoId),
  });
  // Shouldn't happen (no FK cascade lets this row outlive its photo — see
  // docs/DECISIONS.md's "Purge deletes the photos row entirely" entry, the
  // two are always deleted together), but a selection whose photo is
  // somehow gone has nothing renderable — treat it the same as no
  // selection rather than 500ing the whole screen.
  if (!photo) {
    return c.json({ selection: null });
  }

  const { downloadUrl, expiresInSeconds } = await presignPhotoDownload(
    c.env,
    photo.storageKey,
  );

  const viewers = await db
    .select({ userId: users.id, displayName: users.displayName, viewedAt: views.viewedAt })
    .from(views)
    .innerJoin(users, eq(users.id, views.userId))
    .where(eq(views.selectionId, selection.id));

  return c.json({
    selection: {
      id: selection.id,
      localDate: selection.localDate,
      startsAt: selection.startsAt,
      expiresAt: selection.expiresAt,
      photoId: photo.id,
      uploaderId: photo.uploaderId,
      width: photo.width,
      height: photo.height,
      nonce: photo.nonce,
      caption: photo.caption,
      captionNonce: photo.captionNonce,
      downloadUrl,
      expiresInSeconds,
    },
    views: viewers,
  });
});

// Records that the caller has seen today's selection. `.onConflictDoNothing()`
// on the (selectionId, userId) primary key makes repeat calls (e.g. the
// screen re-firing this on every foreground) harmless.
selectionRoute.post("/:groupId/today/view", async (c) => {
  const user = await requireUser(c);
  const groupId = c.req.param("groupId");
  const db = createDb(c.env.DATABASE_URL);

  await assertHoldsGroupKey(db, groupId, user.id);

  const selection = await getCurrentSelection(db, groupId);
  if (!selection) {
    throw new HTTPException(404, { message: "No current selection to view" });
  }

  await db
    .insert(views)
    .values({ selectionId: selection.id, userId: user.id })
    .onConflictDoNothing();

  return c.body(null, 204);
});

// Comments on today's selection, oldest first. Bodies are ciphertext —
// this route never sees plaintext, only shuttles it (see docs/ENCRYPTION.md).
selectionRoute.get("/:groupId/today/comments", async (c) => {
  const user = await requireUser(c);
  const groupId = c.req.param("groupId");
  const db = createDb(c.env.DATABASE_URL);

  await assertHoldsGroupKey(db, groupId, user.id);

  const selection = await getCurrentSelection(db, groupId);
  if (!selection) {
    return c.json([]);
  }

  const rows = await db
    .select({
      id: comments.id,
      userId: comments.userId,
      displayName: users.displayName,
      body: comments.body,
      nonce: comments.nonce,
      createdAt: comments.createdAt,
    })
    .from(comments)
    .innerJoin(users, eq(users.id, comments.userId))
    .where(eq(comments.selectionId, selection.id))
    .orderBy(asc(comments.createdAt));

  return c.json(rows);
});

selectionRoute.post("/:groupId/today/comments", async (c) => {
  const user = await requireUser(c);
  const groupId = c.req.param("groupId");
  const body = await c.req.json<{ body: string; nonce: string }>();
  if (!body.body || !body.nonce) {
    throw new HTTPException(400, { message: "body and nonce are required" });
  }

  const db = createDb(c.env.DATABASE_URL);
  await assertHoldsGroupKey(db, groupId, user.id);

  const selection = await getCurrentSelection(db, groupId);
  if (!selection) {
    throw new HTTPException(404, { message: "No current selection to comment on" });
  }

  const id = crypto.randomUUID();
  const createdAt = new Date();
  await db
    .insert(comments)
    .values({ id, selectionId: selection.id, userId: user.id, body: body.body, nonce: body.nonce, createdAt });

  return c.json(
    {
      id,
      userId: user.id,
      displayName: user.name,
      body: body.body,
      nonce: body.nonce,
      createdAt,
    },
    201,
  );
});
