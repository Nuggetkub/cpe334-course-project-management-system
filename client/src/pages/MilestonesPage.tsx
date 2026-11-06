import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError, apiFetch } from "../api";
import { useAuth } from "../auth/AuthContext";
import { bangkokInputToIso, formatBangkok } from "../time";

export interface Milestone {
  id: number; teamId: number; title: string; description: string; dueAt: string;
  window: "OPEN" | "CLOSED"; teamStatus: "NOT_SUBMITTED" | "OVERDUE" | "SUBMITTED";
}
type Team = { id: number; name: string };
type Page = { milestones: Milestone[]; page: number; pageSize: number; total: number };
type Load<T> = { kind: "loading" } | { kind: "ready"; data: T } | { kind: "missing" } | { kind: "error" };
function failure(error: unknown): "missing" | "error" {
  return error instanceof ApiError && error.status === 404 && error.code === "NOT_FOUND" ? "missing" : "error";
}

export function MilestoneFields({ milestone }: { milestone: Milestone }) {
  return <>
    {milestone.description && <p className="milestone-description">{milestone.description}</p>}
    <p>Due <time dateTime={milestone.dueAt}>{formatBangkok(milestone.dueAt)}</time></p>
    <p className="badges"><span>Window: {milestone.window === "OPEN" ? "Open" : "Closed"}</span>
      <span>Team status: {milestone.teamStatus === "SUBMITTED" ? "Submitted" : milestone.teamStatus === "OVERDUE" ? "Overdue" : "Not submitted"}</span></p>
  </>;
}

function CreateMilestone({ teamId, onCreated }: { teamId: string; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [due, setDue] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const dueAt = bangkokInputToIso(due);
    const invalid: Record<string, string> = {};
    if (!title.trim() || [...title.trim()].length > 120) invalid.title = "Enter a title (1–120 characters).";
    if ([...description.trim()].length > 2000) invalid.description = "Description must be at most 2000 characters.";
    if (!dueAt) invalid.dueAt = "Enter a valid future due date and time.";
    setFields(invalid); setError(null);
    if (Object.keys(invalid).length) return;
    setBusy(true);
    try {
      await apiFetch(`/api/teams/${encodeURIComponent(teamId)}/milestones`, { method: "POST", body: { title: title.trim(), description: description.trim(), dueAt } });
      setTitle(""); setDescription(""); setDue("");
      onCreated();
    } catch (e) {
      if (e instanceof ApiError && e.status === 400 && Object.keys(e.fields).length) setFields(e.fields);
      else setError(e instanceof ApiError && e.status === 404 ? "Team not found." : "Could not create milestone. Please try again.");
    } finally { setBusy(false); }
  }
  return <form className="milestone-form" onSubmit={submit} noValidate>
    <h3>Create milestone</h3>
    {error && <p role="alert" className="banner">{error}</p>}
    <fieldset disabled={busy}>
      <legend className="muted">For this team · all times are Asia/Bangkok (ICT)</legend>
      <label htmlFor="milestone-title">Title</label>
      <input id="milestone-title" value={title} onChange={(e) => setTitle(e.target.value)} aria-invalid={!!fields.title} aria-describedby={fields.title ? "milestone-title-error" : undefined} />
      {fields.title && <p className="field-error" id="milestone-title-error" role="alert">{fields.title}</p>}
      <label htmlFor="milestone-description">Description (optional)</label>
      <textarea id="milestone-description" value={description} onChange={(e) => setDescription(e.target.value)} aria-invalid={!!fields.description} aria-describedby={fields.description ? "milestone-description-error" : undefined} />
      {fields.description && <p className="field-error" id="milestone-description-error" role="alert">{fields.description}</p>}
      <label htmlFor="milestone-due">Due date and time (Asia/Bangkok)</label>
      <input id="milestone-due" type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} aria-invalid={!!fields.dueAt} aria-describedby={fields.dueAt ? "milestone-due-error" : undefined} />
      {fields.dueAt && <p className="field-error" id="milestone-due-error" role="alert">{fields.dueAt}</p>}
      <button type="submit">{busy ? "Creating milestone…" : "Create milestone"}</button>
    </fieldset>
  </form>;
}

