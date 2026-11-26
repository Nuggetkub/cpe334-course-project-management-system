import { useState, type FormEvent } from "react";
import { ApiError, apiFetch } from "../api";
import { bangkokInputToIso } from "../time";
import type { Milestone } from "./MilestonesPage";

// F-08 contract §2 UI: the assigned Supervisor's Manage milestone section on the detail page.
// The server decides every rule (BR-05, BR-11–BR-13); this form only sends what changed.

/** ISO instant → datetime-local value in Asia/Bangkok (UTC+7, no daylight saving). */
export function isoToBangkokInput(iso: string | null): string {
  if (!iso) return "";
  return new Date(new Date(iso).getTime() + 7 * 3600 * 1000).toISOString().slice(0, 16);
}

const SAVE_ERROR = "Could not save the milestone. Please try again.";

export function ManageMilestone({ milestone, onSaved }: { milestone: Milestone; onSaved: (m: Milestone, message: string) => void }) {
  const [title, setTitle] = useState(milestone.title);
  const [description, setDescription] = useState(milestone.description);
  const [due, setDue] = useState(isoToBangkokInput(milestone.dueAt));
  const [late, setLate] = useState(isoToBangkokInput(milestone.lateUntil));
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const closed = milestone.closedAt !== null;

  async function send(path: string, body: Record<string, unknown> | undefined, message: string) {
    setBusy(true); setError(null); setFields({});
    try {
      const { milestone: saved } = await apiFetch<{ milestone: Milestone }>(path, { method: body ? "PATCH" : "POST", body });
      onSaved(saved, message);
    } catch (e) {
      if (e instanceof ApiError && e.status === 400 && Object.keys(e.fields).length) setFields(e.fields);
      else setError(e instanceof ApiError && e.status === 409 ? "This milestone is closed." : SAVE_ERROR);
    } finally {
      setBusy(false);
    }
  }

  function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const body: Record<string, unknown> = {};
    if (title !== milestone.title) body.title = title;
    if (description !== milestone.description) body.description = description;
    if (!closed && due !== isoToBangkokInput(milestone.dueAt)) body.dueAt = bangkokInputToIso(due) ?? due;
    if (!closed && late !== isoToBangkokInput(milestone.lateUntil)) body.lateUntil = late === "" ? null : bangkokInputToIso(late) ?? late;
    void send(`/api/milestones/${milestone.id}`, body, "Milestone updated.");
  }

  function close() {
    if (busy || !window.confirm("Close this milestone? Students can no longer submit.")) return;
    void send(`/api/milestones/${milestone.id}/close`, undefined, "Milestone closed.");
  }

  const describe = (key: string) => (fields[key] ? `manage-${key}-error` : undefined);
  const fieldError = (key: string) => fields[key] && <p className="field-error" id={`manage-${key}-error`} role="alert">{fields[key]}</p>;
  return <section aria-labelledby="manage-heading">
    <h3 id="manage-heading">Manage milestone</h3>
    <form onSubmit={save} noValidate>
      {busy && <p role="status">Saving…</p>}
      {error && <p role="alert">{error}</p>}
      {fieldError("body")}
      <fieldset disabled={busy}>
        <label htmlFor="manage-title">Milestone title</label>
        <input id="manage-title" value={title} onChange={(e) => setTitle(e.target.value)} aria-invalid={!!fields.title} aria-describedby={describe("title")} />
        {fieldError("title")}
        <label htmlFor="manage-description">Milestone description</label>
        <textarea id="manage-description" value={description} onChange={(e) => setDescription(e.target.value)} aria-invalid={!!fields.description} aria-describedby={describe("description")} />
        {fieldError("description")}
        {closed && <p>This milestone is closed.</p>}
        <label htmlFor="manage-due">Due date and time (Asia/Bangkok)</label>
        <input id="manage-due" type="datetime-local" value={due} disabled={closed} onChange={(e) => setDue(e.target.value)} aria-invalid={!!fields.dueAt} aria-describedby={describe("dueAt")} />
        {fieldError("dueAt")}
        <label htmlFor="manage-late">Late window end (Asia/Bangkok)</label>
        <input id="manage-late" type="datetime-local" value={late} disabled={closed} onChange={(e) => setLate(e.target.value)} aria-invalid={!!fields.lateUntil} aria-describedby={describe("lateUntil")} />
        {fieldError("lateUntil")}
        {!closed && late !== "" && <button type="button" onClick={() => setLate("")}>Remove late window</button>}
        <button type="submit">Save changes</button>
        {!closed && <button type="button" onClick={close}>Close milestone</button>}
      </fieldset>
    </form>
  </section>;
}
