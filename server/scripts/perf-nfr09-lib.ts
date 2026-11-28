// NFR-09 contract v0.3 §1 and §3: the statistics and the timing run (TEST-12.4p).
// Reports hold timings and identifiers only: never the password, the token or a response body.

export const P95_LIMIT_MS = 500;

export type Verdict = "PASS" | "FAIL";
export type ColdState = "idle" | "warm" | "unknown";

export interface Summary { n: number; min: number; median: number; p95: number; max: number }

export interface EndpointResult extends Summary { id: "E1" | "E2" | "E3"; path: string; verdict: Verdict }

export interface PerfReport {
  date: string;
  baseUrl: string;
  commit: string;
  cold: { ms: number; state: ColdState };
  checks: { passed: true };
  endpoints: EndpointResult[];
  overall: Verdict;
}

export interface PerfOptions {
  baseUrl: string;
  email: string;
  password: string;
  cold: ColdState;
  warmup?: number;
  samples?: number;
  now?: () => Date;
  log?: (line: string) => void;
  /** For tests: a scripted transport and clock (TEST-P.5u). Defaults: global fetch, performance.now. */
  fetch?: typeof globalThis.fetch;
  clock?: () => number;
}

export interface PerfOutcome {
  exitCode: 0 | 1 | 2;
  markdown: string;
  json: PerfReport | { error: string };
}

const sorted = (durations: readonly number[]) => {
  if (durations.length === 0) throw new Error("No samples.");
  return [...durations].sort((a, b) => a - b);
};

/** Nearest-rank p95: the ⌈0.95·n⌉-th smallest value. */
export function p95NearestRank(durations: readonly number[]): number {
  const values = sorted(durations);
  return values[Math.ceil(0.95 * values.length) - 1];
}

export function summarize(durations: readonly number[]): Summary {
  const values = sorted(durations);
  const n = values.length;
  const median = n % 2 === 1 ? values[(n - 1) / 2] : (values[n / 2 - 1] + values[n / 2]) / 2;
  return { n, min: values[0], median, p95: p95NearestRank(values), max: values[n - 1] };
}

export function verdict(p95: number): Verdict {
  return p95 < P95_LIMIT_MS ? "PASS" : "FAIL";
}

/** A failure that stops the run with no result (exit code 2). Its message holds no secrets. */
class RunError extends Error {}

const TEAM_NAMES = Array.from({ length: 20 }, (_, i) => `Perf Team ${String(i + 1).padStart(2, "0")}`);
const EXPECTED_VERSIONS: Record<string, number> = {
  "Perf milestone 01": 5, "Perf milestone 02": 1, "Perf milestone 03": 1,
  "Perf milestone 04": 1, "Perf milestone 05": 1, "Perf milestone 06": 1,
};

interface OverviewRow { teamId: number; teamName: string; milestoneId: number; title: string; feedbackState: string; latestVersion: number | null }

function ictDate(date: Date): string {
  return `${new Date(date.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 16).replace("T", " ")} ICT`;
}

const round = (ms: number) => Math.round(ms * 10) / 10;

