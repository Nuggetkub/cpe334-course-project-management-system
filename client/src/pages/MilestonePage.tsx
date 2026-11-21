import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError, apiFetch } from "../api";
import { useAuth } from "../auth/AuthContext";
import { formatBangkok } from "../time";
import { MilestoneFields, type Milestone } from "./MilestonesPage";

// F-04's read-only milestone page, extended by F-05 with the team's submission and the submit form.

export interface Submission {
  id: number; milestoneId: number; version: number; title: string; description: string; link: string;
  submittedAt: string; submittedBy: { id: number; name: string };
}
type Loaded = { milestone: Milestone; submission: Submission | null };
type State = { kind: "loading" | "error" | "missing" } | { kind: "ready"; data: Loaded };

// Same rules and messages as the server (F-05 contract §1.4).
const MESSAGES = {
  title: "Enter a title (1–120 characters).",
  description: "Description must be at most 2000 characters.",
  link: "Enter a full link starting with http:// or https://.",
};
const length = (value: string) => [...value].length;

function isWebLink(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && url.hostname !== "";
  } catch {
    return false;
  }
}

function validate(title: string, description: string, link: string) {
  const fields: Record<string, string> = {};
  if (length(title) < 1 || length(title) > 120) fields.title = MESSAGES.title;
  if (length(description) > 2000) fields.description = MESSAGES.description;
  if (length(link) > 2048 || !isWebLink(link)) fields.link = MESSAGES.link;
  return fields;
}

function SubmissionView({ submission }: { submission: Submission }) {
  return <article className="submission">
    <h4>{submission.title}</h4>
    {submission.description && <p className="milestone-description">{submission.description}</p>}
    <p>{isWebLink(submission.link)
      ? <a href={submission.link} target="_blank" rel="noopener noreferrer">{submission.link}</a>
      : submission.link}</p>
    <p className="muted">{`Submitted by ${submission.submittedBy.name} on ${formatBangkok(submission.submittedAt)}`}</p>
  </article>;
}

function SubmitForm({ milestoneId, onSubmitted }: { milestoneId: number; onSubmitted: (submission: Submission) => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [link, setLink] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const body = { title: title.trim(), description: description.trim(), link: link.trim() };
    const invalid = validate(body.title, body.description, body.link);
    setFields(invalid);
    setError(null);
    if (Object.keys(invalid).length) return;
    setBusy(true);
    try {
      const { submission } = await apiFetch<{ submission: Submission }>(`/api/milestones/${milestoneId}/submissions`, { method: "POST", body });
      onSubmitted(submission);
    } catch (e) {
      if (e instanceof ApiError && e.status === 400 && Object.keys(e.fields).length) setFields(e.fields);
      else setError(e instanceof ApiError && e.status === 409 ? e.message : "Could not submit. Please try again.");
      setBusy(false);
    }
  }

  const describedBy = (field: string) => (fields[field] ? `submission-${field}-error` : undefined);
  const fieldError = (field: string) => fields[field] && <p className="field-error" id={`submission-${field}-error`}>{fields[field]}</p>;
  return <form className="milestone-form" onSubmit={submit} noValidate>
    <h3>Submit work</h3>
    {error && <p role="alert" className="banner">{error}</p>}
    <fieldset disabled={busy}>
      <label htmlFor="submission-title">Title</label>
      <input id="submission-title" value={title} onChange={(e) => setTitle(e.target.value)} aria-invalid={!!fields.title} aria-describedby={describedBy("title")} />
      {fieldError("title")}
      <label htmlFor="submission-description">Description (optional)</label>
      <textarea id="submission-description" value={description} onChange={(e) => setDescription(e.target.value)} aria-invalid={!!fields.description} aria-describedby={describedBy("description")} />
      {fieldError("description")}
      <label htmlFor="submission-link">Link</label>
      <input id="submission-link" type="url" value={link} onChange={(e) => setLink(e.target.value)} aria-invalid={!!fields.link} aria-describedby={describedBy("link")} />
      {fieldError("link")}
      <button type="submit">{busy ? "Submitting…" : "Submit"}</button>
    </fieldset>
  </form>;
}

// F-06: feedback on the submission, oldest first; Supervisors also get the form.

export interface Feedback {
  id: number; submissionId: number; version: number; text: string; createdAt: string; author: { id: number; name: string };
}
const FEEDBACK_MESSAGE = "Enter feedback (1–2000 characters).";

