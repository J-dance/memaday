import {
  and,
  createDb,
  dailySelections,
  desc,
  eq,
  groups,
  lte,
  photos,
  sql,
} from "@memaday/db";
import { checkRotationDue, computeExpiresAt, computePurgeAfter } from "@memaday/core";
import type { Bindings } from "./bindings.js";

// One sweep over every group, selecting a new photo for whichever ones are
// due. Runs hourly off a Cloudflare Cron Trigger (wrangler.jsonc), not
// on-request — see docs/DECISIONS.md's "Rotation and deletion are
// cron-driven" entry. `now` is a parameter (default `new Date()`) so tests
// can drive it directly instead of mocking the system clock.
export async function runRotationSweep(env: Bindings, now = new Date()) {
  const db = createDb(env.DATABASE_URL);
  const allGroups = await db
    .select({ id: groups.id, timezone: groups.timezone, rotationHour: groups.rotationHour })
    .from(groups);

  for (const group of allGroups) {
    const { localDate, due } = checkRotationDue(now, group.timezone, group.rotationHour);
    if (!due) continue;

    // Idempotency check first, before touching any photo — checking this
    // via `UNIQUE(group_id, local_date)` alone (i.e. just attempting the
    // insert and catching a conflict) would still burn a photo's one-shot
    // "ready → shown" transition on every redundant hourly run for the
    // rest of the day, not just the first.
    const alreadyRotated = await db.query.dailySelections.findFirst({
      where: and(eq(dailySelections.groupId, group.id), eq(dailySelections.localDate, localDate)),
    });
    if (alreadyRotated) continue;

    // `ORDER BY random()` is a full-table shuffle, fine at this app's
    // friend-group scale (see docs/DECISIONS.md's "Scale target" entry) —
    // would need a smarter sampling strategy if a group's pool ever grew
    // into the thousands.
    const [candidate] = await db
      .select({ id: photos.id })
      .from(photos)
      .where(and(eq(photos.groupId, group.id), eq(photos.state, "ready")))
      .orderBy(sql`random()`)
      .limit(1);

    // No eligible (unshown) photo — record nothing for today and leave it
    // there. The absence of a selection *is* the nudge: the today's-photo
    // screen (docs/ROADMAP.md step 6) has nothing to show and prompts
    // upload instead, no separate notification plumbing needed yet.
    if (!candidate) continue;

    // The group's currently-live selection (yesterday's, ordinarily), if
    // any — found *before* inserting today's row so this can't just find
    // itself. Its purge_after gets moved up to "12h after today's
    // selection" below, per docs/DECISIONS.md's "Purge delay: 12 hours
    // after the next rotation" entry: a selection is purged 12h after the
    // *next* one starts, not 12h into its own day. Left alone, it would
    // still have the ~24h fallback purge_after it was inserted with
    // (see below) — hours too early, and with no overlap for someone
    // mid-comment at the exact rotation moment.
    const previous = await db.query.dailySelections.findFirst({
      where: eq(dailySelections.groupId, group.id),
      orderBy: desc(dailySelections.startsAt),
    });

    const startsAt = now;
    await db.batch([
      db
        .insert(dailySelections)
        .values({
          groupId: group.id,
          photoId: candidate.id,
          localDate,
          startsAt,
          expiresAt: computeExpiresAt(startsAt),
          // Fallback only: this row has no successor yet to set its real
          // purge_after (12h after whatever rotation eventually follows
          // it). ~24h out matches the normal one-rotation-per-day cadence,
          // so a group that stops rotating (e.g. empty pool) still purges
          // on roughly the schedule a live one would have overwritten
          // this with anyway.
          purgeAfter: computeExpiresAt(startsAt),
        })
        .onConflictDoNothing(),
      db.update(photos).set({ state: "shown" }).where(eq(photos.id, candidate.id)),
    ]);

    if (previous) {
      await db
        .update(dailySelections)
        .set({ purgeAfter: computePurgeAfter(startsAt) })
        .where(eq(dailySelections.id, previous.id));
    }
  }
}

// Hard-deletes every selection whose purge time has passed: the R2 blob,
// the `photos` row, and (via cascade) the `daily_selections` row plus its
// comments/views/reactions — see docs/DECISIONS.md's "Purge deletes the
// photos row entirely" entry. The blob is deleted before the DB rows so a
// crash between the two leaves, at worst, DB rows still pointing at an
// already-gone blob (harmless, cleaned up by the retry) rather than an
// orphaned blob with no surviving row to ever find it again.
export async function runPurgeSweep(env: Bindings, now = new Date()) {
  const db = createDb(env.DATABASE_URL);
  const due = await db
    .select({
      selectionId: dailySelections.id,
      photoId: photos.id,
      storageKey: photos.storageKey,
    })
    .from(dailySelections)
    .innerJoin(photos, eq(photos.id, dailySelections.photoId))
    .where(lte(dailySelections.purgeAfter, now));

  for (const row of due) {
    await env.PHOTOS_BUCKET.delete(row.storageKey);
    await db.batch([
      // Deleted first: daily_selections.photo_id has no ON DELETE CASCADE
      // of its own, so the photos row can't go while a selection still
      // references it.
      db.delete(dailySelections).where(eq(dailySelections.id, row.selectionId)),
      db.delete(photos).where(eq(photos.id, row.photoId)),
    ]);
  }
}

export async function runScheduled(env: Bindings, now = new Date()) {
  await runRotationSweep(env, now);
  await runPurgeSweep(env, now);
}
