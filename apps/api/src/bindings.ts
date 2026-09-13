// `Bindings` describes what's available on `c.env` at runtime — the
// Cloudflare Workers equivalent of environment variables / secrets. Shared
// by index.ts, auth.ts, session.ts, and every route module so there's one
// definition to keep in sync with wrangler.jsonc / .dev.vars.
export type Bindings = {
  DATABASE_URL: string;
  BETTER_AUTH_SECRET: string;
  WEB_ORIGIN: string;

  // R2 photo storage — see docs/DECISIONS.md's "Presigned R2 uploads via
  // the S3 API" entry for why this is a separate S3-API credential rather
  // than the plain R2 binding. ACCOUNT_ID and BUCKET_NAME aren't secret
  // (they're in wrangler.jsonc `vars`); the key pair is (`.dev.vars`
  // locally, `wrangler secret put` once staging/prod exist).
  R2_ACCOUNT_ID: string;
  R2_BUCKET_NAME: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  // The native binding — a real Workers binding (see wrangler.jsonc
  // `r2_buckets`), not an env var, but declared here alongside the rest of
  // what a route needs off `c.env`.
  PHOTOS_BUCKET: R2Bucket;
};
