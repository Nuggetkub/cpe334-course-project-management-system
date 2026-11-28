// NFR-09 contract v0.2 §1 and §3: the statistics and the timing run. RED stub: the tests define the behaviour.

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
}

export interface PerfOutcome {
  exitCode: 0 | 1 | 2;
  markdown: string;
  json: PerfReport | { error: string };
}

/** Nearest-rank p95: the ⌈0.95·n⌉-th smallest value. */
export function p95NearestRank(_durations: readonly number[]): number {
  throw new Error("Not implemented (NFR-09 RED).");
}

export function summarize(_durations: readonly number[]): Summary {
  throw new Error("Not implemented (NFR-09 RED).");
}

export function verdict(_p95: number): Verdict {
  throw new Error("Not implemented (NFR-09 RED).");
}

export async function runPerf(_options: PerfOptions): Promise<PerfOutcome> {
  throw new Error("Not implemented (NFR-09 RED).");
}
