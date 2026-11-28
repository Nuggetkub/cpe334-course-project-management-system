// NFR-09 / TEST-12.4p timing run (contract v0.3 §3): `npm run perf:nfr09`.
// Env: PERF_BASE_URL, PERF_DEMO_PASSWORD (typed in, never committed), optional PERF_EMAIL and
// PERF_COLD=idle|warm|unknown. Writes perf-nfr09-<date>.md and .json in the current directory.
// Exit code: 0 all PASS, 1 any FAIL, 2 error (no result).

import { writeFileSync } from "node:fs";
import { PERF_SUPERVISOR_EMAIL } from "../prisma/perf-seed.js";
import { runPerf, type ColdState } from "./perf-nfr09-lib.js";

function fail(message: string): never {
  console.error(`[perf] ${message}`);
  process.exit(2);
}

const baseUrl = process.env.PERF_BASE_URL;
const password = process.env.PERF_DEMO_PASSWORD;
const cold = (process.env.PERF_COLD ?? "unknown") as ColdState;
if (!baseUrl || !/^https?:\/\//.test(baseUrl)) fail("Set PERF_BASE_URL to the deployed URL (http or https).");
if (!password) fail("Set PERF_DEMO_PASSWORD.");
if (!["idle", "warm", "unknown"].includes(cold)) fail("PERF_COLD must be idle, warm or unknown.");

const outcome = await runPerf({
  baseUrl, password, cold, email: process.env.PERF_EMAIL || PERF_SUPERVISOR_EMAIL,
  log: (line) => console.log(`[perf] ${line}`),
});
const stamp = new Date().toISOString().slice(0, 16).replace(/[-:]/g, "").replace("T", "-");
writeFileSync(`perf-nfr09-${stamp}.md`, outcome.markdown);
writeFileSync(`perf-nfr09-${stamp}.json`, `${JSON.stringify(outcome.json, null, 2)}\n`);
console.log(outcome.markdown);
console.log(`[perf] Wrote perf-nfr09-${stamp}.md and .json (exit ${outcome.exitCode}).`);
process.exitCode = outcome.exitCode;
