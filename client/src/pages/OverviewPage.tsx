import { useEffect, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { ApiError, apiFetch } from "../api";
import { useAuth } from "../auth/AuthContext";
import { formatBangkok } from "../time";
import type { Milestone } from "./MilestonesPage";

// F-12 contract v0.3 §2 UI: one row per milestone across the Supervisor's teams, filters kept in the URL.
const STATES = ["LATE", "SUBMITTED", "MISSING", "NOT_DUE", "AWAITING"] as const;
type StateFilter = (typeof STATES)[number];
type Row = {
  teamId: number; teamName: string; milestoneId: number; title: string; dueAt: string; window: Milestone["window"];
  submissionState: "LATE" | "SUBMITTED" | "MISSING" | "NOT_DUE"; feedbackState: "NONE" | "AWAITING" | "RECEIVED";
  latestVersion: number | null;
};
type Overview = { rows: Row[]; page: number; pageSize: number; total: number };
type Load = { kind: "loading" } | { kind: "ready"; data: Overview } | { kind: "error" } | { kind: "team-not-found" };

const WINDOW = { OPEN: "Open", LATE: "Late window", CLOSED: "Closed" } as const;
const SUBMISSION = { LATE: "Late", SUBMITTED: "Submitted", MISSING: "Missing", NOT_DUE: "Not due" } as const;
const FEEDBACK = { NONE: "—", AWAITING: "Awaiting feedback", RECEIVED: "Feedback received" } as const;
const STATE_LABEL: Record<StateFilter, string> = { ...SUBMISSION, AWAITING: "Awaiting feedback" };
const COLUMNS = ["Team", "Milestone", "Due (ICT)", "Window", "Submission", "Feedback"] as const;

type Filters = { team: string | null; states: StateFilter[]; page: string | null };

function readFilters(params: URLSearchParams): Filters {
  const given = params.getAll("state");
  return { team: params.get("team"), states: STATES.filter((s) => given.includes(s)), page: params.get("page") };
}

/** Always team, then states in the fixed order, then page (left out on page 1 in the URL, always sent to the API). */
function toQuery({ team, states, page }: Filters, withPage: boolean): string {
  const query = new URLSearchParams();
  if (team) query.set("team", team);
  for (const s of states) query.append("state", s);
  if (withPage) query.set("page", page ?? "1");
  else if (page && page !== "1") query.set("page", page);
  return query.toString();
}

function OverviewContent() {
  const [params, setParams] = useSearchParams();
  const filters = readFilters(params);
  const apiQuery = toQuery(filters, true);
  const [teams, setTeams] = useState<{ id: number; name: string }[]>([]);
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    apiFetch<{ teams: { id: number; name: string }[] }>("/api/teams").then(
      ({ teams: list }) => { if (active) setTeams(list); },
      () => { /* the select keeps "All my teams"; the overview itself still loads */ },
    );
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true; // a response for an older query never replaces the current one (AC-12.5)
    setLoad({ kind: "loading" });
    apiFetch<Overview>(`/api/overview?${apiQuery}`).then(
      (data) => { if (active) setLoad({ kind: "ready", data }); },
      (e) => {
        if (!active) return;
        setLoad(e instanceof ApiError && e.status === 404 && apiQuery.includes("team=") ? { kind: "team-not-found" } : { kind: "error" });
      },
    );
    return () => { active = false; };
  }, [apiQuery, attempt]);

  const update = (next: Partial<Filters>) => {
    const query = toQuery({ ...filters, page: null, ...next }, false);
    setParams(new URLSearchParams(query));
  };
  const toggle = (state: StateFilter) => update({
    states: filters.states.includes(state) ? filters.states.filter((s) => s !== state) : STATES.filter((s) => s === state || filters.states.includes(s)),
  });
  const page = Number(filters.page ?? "1");
  const filtered = filters.team !== null || filters.states.length > 0;

  return <>
    <form className="overview-filters" onSubmit={(e) => e.preventDefault()}>
      <label>Team{" "}
        <select value={filters.team ?? ""} onChange={(e) => update({ team: e.target.value || null })}>
          <option value="">All my teams</option>
          {teams.map((t) => <option key={t.id} value={String(t.id)}>{t.name}</option>)}
        </select>
      </label>
      <fieldset>
        <legend>State</legend>
        {STATES.map((s) => <label key={s}>
          <input type="checkbox" checked={filters.states.includes(s)} onChange={() => toggle(s)} />{STATE_LABEL[s]}
        </label>)}
      </fieldset>
    </form>
    {load.kind === "loading" && <p role="status">Loading overview…</p>}
    {load.kind === "error" && <><p role="alert">Could not load the overview.</p>
      <button type="button" onClick={() => setAttempt((n) => n + 1)}>Retry</button></>}
    {load.kind === "team-not-found" && <><p role="alert">Team not found.</p>
      <button type="button" onClick={() => update({ team: null })}>Show all my teams</button></>}
    {load.kind === "ready" && <>
      {!load.data.rows.length
        ? <p>{filtered ? "Nothing matches these filters" : "No milestones yet"}</p>
        : <table className="progress-table" aria-label="Supervisor overview">
          <thead><tr>{COLUMNS.map((c) => <th key={c} scope="col">{c}</th>)}</tr></thead>
          <tbody>{load.data.rows.map((r) => <tr key={r.milestoneId}>
            <td data-label={COLUMNS[0]}>{r.teamName}</td>
            <td data-label={COLUMNS[1]}><Link to={`/milestones/${r.milestoneId}`}>{r.title}</Link></td>
            <td data-label={COLUMNS[2]}><time dateTime={r.dueAt}>{formatBangkok(r.dueAt)}</time></td>
            <td data-label={COLUMNS[3]}>{WINDOW[r.window]}</td>
            <td data-label={COLUMNS[4]}>{SUBMISSION[r.submissionState]}</td>
            <td data-label={COLUMNS[5]}>{FEEDBACK[r.feedbackState]}</td>
          </tr>)}</tbody>
        </table>}
      <nav aria-label="Overview pages">
        <button type="button" disabled={page <= 1} onClick={() => update({ ...filters, page: String(page - 1) })}>Previous</button>
        <span>Page {load.data.page} · {load.data.total} milestones</span>
        <button type="button" disabled={page * load.data.pageSize >= load.data.total} onClick={() => update({ ...filters, page: String(page + 1) })}>Next</button>
      </nav>
    </>}
  </>;
}

export function OverviewPage() {
  const { state } = useAuth();
  if (state.status !== "authenticated") return null;
  if (state.user.role !== "SUPERVISOR") return <Navigate to="/" replace />;
  return <section className="overview"><h2>Overview</h2><OverviewContent key={state.user.id} /></section>;
}