export async function runPerf(options: PerfOptions): Promise<PerfOutcome> {
  const { email, password, cold } = options;
  const baseUrl = options.baseUrl.replace(/\/+$/, "");
  const warmup = options.warmup ?? 5;
  const samples = options.samples ?? 50;
  const log = options.log ?? (() => {});
  const date = ictDate((options.now ?? (() => new Date()))());
  let token: string | null = null;

  async function call(path: string, init: { method?: string; body?: unknown } = {}) {
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (init.body !== undefined) headers["Content-Type"] = "application/json";
    const started = performance.now();
    const response = await fetch(`${baseUrl}${path}`, {
      method: init.method ?? "GET", headers, body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    const text = await response.text();
    const ms = performance.now() - started;
    return { status: response.status, ms, body: () => JSON.parse(text) as Record<string, unknown> };
  }
  async function getJson(path: string, what: string) {
    const response = await call(path);
    if (response.status !== 200) throw new RunError(`${what} answered ${response.status}.`);
    return response.body();
  }

  try {
    const ready = await call("/api/ready");
    if (ready.status !== 200) throw new RunError(`GET /api/ready answered ${ready.status}.`);
    const coldMs = round(ready.ms);
    log(`Cold start sample: ${coldMs} ms (service ${cold}).`);
    const commit = String((await getJson("/api/health", "GET /api/health")).commit ?? "unknown");

    const login = await call("/api/auth/login", { method: "POST", body: { email, password } });
    if (login.status !== 200) throw new RunError(`Sign-in answered ${login.status}.`);
    token = String(login.body().token);

    // Workload checks (untimed), before any timing.
    const teams = (await getJson("/api/teams", "GET /api/teams")).teams as Array<{ id: number; name: string }>;
    if (JSON.stringify(teams.map((t) => t.name)) !== JSON.stringify(TEAM_NAMES)) {
      throw new RunError("Workload check failed: the caller's teams are not exactly Perf Team 01 to 20.");
    }
    const teamIds = new Set(teams.map((t) => t.id));
    const rows: OverviewRow[] = [];
    for (let page = 1; page <= 4; page++) {
      const body = await getJson(`/api/overview?page=${page}`, "GET /api/overview");
      if (body.total !== 200) throw new RunError("Workload check failed: the overview total isn't 200 milestones.");
      rows.push(...(body.rows as OverviewRow[]));
    }
    const perTeam = new Map<number, OverviewRow[]>();
    for (const row of rows) perTeam.set(row.teamId, [...(perTeam.get(row.teamId) ?? []), row]);
    if (rows.length !== 200 || perTeam.size !== 20 || [...perTeam].some(([id, list]) => !teamIds.has(id) || list.length !== 10)) {
      throw new RunError("Workload check failed: the overview doesn't show 10 milestones for each Perf team.");
    }
    let submissions = 0;
    for (const [, list] of perTeam) {
      let teamSubmissions = 0;
      for (const row of list) {
        const expected = EXPECTED_VERSIONS[row.title] ?? 0;
        const count = row.latestVersion === null ? 0
          : ((await getJson(`/api/milestones/${row.milestoneId}/submissions`, "A submission history")).submissions as unknown[]).length;
        if (count !== expected) throw new RunError("Workload check failed: the submissions don't add up to 200 (10 per team).");
        teamSubmissions += count;
      }
      if (teamSubmissions !== 10) throw new RunError("Workload check failed: the submissions don't add up to 200 (10 per team).");
      submissions += teamSubmissions;
    }
    const received = [...perTeam].map(([, list]) => list.filter((r) => r.feedbackState === "RECEIVED").length);
    if (submissions !== 200 || received.some((n) => n !== 3)) {
      throw new RunError(submissions !== 200
        ? "Workload check failed: the submissions don't add up to 200 (10 per team)."
        : "Workload check failed: the overview doesn't show 60 milestones with feedback received (3 per team).");
    }
    const team01 = teams[0];
    const e2 = perTeam.get(team01.id)!.find((r) => r.title === "Perf milestone 01");
    if (!e2) throw new RunError("Workload check failed: Perf milestone 01 is missing.");
    const e2Path = `/api/milestones/${e2.milestoneId}/submissions`;
    if (((await getJson(e2Path, "E2")).submissions as unknown[]).length !== 5) {
      throw new RunError("Workload check failed: the E2 milestone doesn't have 5 versions.");
    }
    log("Workload checks passed: 20 Perf teams, 200 milestones, 200 submissions, 60 feedback entries, 5 versions on E2.");

    const endpoints: EndpointResult[] = [];
    for (const [id, path] of [["E1", `/api/teams/${team01.id}/milestones`], ["E2", e2Path], ["E3", "/api/overview"]] as const) {
      const times: number[] = [];
      for (let i = 0; i < warmup + samples; i++) {
        const response = await call(path);
        if (response.status !== 200) throw new RunError(`A request to ${id} answered ${response.status}.`);
        if (i >= warmup) times.push(response.ms);
      }
      const summary = summarize(times);
      const rounded = { n: summary.n, min: round(summary.min), median: round(summary.median), p95: round(summary.p95), max: round(summary.max) };
      endpoints.push({ id, path, ...rounded, verdict: verdict(summary.p95) });
      log(`${id}: p95 ${rounded.p95} ms (${verdict(summary.p95)}).`);
    }
    const overall: Verdict = endpoints.every((e) => e.verdict === "PASS") ? "PASS" : "FAIL";
    const report: PerfReport = { date, baseUrl, commit, cold: { ms: coldMs, state: cold }, checks: { passed: true }, endpoints, overall };
    return { exitCode: overall === "PASS" ? 0 : 1, markdown: toMarkdown(report, warmup, samples), json: report };
  } catch (error) {
    const message = error instanceof RunError ? error.message : `The run failed: the server could not be reached or answered unexpectedly (${error instanceof Error ? error.name : "UnexpectedError"}).`;
    log(message);
    return {
      exitCode: 2,
      markdown: `# NFR-09 timing report (TEST-12.4p)\n\n- Date: ${date}\n- Base URL: ${baseUrl}\n\n**No result:** ${message}\n`,
      json: { error: message },
    };
  } finally {
    if (token) await call("/api/auth/logout", { method: "POST" }).catch(() => undefined);
  }
}

function toMarkdown(report: PerfReport, warmup: number, samples: number): string {
  const rank = Math.ceil(0.95 * samples);
  return [
    "# NFR-09 timing report (TEST-12.4p)",
    "",
    `- Date: ${report.date}`,
    `- Base URL: ${report.baseUrl}`,
    `- Commit: \`${report.commit}\``,
    "- Cloud Run revision: (add from the Console)",
    `- Method: ${warmup} warm-up requests discarded, then ${samples} sequential timed requests per endpoint (concurrency 1), as the Perf Supervisor of all 20 teams; p95 by the nearest-rank rule (the ${rank}th of ${samples} sorted); limit p95 < ${P95_LIMIT_MS} ms.`,
    "- Workload checks: passed (20 Perf teams, 200 milestones, 200 submissions, 60 feedback entries, 5 versions on E2).",
    `- Cold start: ${report.cold.ms} ms (the first request, GET /api/ready; service ${report.cold.state} beforehand). Not counted in p95.`,
    "",
    "| Endpoint | Path | n | min (ms) | median (ms) | p95 (ms) | max (ms) | Result |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ...report.endpoints.map((e) => `| ${e.id} | \`${e.path}\` | ${e.n} | ${e.min} | ${e.median} | ${e.p95} | ${e.max} | ${e.verdict} |`),
    "",
    `**Overall: ${report.overall}**`,
    "",
  ].join("\n");
}
