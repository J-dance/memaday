import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { createDb } from "@memaday/db";
import type { Bindings } from "./bindings.js";

// Cloudflare Workers bindings only exist per-request (via `c.env`), so the
// Better Auth instance has to be built fresh per request rather than once
// at module scope — same reason `createDb` in packages/db is a factory
// function instead of a module-level singleton.
export function createAuth(env: Bindings) {
  const db = createDb(env.DATABASE_URL);

  return betterAuth({
    database: drizzleAdapter(db, { provider: "pg" }),
    secret: env.BETTER_AUTH_SECRET,
    // Better Auth's own CSRF check on state-changing requests (separate
    // from the CORS middleware in index.ts, which is what lets the
    // browser's fetch through in the first place).
    trustedOrigins: [env.WEB_ORIGIN],
    // Mounted under /v1 like every other route — see docs/ARCHITECTURE.md
    // on why the API is versioned from the first route.
    basePath: "/v1/auth",
    // IDs are Postgres-generated UUIDs (defaultRandom() in the schema),
    // like every other table in this repo — not Better Auth's default
    // string IDs.
    advanced: {
      database: {
        generateId: false,
      },
    },
    emailAndPassword: {
      enabled: true,
    },
    user: {
      modelName: "users",
      fields: {
        name: "displayName",
      },
      additionalFields: {
        publicKey: { type: "string", required: true },
        encryptedPrivateKey: { type: "string", required: true },
        kdfSalt: { type: "string", required: true },
      },
    },
    session: {
      modelName: "sessions",
    },
    account: {
      modelName: "accounts",
    },
    verification: {
      modelName: "verifications",
    },
  });
}
