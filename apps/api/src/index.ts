import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { createAuth } from "./auth.js";
import { groupsRoute } from "./routes/groups.js";
import type { Bindings } from "./bindings.js";

const app = new Hono<{ Bindings: Bindings }>();

// Hono's default HTTPException response is plain text, not JSON — every
// route (groups, and later photos/comments) throws HTTPException for
// expected failures (bad input, not signed in, not a member), so this
// makes error bodies uniformly `{ error: message }` for every client to
// parse the same way, instead of each route handler doing its own.
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status);
  }
  console.error(err);
  return c.json({ error: "Internal server error" }, 500);
});

// API is versioned from the first route — see docs/ARCHITECTURE.md and
// docs/DECISIONS.md for why: native clients can't be force-updated, so
// /v1 has to stay stable once anything depends on it.
const v1 = app.basePath("/v1");

v1.get("/health", (c) => c.json({ status: "ok" }));

// The web app's session is a cookie, so its cross-origin fetches need
// `credentials: true` here (and `credentials: "include"` client-side) —
// origin is read from `c.env` rather than hardcoded so each deployed
// environment (dev/staging/prod) allows only its own web origin, per
// docs/ARCHITECTURE.md#environments. Applied to all of /v1 (not just
// /auth/*) since every authenticated route needs the same credentialed
// cross-origin access.
v1.use(
  "*",
  cors({
    origin: (_origin, c) => c.env.WEB_ORIGIN,
    credentials: true,
  }),
);

// Better Auth builds its own sub-router; it's built fresh per request
// (rather than once at module scope) because `c.env` — and therefore the
// DB connection and secret it needs — only exists per-request in Workers.
v1.on(["GET", "POST"], "/auth/*", (c) => {
  const auth = createAuth(c.env);
  return auth.handler(c.req.raw);
});

v1.route("/groups", groupsRoute);

export default app;
