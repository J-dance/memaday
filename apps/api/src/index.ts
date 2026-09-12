import { Hono } from "hono";
import { createAuth } from "./auth.js";

// `Bindings` describes what's available on `c.env` at runtime — the
// Cloudflare Workers equivalent of environment variables / secrets.
type Bindings = {
  DATABASE_URL: string;
  BETTER_AUTH_SECRET: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// API is versioned from the first route — see docs/ARCHITECTURE.md and
// docs/DECISIONS.md for why: native clients can't be force-updated, so
// /v1 has to stay stable once anything depends on it.
const v1 = app.basePath("/v1");

v1.get("/health", (c) => c.json({ status: "ok" }));

// Better Auth builds its own sub-router; it's built fresh per request
// (rather than once at module scope) because `c.env` — and therefore the
// DB connection and secret it needs — only exists per-request in Workers.
v1.on(["GET", "POST"], "/auth/*", (c) => {
  const auth = createAuth(c.env);
  return auth.handler(c.req.raw);
});

export default app;
