import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError, apiFetch } from "../api";
import { useAuth } from "../auth/AuthContext";
import { formatBangkok } from "../time";
import type { Milestone } from "./MilestonesPage";

// F-11 contract v0.3 §2 UI. Phase 1 shows no grade at all (no column, no "Not released" text).
type Row = {
  milestoneId: number; title: string; dueAt: string; window: Milestone["window"]; teamStatus: Milestone["teamStatus"];
  latest: { version: number; late: boolean; submittedAt: string } | null;
  feedbackStatus: "NONE" | "AWAITING" | "RECEIVED";
};
type Board = { team: { id: number; name: string }; rows: Row[]; page: number; pageSize: number; total: number };
type Load<T> = { kind: "loading" } | { kind: "ready"; data: T } | { kind: "error" };

const WINDOW = { OPEN: "Open", LATE: "Late window", CLOSED: "Closed" } as const;
const TEAM_STATUS = { NOT_SUBMITTED: "Not submitted", OVERDUE: "Overdue", SUBMITTED: "Submitted", LATE: "Late" } as const;
const FEEDBACK = { NONE: "—", AWAITING: "Awaiting feedback", RECEIVED: "Feedback received" } as const;
const COLUMNS = ["Milestone", "Due (ICT)", "Window", "Team status", "Latest version", "Feedback"] as const;

function ProgressTable({ teamId }: { teamId: number }) {
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [load, setLoad] = useState<Load<Board>>({ kind: "loading" });
  useEffect(() => {
    let active = true;
    setLoad({ kind: "loading" });
    apiFetch<Board>(`/api/teams/${teamId}/progress?page=${page}`).then(
      (data) => { if (active) setLoad({ kind: "ready", data }); },
      () => { if (active) setLoad({ kind: "error" }); },
    );
    return () => { active = false; };
  }, [teamId, page, attempt]);

  if (load.kind === "loading") return <p role="status">Loading progress…</p>;
  if (load.kind === "error") return <><p role="alert">Could not load progress.</p><button type="button" onClick={() => setAttempt((n) => n + 1)}>Retry</button></>;
  const { team, rows, total, pageSize } = load.data;
  return <>
    <h3>{team.name}</h3>
    {!rows.length ? <p>No milestones yet</p> : <table className="progress-table" aria-label={`Progress for ${team.name}`}>
      <thead><tr>{COLUMNS.map((c) => <th key={c} scope="col">{c}</th>)}</tr></thead>
      <tbody>{rows.map((r) => <tr key={r.milestoneId}>
        <td data-label={COLUMNS[0]}><Link to={`/milestones/${r.milestoneId}`}>{r.title}</Link></td>
        <td data-label={COLUMNS[1]}><time dateTime={r.dueAt}>{formatBangkok(r.dueAt)}</time></td>
        <td data-label={COLUMNS[2]}>{WINDOW[r.window]}</td>
        <td data-label={COLUMNS[3]}>{TEAM_STATUS[r.teamStatus]}</td>
        <td data-label={COLUMNS[4]}>{r.latest
          ? <><span>{`Version ${r.latest.version}`}</span>{r.latest.late && <> <span className="badge-late">Late</span></>}</>
          : "Not submitted"}</td>
        <td data-label={COLUMNS[5]}>{FEEDBACK[r.feedbackStatus]}</td>
      </tr>)}</tbody>
    </table>}
    <nav aria-label="Progress pages"><button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
      <span>Page {page} · {total} milestones</span>
      <button type="button" disabled={page * pageSize >= total} onClick={() => setPage(page + 1)}>Next</button></nav>
  </>;
}

/** Finds the Student's team through the existing GET /api/teams/mine (404 = no team, FR-05). */
function MyProgress() {
  const [load, setLoad] = useState<Load<number | null>>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLoad({ kind: "loading" });
    apiFetch<{ team: { id: number } }>("/api/teams/mine").then(
      ({ team }) => { if (active) setLoad({ kind: "ready", data: team.id }); },
      (e) => { if (active) setLoad(e instanceof ApiError && e.status === 404 ? { kind: "ready", data: null } : { kind: "error" }); },
    );
    return () => { active = false; };
  }, [attempt]);
  if (load.kind === "loading") return <p role="status">Loading progress…</p>;
  if (load.kind === "error") return <><p role="alert">Could not load progress.</p><button type="button" onClick={() => setAttempt((n) => n + 1)}>Retry</button></>;
  if (load.data === null) return <p>You are not assigned to a team yet</p>;
  return <ProgressTable teamId={load.data} />;
}

export function ProgressPage() {
  const { state } = useAuth();
  if (state.status !== "authenticated") return null;
  return <section className="progress"><h2>Progress</h2><MyProgress key={state.user.id} /></section>;
}
