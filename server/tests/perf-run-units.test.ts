import { describe, expect, it } from "vitest";
import { runPerf, type PerfReport } from "../scripts/perf-nfr09-lib.js";

// NFR-09 contract v0.4 §3, AC-P.5 (TEST-P.5u): the run against a scripted server and clock,
// so the durations are exact and nothing touches the network.
const BASE = "http://perf.test";
const E1 = "/api/teams/1/milestones";
const E2 = "/api/milestones/101/submissions";
const E3 = "/api/overview";
const two = (n: number) => String(n).padStart(2, "0");
const versions = (m: number) => (m === 1 ? 5 : m <= 6 ? 1 : 0);

const teams = Array.from({ length: 20 }, (_, i) => ({ id: i + 1, name: `Perf Team ${two(i + 1)}` }));
const rows = teams.flatMap((team) => Array.from({ length: 10 }, (_, j) => ({
  teamId: team.id, teamName: team.name, milestoneId: team.id * 100 + j + 1, title: `Perf milestone ${two(j + 1)}`,
  latestVersion: versions(j + 1) || null,
  feedbackState: j < 3 ? "RECEIVED" : versions(j + 1) ? "AWAITING" : "NONE",
})));

/** Untimed preflight requests to each timed path (E2's history is read twice by the checks). */
const PREFLIGHT: Record<string, number> = { [E1]: 0, [E2]: 2, [E3]: 0 };

interface Script { slow: Record<string, number>; failAt?: { path: string; timed: number } }

function scripted({ slow, failAt }: Script) {
  const calls: Array<{ method: string; path: string; phase: "checks" | "timing" }> = [];
  const seen: Record<string, number> = {};
  const lines: string[] = [];
  let phase: "checks" | "timing" = "checks";
  let last = 0;
  let ticks = 0;

  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
  const fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    const path = url.pathname + url.search;
    const method = init?.method ?? "GET";
    calls.push({ method, path, phase });
    seen[path] = (seen[path] ?? 0) + 1;
    last = 1;
    if (path in PREFLIGHT && seen[path] > PREFLIGHT[path]) {
      // Timed-path requests: 5 warm-ups (slow, to show they are discarded), then 50 timed.
      const index = seen[path] - PREFLIGHT[path] - 1;
      const timed = index - 5;
      last = index < 5 ? 9999 : timed < 47 ? 10 : slow[path] ?? 20;
      if (failAt && failAt.path === path && failAt.timed === timed) return json({ error: { code: "INTERNAL" } }, 500);
    }
    if (path === "/api/ready") return json({ status: "ready" });
    if (path === "/api/health") return json({ status: "ok", commit: "scripted-commit" });
    if (path === "/api/auth/login") return json({ token: "t".repeat(43), user: { role: "SUPERVISOR" } });
    if (path === "/api/auth/logout") return new Response(null, { status: 204 });
    if (path === "/api/teams") return json({ teams });
    if (path === E1) return json({ milestones: [], page: 1, pageSize: 50, total: 10 });
    if (path.startsWith("/api/overview")) {
      const page = Number(url.searchParams.get("page") ?? 1);
      return json({ rows: rows.slice((page - 1) * 50, page * 50), page, pageSize: 50, total: 200 });
    }
    const history = /^\/api\/milestones\/(\d+)\/submissions$/.exec(path);
    if (history) {
      const row = rows.find((r) => r.milestoneId === Number(history[1]))!;
      return json({ submissions: Array.from({ length: row.latestVersion ?? 0 }, () => ({})) });
    }
    return json({ error: { code: "NOT_FOUND" } }, 404);
  };
  // Called twice per request (before and after): 0, then that request's scripted duration.
  const clock = () => (ticks++ % 2 === 0 ? 0 : last);
  const log = (line: string) => {
    lines.push(line);
    if (/Workload checks passed/.test(line)) phase = "timing";
  };
  const run = () => runPerf({
    baseUrl: BASE, email: "perf.supervisor@example.test", password: "scripted-password", cold: "idle",
    now: () => new Date("2026-12-10T03:00:00Z"), log, fetch: fetch as typeof globalThis.fetch, clock,
  });
  return { run, calls, lines };
}

describe("NFR-09 timing run (scripted)", () => {
  it("TEST-P.5u sends exactly 5 warm-up and 50 timed requests per endpoint, after the checks", async () => {
    const { run, calls } = scripted({ slow: {} });
    const outcome = await run();
    expect(outcome.exitCode).toBe(0);
    const timing = calls.filter((c) => c.phase === "timing");
    expect(timing.map((c) => c.path)).toEqual([
      ...Array(55).fill(E1), ...Array(55).fill(E2), ...Array(55).fill(E3), "/api/auth/logout",
    ]);
    const checks = calls.filter((c) => c.phase === "checks").map((c) => c.path);
    expect(checks.filter((p) => p === E1 || p === E3)).toEqual([]);
    expect(checks.filter((p) => p === E2)).toHaveLength(2);
    // The slow warm-ups (9999 ms) are discarded.
    for (const e of (outcome.json as PerfReport).endpoints) expect(e).toMatchObject({ n: 50, min: 10, max: 20 });
  });

  it("TEST-P.5u a raw p95 of 499.96 ms is PASS and shows as 499.9; exactly 500 ms is FAIL and shows as 500.0", async () => {
    const { run, lines } = scripted({ slow: { [E1]: 499.96, [E2]: 500 } });
    const outcome = await run();
    const report = outcome.json as PerfReport;
    expect(report.endpoints.map(({ id, p95, max, verdict }) => ({ id, p95, max, verdict }))).toEqual([
      { id: "E1", p95: 499.96, max: 499.96, verdict: "PASS" },
      { id: "E2", p95: 500, max: 500, verdict: "FAIL" },
      { id: "E3", p95: 20, max: 20, verdict: "PASS" },
    ]);
    expect(report).toMatchObject({ overall: "FAIL", cold: { ms: 1, state: "idle" }, commit: "scripted-commit" });
    expect(outcome.exitCode).toBe(1);
    expect(outcome.markdown).toContain(`| E1 | \`${E1}\` | 50 | 10.0 | 10.0 | 499.9 | 499.9 | PASS |`);
    expect(outcome.markdown).toContain(`| E2 | \`${E2}\` | 50 | 10.0 | 10.0 | 500.0 | 500.0 | FAIL |`);
    expect(outcome.markdown).toContain("**Overall: FAIL**");
    expect(outcome.markdown).not.toMatch(/500(\.0)? \| [^|]*\| PASS/);
    expect(lines).toContain("E1: p95 499.9 ms (PASS).");
    expect(lines).toContain("E2: p95 500.0 ms (FAIL).");
  });

  it("TEST-P.5u a non-200 on a timed request stops with exit 2 and no PASS", async () => {
    const { run, calls } = scripted({ slow: {}, failAt: { path: E3, timed: 10 } });
    const outcome = await run();
    expect(outcome.exitCode).toBe(2);
    expect(outcome.json).toEqual({ error: expect.stringMatching(/E3.*500/) });
    expect(outcome.markdown).toMatch(/no result/i);
    expect(outcome.markdown).not.toMatch(/PASS|FAIL|\| E1 \|/);
    expect(calls.at(-1)).toMatchObject({ method: "POST", path: "/api/auth/logout" });
  });
});
