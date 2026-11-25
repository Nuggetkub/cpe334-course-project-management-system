import { useEffect, useState, type FormEvent } from "react";
import { ApiError, apiFetch } from "../api";
import { formatBangkok } from "../time";

// F-10 contract v0.2 §2 UI (AC-10.5). The server decides what each role may see: a Student's response
// only ever holds the released score, so this component never has a draft to hide.
type StudentGrade = { released: false } | { released: true; score: number };
type SupervisorGrade =
  | { draftScore: number | null; released: false }
  | { draftScore: number; released: true; score: number; releasedAt: string };
type Load<T> = { kind: "loading" } | { kind: "error" } | { kind: "ready"; grade: T };

const SCORE_MESSAGE = "Enter a whole number from 0 to 100.";
const outOf = (score: number) => `${score} / 100`;

function useGrade<T>(milestoneId: number) {
  const [load, setLoad] = useState<Load<T>>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLoad({ kind: "loading" });
    apiFetch<{ grade?: T }>(`/api/milestones/${milestoneId}/grade`).then(
      // An unexpected body is treated like a failed read, never rendered.
      (body) => { if (active) setLoad(body?.grade && typeof body.grade === "object" ? { kind: "ready", grade: body.grade } : { kind: "error" }); },
      () => { if (active) setLoad({ kind: "error" }); },
    );
    return () => { active = false; };
  }, [milestoneId, attempt]);
  return { load, setLoad, retry: () => setAttempt((n) => n + 1) };
}

function LoadState({ load, retry }: { load: Load<unknown>; retry: () => void }) {
  if (load.kind === "loading") return <p role="status">Loading grade…</p>;
  if (load.kind === "error") return <><p role="alert">Could not load the grade.</p><button type="button" onClick={retry}>Retry</button></>;
  return null;
}

function StudentView({ milestoneId }: { milestoneId: number }) {
  const { load, retry } = useGrade<StudentGrade>(milestoneId);
  return <>
    <LoadState load={load} retry={retry} />
    {load.kind === "ready" && (load.grade.released ? <p className="grade-score">{outOf(load.grade.score)}</p> : <p>Not released</p>)}
  </>;
}

/** Whole numbers 0–100 only; the server checks again (400 `fields.score`). */
function parseScore(value: string): number | null {
  if (!/^\d{1,3}$/.test(value.trim())) return null;
  const score = Number(value.trim());
  return score <= 100 ? score : null;
}

function SupervisorView({ milestoneId }: { milestoneId: number }) {
  const { load, setLoad, retry } = useGrade<SupervisorGrade>(milestoneId);
  const [input, setInput] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<"save" | "release" | null>(null);

  const saved = load.kind === "ready" ? load.grade.draftScore : null;
  useEffect(() => { if (load.kind === "ready") setInput(saved === null ? "" : String(saved)); }, [load.kind, saved]);

  if (load.kind !== "ready") return <LoadState load={load} retry={retry} />;
  const grade = load.grade;
  const dirty = input.trim() !== (saved === null ? "" : String(saved));

  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError(null); setMessage(null);
    const score = parseScore(input);
    if (score === null) { setFieldError(SCORE_MESSAGE); return; }
    setFieldError(null);
    setBusy("save");
    try {
      const { grade: next } = await apiFetch<{ grade: SupervisorGrade }>(`/api/milestones/${milestoneId}/grade`, { method: "PUT", body: { score } });
      setLoad({ kind: "ready", grade: next });
      setMessage("Draft saved.");
    } catch (e) {
      if (e instanceof ApiError && e.status === 400 && e.fields.score) setFieldError(e.fields.score);
      else setError("Could not save the grade. Please try again.");
    } finally { setBusy(null); }
  }

  async function release() {
    if (busy || dirty || saved === null) return;
    if (!window.confirm(`Release ${outOf(saved)} to the team? Students will see this score.`)) return;
    setError(null); setMessage(null);
    setBusy("release");
    try {
      const { grade: next } = await apiFetch<{ grade: SupervisorGrade }>(`/api/milestones/${milestoneId}/grade/release`, { method: "POST" });
      setLoad({ kind: "ready", grade: next });
      setMessage("Grade released.");
    } catch (e) {
      setError(e instanceof ApiError && e.code === "GRADE_NOT_RECORDED" ? "Save a draft before releasing it." : "Could not release the grade. Please try again.");
    } finally { setBusy(null); }
  }

  const pendingDraft = grade.draftScore !== null && (!grade.released || grade.draftScore !== grade.score);
  return <>
    {error && <p role="alert" className="banner">{error}</p>}
    {message && <p role="status">{message}</p>}
    {grade.released
      ? <><p className="grade-score">{`Published: ${outOf(grade.score)}`}</p><p className="muted">{`Released ${formatBangkok(grade.releasedAt)}`}</p></>
      : <p>Not released yet</p>}
    {pendingDraft && <p>{`Saved draft: ${outOf(grade.draftScore!)}${grade.released ? " (not released yet)" : ""}`}</p>}
    <form className="milestone-form" onSubmit={save} noValidate>
      <fieldset disabled={busy !== null}>
        <label htmlFor={`grade-score-${milestoneId}`}>Score (0–100)</label>
        <input id={`grade-score-${milestoneId}`} type="number" min={0} max={100} step={1} inputMode="numeric" value={input}
          onChange={(e) => { setInput(e.target.value); setMessage(null); }}
          aria-invalid={!!fieldError} aria-describedby={fieldError ? `grade-score-${milestoneId}-error` : undefined} />
        {fieldError && <p className="field-error" id={`grade-score-${milestoneId}-error`}>{fieldError}</p>}
        <button type="submit">{busy === "save" ? "Saving draft…" : "Save draft"}</button>
        <button type="button" onClick={release} disabled={busy !== null || dirty || saved === null}>
          {busy === "release" ? "Releasing…" : "Release grade"}
        </button>
        {dirty && saved !== null && <p className="muted">Save the draft before releasing it.</p>}
      </fieldset>
    </form>
  </>;
}

/** The Grade section on the milestone page, for team Students and assigned Supervisors. */
export function GradeSection({ milestoneId, supervisor }: { milestoneId: number; supervisor: boolean }) {
  return <section aria-labelledby={`grade-heading-${milestoneId}`} className="grade">
    <h3 id={`grade-heading-${milestoneId}`}>Grade</h3>
    {supervisor ? <SupervisorView milestoneId={milestoneId} /> : <StudentView milestoneId={milestoneId} />}
  </section>;
}
