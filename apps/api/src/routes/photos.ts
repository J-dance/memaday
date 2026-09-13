import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { createDb, photos } from "@memaday/db";
import { requireUser } from "../session.js";
import { assertHoldsGroupKey } from "../group-membership.js";
import { presignPhotoUpload, photoStorageKey } from "../r2.js";
import type { Bindings } from "../bindings.js";

export const photosRoute = new Hono<{ Bindings: Bindings }>();

// Hands the client a presigned R2 PUT URL for one photo, but writes nothing
// to Postgres yet — the `photos` row (state: pending → ready) is created by
// POST /photos/confirm once the upload actually succeeds, so a photo id
// only exists in the database for an upload that's at least been attempted.
// Requires holding the group key (not just membership) since a member
// without the key couldn't have encrypted anything to upload anyway — see
// docs/ENCRYPTION.md.
photosRoute.post("/presign", async (c) => {
  const user = await requireUser(c);
  const { groupId } = await c.req.json<{ groupId: string }>();
  if (!groupId) {
    throw new HTTPException(400, { message: "groupId is required" });
  }

  const db = createDb(c.env.DATABASE_URL);
  await assertHoldsGroupKey(db, groupId, user.id);

  const photoId = crypto.randomUUID();
  const storageKey = photoStorageKey(groupId, photoId);
  const { uploadUrl, expiresInSeconds } = await presignPhotoUpload(
    c.env,
    storageKey,
  );

  return c.json({ photoId, storageKey, uploadUrl, expiresInSeconds });
});

// Registers a photo in Postgres once the client has actually PUT it to R2.
// The storage key is recomputed from (groupId, photoId) rather than taken
// from the request body — see photoStorageKey's doc comment in r2.ts — and
// existence is verified with a HEAD against R2 (via the plain binding, not
// the S3 API — see docs/DECISIONS.md) before the row is written, so a
// `photos` row can never point at an object that was never actually
// uploaded. `.onConflictDoNothing()` makes a retried confirm (e.g. a
// flaky-network resend) idempotent instead of a duplicate-key error.
photosRoute.post("/confirm", async (c) => {
  const user = await requireUser(c);
  const body = await c.req.json<{
    photoId: string;
    groupId: string;
    nonce: string;
    width: number;
    height: number;
    caption?: string;
    captionNonce?: string;
  }>();

  if (
    !body.photoId ||
    !body.groupId ||
    !body.nonce ||
    !body.width ||
    !body.height
  ) {
    throw new HTTPException(400, {
      message: "photoId, groupId, nonce, width, and height are required",
    });
  }
  // caption and captionNonce are a matched pair — see docs/ENCRYPTION.md's
  // "every ciphertext gets its own nonce" note. Neither makes sense
  // without the other.
  if (Boolean(body.caption) !== Boolean(body.captionNonce)) {
    throw new HTTPException(400, {
      message: "caption and captionNonce must be provided together",
    });
  }

  const db = createDb(c.env.DATABASE_URL);
  await assertHoldsGroupKey(db, body.groupId, user.id);

  const storageKey = photoStorageKey(body.groupId, body.photoId);
  const uploaded = await c.env.PHOTOS_BUCKET.head(storageKey);
  if (!uploaded) {
    throw new HTTPException(404, {
      message: "No upload found at this photo's storage key — PUT to the presigned URL before confirming",
    });
  }

  await db
    .insert(photos)
    .values({
      id: body.photoId,
      groupId: body.groupId,
      uploaderId: user.id,
      storageKey,
      width: body.width,
      height: body.height,
      nonce: body.nonce,
      caption: body.caption ?? null,
      captionNonce: body.captionNonce ?? null,
      state: "ready",
    })
    .onConflictDoNothing();

  return c.json(
    {
      id: body.photoId,
      groupId: body.groupId,
      storageKey,
      width: body.width,
      height: body.height,
      caption: body.caption ?? null,
      captionNonce: body.captionNonce ?? null,
      state: "ready",
    },
    201,
  );
});
