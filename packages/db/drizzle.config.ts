import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    // Only needed for `drizzle-kit migrate`/`studio`, not for `generate`.
    url: process.env.DATABASE_URL ?? "",
  },
});
