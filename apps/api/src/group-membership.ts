import { HTTPException } from "hono/http-exception";
import { and, createDb, eq, groupKeys } from "@memaday/db";

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
