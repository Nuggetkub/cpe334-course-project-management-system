import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ApiError, apiFetch } from "../api";
import { useAuth } from "../auth/AuthContext";

type Summary = { id: number; name: string };
type Roster = { team: Summary & { members: Summary[] } };
type Candidates = { students: Summary[]; page: number; hasMore: boolean };
type Load<T> = { kind: "loading" } | { kind: "error"; error: unknown } | { kind: "ready"; data: T };

function useTeamData<T>(path: string) {
  const [state, setState] = useState<{ path: string; result: Load<T> }>({ path, result: { kind: "loading" } });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    apiFetch<T>(path).then(
      (data) => { if (active) setState({ path, result: { kind: "ready", data } }); },
      (error: unknown) => { if (active) setState({ path, result: { kind: "error", error } }); },
    );
    return () => { active = false; };
  }, [path, attempt]);
  const result: Load<T> = state.path === path ? state.result : { kind: "loading" };
  return {
    result,
    reload() {
      setState({ path, result: { kind: "loading" } });
      setAttempt((old) => old + 1);
    },
  };
}

export function CreateTeamForm() {
  const navigate = useNavigate();
  const active = useRef(false);
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [fieldError, setFieldError] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  async function create(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setFieldError("");
    setError("");
    setPending(true);
    try {
      const { team } = await apiFetch<{ team: Summary }>("/api/teams", { method: "POST", body: { name } });
      if (active.current) navigate(`/teams/${team.id}/manage`);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) return;
      const nameError = cause instanceof ApiError ? cause.fields.name : undefined;
      if (nameError) setFieldError(nameError);
      else setError(cause instanceof ApiError && cause.code === "COURSE_UNAVAILABLE" ? cause.message : "Could not create the team. Please try again.");
    } finally { setPending(false); }
  }

  return (
    <form onSubmit={create} className="card team-controls">
      <h3>Create a team</h3>
      <label htmlFor="new-team-name">Team name</label>
      <input id="new-team-name" value={name} onChange={(event) => { setName(event.target.value); setFieldError(""); }}
        disabled={pending} aria-invalid={!!fieldError} aria-describedby={fieldError ? "team-name-error" : undefined} />
      {fieldError && <p id="team-name-error" role="alert">{fieldError}</p>}
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={pending}>{pending ? "Creating…" : "Create team"}</button>
    </form>
  );
}

