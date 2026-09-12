import { Hono } from "hono";
import { cors } from "hono/cors";
import { createAuth } from "./auth.js";

// `Bindings` describes what's available on `c.env` at runtime — the
// Cloudflare Workers equivalent of environment variables / secrets.
type Bindings = {
  DATABASE_URL: string;
  BETTER_AUTH_SECRET: string;
  WEB_ORIGIN: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// API is versioned from the first route — see docs/ARCHITECTURE.md and
// docs/DECISIONS.md for why: native clients can't be force-updated, so
// /v1 has to stay stable once anything depends on it.
const v1 = app.basePath("/v1");

v1.get("/health", (c) => c.json({ status: "ok" }));

// The web app's session is a cookie, so its cross-origin fetches need
// `credentials: true` here (and `credentials: "include"` client-side) —
// origin is read from `c.env` rather than hardcoded so each deployed
// environment (dev/staging/prod) allows only its own web origin, per
// docs/ARCHITECTURE.md#environments.
v1.use(
  "/auth/*",
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

export default app;
