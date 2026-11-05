import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError, apiFetch } from "../api";
import { useAuth, type Role } from "../auth/AuthContext";

type Summary = { id: number; name: string };
type Team = Summary & { members: Summary[]; supervisors: Summary[] };
type Result = { kind: "student"; team: Team | null } | { kind: "supervisor"; teams: Summary[] };
type LoadState = Result | { kind: "loading" } | { kind: "error" };

async function loadTeams(role: Role): Promise<Result> {
  if (role === "SUPERVISOR") {
    const { teams } = await apiFetch<{ teams: Summary[] }>("/api/teams");
    return { kind: "supervisor", teams };
  }
  try {
    const { team } = await apiFetch<{ team: Team }>("/api/teams/mine");
    return { kind: "student", team };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404 && error.code === "NOT_FOUND") {
      return { kind: "student", team: null };
    }
    throw error;
  }
}

function Names({ entries, empty }: { entries: Summary[]; empty: string }) {
  return entries.length
    ? <ul>{entries.map(({ id, name }) => <li key={id}>{name}</li>)}</ul>
    : <p>{empty}</p>;
}

function TeamContent({ role }: { role: Role }) {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    loadTeams(role).then(
      (result) => { if (active) setState(result); },
      () => { if (active) setState({ kind: "error" }); },
    );
    return () => { active = false; };
  }, [role, attempt]);

  if (state.kind === "loading") return <p role="status">Loading team information…</p>;
  if (state.kind === "error") {
    return (
      <>
        <p role="alert">Could not load team information. Please try again.</p>
        <button type="button" onClick={() => {
          setState({ kind: "loading" });
          setAttempt((previous) => previous + 1);
        }}>Retry</button>
      </>
    );
  }
  if (state.kind === "supervisor") return state.teams.length
    ? <ul>{state.teams.map((team) => <li key={team.id}><Link to={`/teams/${team.id}/milestones`}>{team.name}</Link></li>)}</ul>
    : <p>No teams assigned yet</p>;
  if (!state.team) return <p>You are not assigned to a team yet</p>;

  return (
    <>
      <h3>{state.team.name}</h3>
      <Link to={`/teams/${state.team.id}/milestones`}>View team milestones</Link>
      <h4>Members</h4>
      <Names entries={state.team.members} empty="No members listed" />
      <h4>Assigned supervisors</h4>
      <Names entries={state.team.supervisors} empty="No supervisors assigned yet" />
    </>
  );
}

export function TeamPage({ role }: { role: Role }) {
  const { state } = useAuth();
  return (
    <section>
      <h2>{role === "STUDENT" ? "My team" : "My teams"}</h2>
      {state.status === "authenticated" && state.user.role === role
        ? <TeamContent key={state.user.id + ":" + role} role={role} />
        : <p role="alert">You do not have permission to view this page.</p>}
    </section>
  );
}