function TeamMilestones({ teamId, canCreate }: { teamId: string; canCreate: boolean }) {
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [load, setLoad] = useState<Load<Page>>({ kind: "loading" });
  const [created, setCreated] = useState(false);
  useEffect(() => {
    let active = true;
    setLoad({ kind: "loading" });
    apiFetch<Page>(`/api/teams/${encodeURIComponent(teamId)}/milestones?page=${page}`).then(
      (data) => { if (active) setLoad({ kind: "ready", data }); },
      (e) => { if (active) setLoad({ kind: failure(e) }); },
    );
    return () => { active = false; };
  }, [teamId, page, attempt]);
  function changePage(next: number) { setLoad({ kind: "loading" }); setPage(next); }
  return <>
    {created && <p role="status">Milestone created.</p>}
    {load.kind === "loading" && <p role="status">Loading milestones…</p>}
    {load.kind === "missing" && <p role="alert">Team not found.</p>}
    {load.kind === "error" && <><p role="alert">Could not load milestones. Please try again.</p><button type="button" onClick={() => setAttempt((n) => n + 1)}>Retry</button></>}
    {load.kind === "ready" && <>
      {!load.data.milestones.length ? <p>No milestones yet</p> : <ul className="milestone-list">{load.data.milestones.map((m) => <li key={m.id}>
        <h3><Link to={`/milestones/${m.id}`}>{m.title}</Link></h3><MilestoneFields milestone={m} />
      </li>)}</ul>}
      <nav aria-label="Milestone pages"><button type="button" disabled={page <= 1} onClick={() => changePage(page - 1)}>Previous</button>
        <span>Page {page} · {load.data.total} milestones</span>
        <button type="button" disabled={page * load.data.pageSize >= load.data.total} onClick={() => changePage(page + 1)}>Next</button></nav>
    </>}
    {canCreate && load.kind === "ready" && <CreateMilestone teamId={teamId} onCreated={() => { setCreated(true); setPage(1); setAttempt((n) => n + 1); }} />}
  </>;
}

function DiscoverMilestones({ supervisor }: { supervisor: boolean }) {
  const [load, setLoad] = useState<Load<Team[]>>({ kind: "loading" });
  const [selected, setSelected] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLoad({ kind: "loading" });
    async function discover() {
      if (supervisor) return (await apiFetch<{ teams: Team[] }>("/api/teams")).teams;
      try { return [(await apiFetch<{ team: Team }>("/api/teams/mine")).team]; }
      catch (e) { if (failure(e) === "missing") return []; throw e; }
    }
    discover().then((teams) => { if (active) { setLoad({ kind: "ready", data: teams }); setSelected(String(teams[0]?.id ?? "")); } },
      () => { if (active) setLoad({ kind: "error" }); });
    return () => { active = false; };
  }, [supervisor, attempt]);
  if (load.kind === "loading") return <p role="status">Loading teams…</p>;
  if (load.kind !== "ready") return <><p role="alert">Could not load teams. Please try again.</p><button type="button" onClick={() => setAttempt((n) => n + 1)}>Retry</button></>;
  if (!load.data.length) return <p>{supervisor ? "No teams assigned yet" : "You are not assigned to a team yet"}</p>;
  return <>
    {supervisor ? <><label htmlFor="milestone-team">Team</label><select id="milestone-team" value={selected} onChange={(e) => setSelected(e.target.value)}>
      {load.data.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></> : <h3>{load.data[0].name}</h3>}
    <TeamMilestones key={selected} teamId={selected} canCreate={supervisor} />
  </>;
}

export function MilestonesPage() {
  const { teamId } = useParams();
  const { state } = useAuth();
  if (state.status !== "authenticated") return null;
  const supervisor = state.user.role === "SUPERVISOR";
  return <section className="milestones"><h2>Milestones</h2>
    {teamId ? <TeamMilestones key={`${state.user.id}:${teamId}`} teamId={teamId} canCreate={supervisor} /> : <DiscoverMilestones key={state.user.id} supervisor={supervisor} />}
  </section>;
}