function FeedbackForm({ submissionId, onAdded }: { submissionId: number; onAdded: (feedback: Feedback) => void }) {
  const [text, setText] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const trimmed = text.trim();
    setError(null);
    if (length(trimmed) < 1 || length(trimmed) > 2000) {
      setFieldError(FEEDBACK_MESSAGE);
      return;
    }
    setFieldError(null);
    setBusy(true);
    try {
      const { feedback } = await apiFetch<{ feedback: Feedback }>(`/api/submissions/${submissionId}/feedback`, { method: "POST", body: { text: trimmed } });
      setText("");
      onAdded(feedback);
    } catch (e) {
      if (e instanceof ApiError && e.status === 400 && e.fields.text) setFieldError(e.fields.text);
      else setError("Could not save feedback. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return <form className="milestone-form" onSubmit={submit} noValidate>
    {error && <p role="alert" className="banner">{error}</p>}
    <fieldset disabled={busy}>
      <label htmlFor="feedback-text">Feedback</label>
      <textarea id="feedback-text" value={text} onChange={(e) => setText(e.target.value)} aria-invalid={!!fieldError} aria-describedby={fieldError ? "feedback-text-error" : undefined} />
      {fieldError && <p className="field-error" id="feedback-text-error">{fieldError}</p>}
      <button type="submit">{busy ? "Saving feedback…" : "Add feedback"}</button>
    </fieldset>
  </form>;
}

function FeedbackSection({ submissionId, canWrite }: { submissionId: number; canWrite: boolean }) {
  const [load, setLoad] = useState<{ kind: "loading" | "error" } | { kind: "ready"; feedback: Feedback[] }>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [added, setAdded] = useState(false);
  useEffect(() => {
    let active = true;
    setLoad({ kind: "loading" });
    apiFetch<{ feedback: Feedback[] }>(`/api/submissions/${submissionId}/feedback`).then(
      ({ feedback }) => { if (active) setLoad({ kind: "ready", feedback }); },
      () => { if (active) setLoad({ kind: "error" }); },
    );
    return () => { active = false; };
  }, [submissionId, attempt]);

  return <section className="feedback">
    <h3>Feedback</h3>
    {load.kind === "loading" && <p role="status">Loading feedback…</p>}
    {load.kind === "error" && <><p role="alert">Could not load feedback.</p><button type="button" onClick={() => setAttempt((n) => n + 1)}>Retry</button></>}
    {load.kind === "ready" && (load.feedback.length === 0 ? <p>No feedback yet</p> : <ul className="feedback-list">
      {load.feedback.map((item) => <li key={item.id}>
        <p className="feedback-text">{item.text}</p>
        <p className="muted">{`${item.author.name} on ${formatBangkok(item.createdAt)} · version ${item.version}`}</p>
      </li>)}
    </ul>)}
    {added && <p role="status">Feedback added.</p>}
    {canWrite && load.kind === "ready" && <FeedbackForm submissionId={submissionId} onAdded={(feedback) => {
      setAdded(true);
      setLoad((current) => (current.kind === "ready" ? { kind: "ready", feedback: [...current.feedback, feedback] } : current));
    }} />}
  </section>;
}

export function MilestonePage() {
  const { milestoneId } = useParams();
  const { state: auth } = useAuth();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setState({ kind: "loading" });
    apiFetch<Loaded>(`/api/milestones/${encodeURIComponent(milestoneId ?? "")}/submission`).then(
      ({ milestone, submission }) => { if (active) setState({ kind: "ready", data: { milestone, submission: submission ?? null } }); },
      (e) => { if (active) setState({ kind: e instanceof ApiError && e.status === 404 ? "missing" : "error" }); },
    );
    return () => { active = false; };
  }, [milestoneId, attempt]);

  const student = auth.status === "authenticated" && auth.user.role === "STUDENT";
  const supervisor = auth.status === "authenticated" && auth.user.role === "SUPERVISOR";
  return <section className="milestones">
    <Link to="/milestones">Back to milestones</Link>
    {state.kind === "loading" && <p role="status">Loading submission…</p>}
    {state.kind === "missing" && <p role="alert">Milestone not found.</p>}
    {state.kind === "error" && <><p role="alert">Could not load this milestone.</p><button type="button" onClick={() => setAttempt((n) => n + 1)}>Retry</button></>}
    {state.kind === "ready" && (() => {
      const { milestone, submission } = state.data;
      return <>
        <h2>{milestone.title}</h2>
        <MilestoneFields milestone={milestone} />
        <h3>Submission</h3>
        {submission ? <>
          <SubmissionView submission={submission} />
          <FeedbackSection submissionId={submission.id} canWrite={supervisor} />
        </> : <>
          <p>Not submitted yet</p>
          {milestone.window === "CLOSED" && <p>The deadline has passed.</p>}
          {student && milestone.window === "OPEN" && <SubmitForm milestoneId={milestone.id} onSubmitted={(created) =>
            setState({ kind: "ready", data: { milestone: { ...milestone, teamStatus: "SUBMITTED" }, submission: created } })} />}
        </>}
      </>;
    })()}
  </section>;
}
