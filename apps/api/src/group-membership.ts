import { HTTPException } from "hono/http-exception";
import { and, createDb, eq, groupKeys, groupMembers } from "@memaday/db";

// A member is only trusted to act on a group's key material (see keys and
// pending-members in routes/groups.ts) or to upload photos (routes/photos.ts)
// once they hold the group key themselves — see
// docs/ENCRYPTION.md#3-adding-a-member. Someone who just joined and is still
// waiting on their own key can't reach either.
export async function assertHoldsGroupKey(
  db: ReturnType<typeof createDb>,
  groupId: string,
  userId: string,
) {
  const own = await db.query.groupKeys.findFirst({
    where: and(eq(groupKeys.groupId, groupId), eq(groupKeys.userId, userId)),
  });
  if (!own) {
    throw new HTTPException(403, {
      message: "Not a key-holding member of this group",
    });
  }
}

// Removing a member is destructive and triggers a key rotation for
// everyone else (see docs/DECISIONS.md's member-removal entry) — a higher
// bar than the "any key-holding member can admit" rule above, so this is
// admin-only. Today every group has exactly one admin (its creator — no
// promote-to-admin flow exists yet), but the check is written generally
// rather than special-cased to "is the creator."
export async function assertIsAdmin(
  db: ReturnType<typeof createDb>,
  groupId: string,
  userId: string,
) {
  const membership = await db.query.groupMembers.findFirst({
    where: and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)),
  });
  if (!membership || membership.role !== "admin") {
    throw new HTTPException(403, { message: "Admins only" });
  }
}
