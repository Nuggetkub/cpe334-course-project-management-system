import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Tests run in their own PostgreSQL schema, derived from the normal DATABASE_URL
// (server/.env locally, the job env in CI). Never "public".
export const TEST_SCHEMA: string = "cpms_test";

export function baseDatabaseUrl(): string {
  const envFile = fileURLToPath(new URL("../.env", import.meta.url));
  if (!process.env.DATABASE_URL && existsSync(envFile)) process.loadEnvFile(envFile);
  const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error("Tests need a database. Copy server/.env.example to server/.env, or set DATABASE_URL.");
  }
  return url;
}

export function testDatabaseUrl(): string {
  const url = new URL(baseDatabaseUrl());
  url.searchParams.set("schema", TEST_SCHEMA);
  return url.toString();
}
