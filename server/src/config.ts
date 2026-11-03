import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Every setting comes from the environment (12-factor), so the same image runs
// locally, in CI and on Cloud Run. server/.env.example lists each one.

// Local development keeps its values in server/.env. Cloud Run has no such file:
// it injects env vars and Secret Manager secrets directly.
const envFile = fileURLToPath(new URL("../.env", import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);

export const PORT = Number(process.env.PORT) || 3000;

// 0.0.0.0, not localhost: inside a container the platform reaches the app through
// the container's network interface, not its loopback.
export const HOST = process.env.HOST ?? "0.0.0.0";

export const IS_PRODUCTION = process.env.NODE_ENV === "production";

export const CLIENT_ORIGINS = (process.env.CLIENT_ORIGINS ?? "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

// Built SPA. Resolves to /app/client/dist in the container (server code lives in
// /app/server/dist) and to <repo>/client/dist locally — the same relative layout.
export const CLIENT_DIST_DIR =
  process.env.CLIENT_DIST_DIR ?? fileURLToPath(new URL("../../client/dist", import.meta.url));