function TeamManagement({ id }: { id: string }) {
  const base = `/api/teams/${encodeURIComponent(id)}`;
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState("");
  const [confirm, setConfirm] = useState<Summary>();
  const [error, setError] = useState<{ message: string; refresh?: boolean; field?: boolean }>();
  const [pending, setPending] = useState(false);
  const roster = useTeamData<Roster>(base);
  const candidates = useTeamData<Candidates>(`${base}/member-candidates?${new URLSearchParams({ q, page: String(page) })}`);
  const team = roster.result.kind === "ready" ? roster.result.data.team : undefined;
  const options = candidates.result.kind === "ready" ? candidates.result.data : undefined;
  const hidden = roster.result.kind === "error" && roster.result.error instanceof ApiError && roster.result.error.status === 404;
  const searchError = candidates.result.kind === "error" && candidates.result.error instanceof ApiError
    ? candidates.result.error.fields.q : undefined;

  async function changeMember(method: "POST" | "DELETE", studentId: number) {
    if (pending) return;
    setError(undefined);
    setPending(true);
    setConfirm(undefined);
    try {
      await apiFetch(method === "POST" ? `${base}/members` : `${base}/members/${studentId}`, {
        method, ...(method === "POST" ? { body: { studentId } } : {}),
      });
      setSelected("");
      roster.reload();
      if (page !== 1) setPage(1);
      else candidates.reload();
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) return;
      if (cause instanceof ApiError && cause.code === "STUDENT_UNAVAILABLE") setError({ message: cause.message, refresh: true });
      else if (cause instanceof ApiError && cause.code === "MEMBER_HAS_SUBMISSIONS") setError({ message: cause.message });
      else if (cause instanceof ApiError && cause.fields.studentId) setError({ message: cause.fields.studentId, field: true });
      else setError({ message: method === "POST" ? "Could not add the student. Please try again." : "Could not remove the student. Please try again." });
    } finally { setPending(false); }
  }

  return (
    <section className="team-page">
      <Link to="/teams">Back to My teams</Link>
      <h2>{team ? `Manage ${team.name}` : "Manage team"}</h2>
      {team && <Link to={`/teams/${team.id}/milestones`}>View team milestones</Link>}
      {roster.result.kind === "loading" && <p role="status">Loading roster…</p>}
      {hidden ? <p role="alert">Team not found.</p> : <>
        {roster.result.kind === "error" && <><p role="alert">Could not load the roster.</p><button type="button" onClick={roster.reload}>Retry roster</button></>}
        {error && !error.field && <p role="alert">{error.message}</p>}
        {team && <>
          <h3>Members</h3>
          {team.members.length ? <ul>{team.members.map((member) => (
            <li key={member.id}>{member.name}{" "}
              <button type="button" disabled={pending} onClick={() => setConfirm(member)}>Remove {member.name}</button>
            </li>
          ))}</ul> : <p>No members listed</p>}
          {confirm && <div className="team-controls" role="group" aria-label="Confirm member removal">
            <p>Remove {confirm.name} from this team?</p>
            <button type="button" onClick={() => void changeMember("DELETE", confirm.id)}>Confirm removal</button>{" "}
            <button type="button" onClick={() => setConfirm(undefined)}>Cancel</button>
          </div>}
        </>}
        <h3>Add a student</h3>
        <form className="team-controls" onSubmit={(event) => {
          event.preventDefault(); setSelected("");
          const term = search.trim();
          if (q === term && page === 1) candidates.reload();
          setQ(term); setPage(1);
        }}>
          <label htmlFor="student-search">Search available students</label>
          <input id="student-search" value={search} onChange={(event) => setSearch(event.target.value)} disabled={pending}
            aria-invalid={!!searchError} aria-describedby={searchError ? "student-search-error" : undefined} />
          {searchError && <p id="student-search-error" role="alert">{searchError}</p>}
          <button type="submit" disabled={pending}>Search</button>
        </form>
        {candidates.result.kind === "loading" && <p role="status">Loading candidates…</p>}
        {candidates.result.kind === "error" && !searchError && <>
          <p role="alert">Could not load candidates.</p>
          <button type="button" onClick={candidates.reload}>Retry candidates</button>
        </>}
        {error?.refresh && <button type="button" onClick={() => { setError(undefined); setSelected(""); candidates.reload(); }}>Refresh candidates</button>}
        {options && <>
          {options.students.length === 0 ? <p>No available students found</p> : <form className="team-controls" onSubmit={(event) => {
            event.preventDefault();
            if (team && options.students.some(({ id }) => String(id) === selected)) void changeMember("POST", Number(selected));
          }}>
            <label htmlFor="team-student">Available student</label>
            <select id="team-student" value={selected} disabled={pending || !team} aria-invalid={!!error?.field}
              aria-describedby={error?.field ? "team-student-error" : undefined} onChange={(event) => setSelected(event.target.value)}>
              <option value="">Choose a student</option>
              {options.students.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
            </select>
            {error?.field && <p id="team-student-error" role="alert">{error.message}</p>}
            <button type="submit" disabled={!selected || pending || !team}>Add student</button>
          </form>}
          {(options.page > 1 || options.hasMore) && <nav className="team-pages" aria-label="Candidate pages">
            <button type="button" disabled={pending || options.page === 1} onClick={() => { setSelected(""); setPage(page - 1); }}>Previous</button>
            <span>Page {options.page}</span>
            <button type="button" disabled={pending || !options.hasMore} onClick={() => { setSelected(""); setPage(page + 1); }}>Next</button>
          </nav>}
        </>}
      </>}
    </section>
  );
}

export function TeamManagementPage() {
  const { teamId } = useParams();
  const { state } = useAuth();
  if (state.status !== "authenticated" || state.user.role !== "SUPERVISOR") {
    return <p role="alert">You do not have permission to view this page.</p>;
  }
  return teamId && /^[1-9]\d*$/.test(teamId) && Number(teamId) <= 2_147_483_647
    ? <TeamManagement key={`${state.user.id}:${teamId}`} id={teamId} />
    : <p role="alert">Team not found.</p>;
}
