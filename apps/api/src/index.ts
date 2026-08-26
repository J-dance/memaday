import { Hono } from "hono";

// `Bindings` describes what's available on `c.env` at runtime — the
// Cloudflare Workers equivalent of environment variables / secrets.
// Nothing bound yet; DATABASE_URL etc. get added here as they're needed.
type Bindings = Record<string, never>;

const app = new Hono<{ Bindings: Bindings }>();

// API is versioned from the first route — see docs/ARCHITECTURE.md and
// docs/DECISIONS.md for why: native clients can't be force-updated, so
// /v1 has to stay stable once anything depends on it.
const v1 = app.basePath("/v1");

v1.get("/health", (c) => c.json({ status: "ok" }));

export default app;
