import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/App";
import { TOKEN_KEY } from "../src/auth/token";

// F-11 contract v0.6 §2 UI and AC-11.6 (TEST-11.6c). Phase 2: a Grade column with the released score or "Not released".
const team = { id: 1, name: "Team A", members: [], supervisors: [] };
const row = (id: number, extra: object = {}) => ({
  milestoneId: id, title: `Milestone ${id}`, dueAt: "2026-11-28T05:00:00.000Z", window: "OPEN", teamStatus: "NOT_SUBMITTED",
  latest: null, feedbackStatus: "NONE", grade: { released: false }, ...extra,
});
const board = (rows: object[], page = 1, total = rows.length) => Response.json({ team: { id: 1, name: "Team A" }, rows, page, pageSize: 50, total });
type Routes = { mine?: () => Response | Promise<Response>; progress: (url: string) => Response | Promise<Response> };

function open(routes: Routes, role: "STUDENT" | "SUPERVISOR" = "STUDENT") {
  sessionStorage.setItem(TOKEN_KEY, "token");
  const fetchMock = vi.fn((url: string) => {
    if (url.endsWith("/api/auth/me")) return Promise.resolve(Response.json({ user: { id: 1, name: "Somchai Student", role } }));
    if (url.endsWith("/api/teams/mine")) return Promise.resolve(routes.mine ? routes.mine() : Response.json({ team }));
    return Promise.resolve(routes.progress(url));
  });
  vi.stubGlobal("fetch", fetchMock);
  render(<MemoryRouter initialEntries={["/progress"]}><App /></MemoryRouter>);
  return fetchMock;
}

beforeEach(() => sessionStorage.clear());

describe("F-11 progress page", () => {
  it("TEST-11.6c shows a Progress link for Students only", async () => {
    open({ progress: () => board([]) });
    expect(await screen.findByRole("link", { name: "Progress" })).toHaveAttribute("href", "/progress");
  });

  it("TEST-11.6c shows loading, then the rows with their labels, Late badge and links", async () => {
    let resolve!: (r: Response) => void;
    const pending = new Promise<Response>((done) => { resolve = done; });
    const fetchMock = open({ progress: () => pending });
    expect(await screen.findByRole("status")).toHaveTextContent("Loading progress…");
    resolve(board([
      row(1, { title: "Overdue one", window: "CLOSED", teamStatus: "OVERDUE" }),
      row(2, { title: "Late one", window: "LATE", teamStatus: "LATE", latest: { version: 2, late: true, submittedAt: "2026-11-28T06:00:00.000Z" }, feedbackStatus: "AWAITING" }),
      row(3, { title: "Reviewed one", teamStatus: "SUBMITTED", latest: { version: 1, late: false, submittedAt: "2026-11-27T06:00:00.000Z" }, feedbackStatus: "RECEIVED", grade: { released: true, score: 85 } }),
    ]));
    const table = await screen.findByRole("table", { name: "Progress for Team A" });
    expect(within(table).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(
      ["Milestone", "Due (ICT)", "Window", "Team status", "Latest version", "Feedback", "Grade"]);
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(3);

    const [overdue, late, reviewed] = rows.map((r) => within(r));
    expect(overdue.getByRole("link", { name: "Overdue one" })).toHaveAttribute("href", "/milestones/1");
    expect(overdue.getByText("28 Nov 2026, 12:00 (ICT)")).toBeInTheDocument();
    expect(overdue.getByText("Closed")).toBeInTheDocument();
    expect(overdue.getByText("Overdue")).toBeInTheDocument();
    expect(overdue.getByText("Not submitted")).toBeInTheDocument();
    expect(overdue.getByText("—")).toBeInTheDocument();

    expect(late.getByText("Late window")).toBeInTheDocument();
    expect(late.getByText("Version 2")).toBeInTheDocument();
    expect(late.getAllByText("Late").length).toBe(2); // team status Late and the Late badge on the version
    expect(late.getByText("Awaiting feedback")).toBeInTheDocument();

    expect(reviewed.getByText("Open")).toBeInTheDocument();
    expect(reviewed.getByText("Submitted")).toBeInTheDocument();
    expect(reviewed.getByText("Version 1")).toBeInTheDocument();
    expect(reviewed.queryByText("Late")).not.toBeInTheDocument();
    expect(reviewed.getByText("Feedback received")).toBeInTheDocument();

    // Phase 2: the released score, otherwise "Not released" (labelled for the stacked layout).
    expect(reviewed.getByText("85 / 100")).toHaveAttribute("data-label", "Grade");
    expect(overdue.getByText("Not released")).toHaveAttribute("data-label", "Grade");
    expect(late.getByText("Not released")).toBeInTheDocument();
    expect(reviewed.queryByText("Not released")).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.map(([url]) => url)).toContain("/api/teams/1/progress?page=1");
  });

  it("TEST-11.6c shows the empty state", async () => {
    open({ progress: () => board([]) });
    expect(await screen.findByText("No milestones yet")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("TEST-11.6c shows an error with Retry, and Retry recovers", async () => {
    let calls = 0;
    open({ progress: () => (calls++ === 0 ? Response.json({}, { status: 500 }) : board([row(1)])) });
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load progress.");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("link", { name: "Milestone 1" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("TEST-11.6c shows the no-team state for a Student with no team", async () => {
    const fetchMock = open({
      mine: () => Response.json({ error: { code: "NOT_FOUND", message: "Not found" } }, { status: 404 }),
      progress: () => board([]),
    });
    expect(await screen.findByText("You are not assigned to a team yet")).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/progress"))).toBe(false);
  });

  it("TEST-11.6c pages with Previous and Next", async () => {
    const fetchMock = open({ progress: (url) => url.endsWith("page=2") ? board([row(51)], 2, 51) : board([row(1)], 1, 51) });
    expect(await screen.findByRole("link", { name: "Milestone 1" })).toBeInTheDocument();
    expect(screen.getByText("Page 1 · 51 milestones")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByRole("link", { name: "Milestone 51" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    expect(fetchMock.mock.calls.map(([url]) => url)).toContain("/api/teams/1/progress?page=2");
  });
});
