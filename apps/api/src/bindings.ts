// `Bindings` describes what's available on `c.env` at runtime — the
// Cloudflare Workers equivalent of environment variables / secrets. Shared
// by index.ts, auth.ts, session.ts, and every route module so there's one
// definition to keep in sync with wrangler.jsonc / .dev.vars.
export type Bindings = {
  DATABASE_URL: string;
  BETTER_AUTH_SECRET: string;
  WEB_ORIGIN: string;
};
