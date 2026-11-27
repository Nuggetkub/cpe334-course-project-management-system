import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/App";
import { TOKEN_KEY } from "../src/auth/token";

// F-08 contract §2 UI and AC-08.8: the Supervisor's Manage milestone section.
const milestone = {
  id: 7, teamId: 1, title: "Prototype", description: "Build it", dueAt: "2026-11-27T12:00:00.000Z",
  createdBy: 2, createdAt: "2026-11-20T00:00:00.000Z", lateUntil: null, closedAt: null, closedBy: null,
  window: "OPEN", teamStatus: "NOT_SUBMITTED",
};
type Handler = (url: string, init?: RequestInit) => Response | Promise<Response>;

function open(role: "STUDENT" | "SUPERVISOR", overrides: object = {}, write: Handler = () => Response.json({}, { status: 500 })) {
  sessionStorage.setItem(TOKEN_KEY, "token");
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    if (url.endsWith("/api/auth/me")) return Promise.resolve(Response.json({ user: { id: 2, name: "Demo Supervisor", role } }));
    if (url.endsWith("/feedback")) return Promise.resolve(Response.json({ feedback: [] }));
    if (init?.method === "PATCH" || url.endsWith("/close")) return Promise.resolve(write(url, init));
    return Promise.resolve(Response.json({ milestone: { ...milestone, ...overrides }, submission: null }));
  });
  vi.stubGlobal("fetch", fetchMock);
  render(<MemoryRouter initialEntries={["/milestones/7"]}><App /></MemoryRouter>);
  return fetchMock;
}
const writes = (fetchMock: ReturnType<typeof open>) =>
  fetchMock.mock.calls.filter(([url, init]) => init?.method === "PATCH" || String(url).endsWith("/close"));

beforeEach(() => sessionStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("F-08 manage milestone", () => {
  // D-14 (contract v0.5): the panel uses the shared stacked form, so each label sits above its field.
  // jsdom has no layout, so this checks the structure; TEST-08.8e measures the real layout in Chromium.
  it("TEST-08.8c lays the Manage panel out as the shared stacked form, each label directly before its field", async () => {
    open("SUPERVISOR", { lateUntil: "2026-11-28T12:00:00.000Z" });
    await screen.findByLabelText("Milestone title");
    const panel = screen.getByRole("heading", { name: "Manage milestone" }).closest("section")!;
    const form = panel.querySelector("form")!;
    expect(form).toHaveClass("milestone-form");
    const fieldset = form.querySelector("fieldset")!;
    for (const [label, id] of [["Milestone title", "manage-title"], ["Milestone description", "manage-description"],
      ["Due date and time (Asia/Bangkok)", "manage-due"], ["Late window end (Asia/Bangkok)", "manage-late"]] as const) {
      const field = screen.getByLabelText(label);
      expect(field.id).toBe(id);
      expect(field.parentElement).toBe(fieldset);
      expect(field.previousElementSibling).toHaveTextContent(label);
    }
  });

  it("TEST-08.8c sends only changed fields, shows busy state, then the saved milestone", async () => {
    let respond!: (r: Response) => void;
    const fetchMock = open("SUPERVISOR", {}, () => new Promise<Response>((resolve) => { respond = resolve; }));
    const title = await screen.findByLabelText("Milestone title");
    expect(title).toHaveValue("Prototype");
    fireEvent.change(title, { target: { value: "Prototype v2" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("Saving…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    const [[url, init]] = writes(fetchMock);
    expect(url).toMatch(/\/api\/milestones\/7$/);
    expect(JSON.parse(String(init?.body))).toEqual({ title: "Prototype v2" });
    respond(Response.json({ milestone: { ...milestone, title: "Prototype v2" } }));
    expect(await screen.findByText("Milestone updated.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Prototype v2" })).toBeInTheDocument();
  });

  it("TEST-08.8c shows server field errors beside their inputs and keeps the values", async () => {
    open("SUPERVISOR", {}, () => Response.json({ error: { code: "VALIDATION_ERROR", message: "Check the highlighted fields",
      fields: { dueAt: "The new due date must be later than the current one.", lateUntil: "The late window must end after the due date." } } }, { status: 400 }));
    const due = await screen.findByLabelText("Due date and time (Asia/Bangkok)");
    fireEvent.change(due, { target: { value: "2026-11-26T19:00" } });
    fireEvent.change(screen.getByLabelText("Late window end (Asia/Bangkok)"), { target: { value: "2026-11-26T20:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("The new due date must be later than the current one.")).toBeInTheDocument();
    expect(screen.getByText("The late window must end after the due date.")).toBeInTheDocument();
    expect(due).toHaveValue("2026-11-26T19:00");
    expect(due).toHaveAttribute("aria-invalid", "true");
  });

  it("TEST-08.8c shows a safe error on 5xx and allows a retry", async () => {
    const fetchMock = open("SUPERVISOR");
    fireEvent.change(await screen.findByLabelText("Milestone description"), { target: { value: "New text" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("Could not save the milestone. Please try again.")).toBeInTheDocument();
    expect(screen.getByLabelText("Milestone description")).toHaveValue("New text");
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(writes(fetchMock)).toHaveLength(2));
  });

  it("TEST-08.8c closes after confirmation and disables the date inputs", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    const fetchMock = open("SUPERVISOR", {}, () => Response.json({ milestone: { ...milestone, closedAt: "2026-11-25T12:00:00.000Z", closedBy: 2, window: "CLOSED" } }));
    const button = await screen.findByRole("button", { name: "Close milestone" });
    fireEvent.click(button);
    expect(confirm).toHaveBeenCalledWith("Close this milestone? Students can no longer submit.");
    expect(writes(fetchMock)).toHaveLength(0);
    fireEvent.click(button);
    expect(await screen.findByText("Milestone closed.")).toBeInTheDocument();
    expect(writes(fetchMock)[0][0]).toMatch(/\/api\/milestones\/7\/close$/);
    expect(screen.getByText("Window: Closed")).toBeInTheDocument();
    expect(screen.getByText("This milestone is closed.")).toBeInTheDocument();
    expect(screen.getByLabelText("Due date and time (Asia/Bangkok)")).toBeDisabled();
    expect(screen.getByLabelText("Late window end (Asia/Bangkok)")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Close milestone" })).not.toBeInTheDocument();
  });

  it("TEST-08.8c shows a Student the late-window badges and no Manage section", async () => {
    open("STUDENT", { window: "LATE", lateUntil: "2026-11-27T18:00:00.000Z" });
    expect(await screen.findByText("Window: Late window")).toBeInTheDocument();
    expect(screen.getByText(/^Late until /)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Manage milestone" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Milestone title")).not.toBeInTheDocument();
  });
});
