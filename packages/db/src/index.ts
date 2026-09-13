import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema.js";

export * from "./schema.js";

// Query-building helpers, re-exported rather than left for apps/api to
// install its own `drizzle-orm` dependency: pnpm's strict node_modules
// resolves that as a *separate* instance (different peer-dependency hash
// from this package's copy), and TypeScript then treats their `Column`/`SQL`
// types as structurally incompatible — every `eq(...)`/`and(...)` call
// fails to typecheck across the package boundary. Importing everything
// through this one instance avoids that entirely.
export { and, asc, desc, eq, isNull, isNotNull, ne, or, sql } from "drizzle-orm";

// Neon's HTTP driver, not a raw TCP `pg` connection: Cloudflare Workers
// can't hold a pooled TCP socket open the way a long-running Node server
// would, so this speaks to Neon over plain HTTP/fetch instead. Trade-off:
// this ties apps/api to Neon's driver specifically (see docs/SCALING.md /
// docs/DECISIONS.md) — the schema and SQL stay portable to any Postgres
// host, but switching *away* from Neon later means swapping this file's
// driver, not just a connection string, if the new host still runs on
// Workers. Moving off Workers to a long-running host (Node/Bun/Fly) would
// let this go back to a plain `pg` connection instead.
export function createDb(databaseUrl: string) {
  const sql = neon(databaseUrl);
  return drizzle(sql, { schema });
}

export type Database = ReturnType<typeof createDb>;
