import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { createAuth } from "./auth.js";
import type { Bindings } from "./bindings.js";

// Every authenticated route (groups, and later photos/comments) needs "who
// is this", validated the same way — a fresh Better Auth instance per
// request (see auth.ts) reading the session cookie off the incoming
// request. Throws a 401 rather than returning null so route handlers don't
// each need their own "if no user" branch.
export async function requireUser(c: Context<{ Bindings: Bindings }>) {
  const auth = createAuth(c.env);
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) {
    throw new HTTPException(401, { message: "Not signed in" });
  }
  return session.user;
}
