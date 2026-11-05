import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError, apiFetch } from "../api";
import { MilestoneFields, type Milestone } from "./MilestonesPage";

// F-04 read-only bridge. F-05 extends this route with submission data and controls.
export function MilestonePage() {
  const { milestoneId } = useParams();
  const [state, setState] = useState<{ kind: "loading" | "error" | "missing" } | { kind: "ready"; milestone: Milestone }>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setState({ kind: "loading" });
    apiFetch<{ milestone: Milestone }>(`/api/milestones/${encodeURIComponent(milestoneId ?? "")}`).then(
      ({ milestone }) => { if (active) setState({ kind: "ready", milestone }); },
      (e) => { if (active) setState({ kind: e instanceof ApiError && e.status === 404 ? "missing" : "error" }); },
    );
    return () => { active = false; };
  }, [milestoneId, attempt]);
  return <section className="milestones">
    <Link to="/milestones">Back to milestones</Link>
    {state.kind === "loading" && <p role="status">Loading milestone…</p>}
    {state.kind === "missing" && <p role="alert">Milestone not found.</p>}
    {state.kind === "error" && <><p role="alert">Could not load this milestone.</p><button type="button" onClick={() => setAttempt((n) => n + 1)}>Retry</button></>}
    {state.kind === "ready" && "milestone" in state && <><h2>{state.milestone.title}</h2><MilestoneFields milestone={state.milestone} /></>}
  </section>;
}
