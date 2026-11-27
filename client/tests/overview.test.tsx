import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/App";
import { TOKEN_KEY } from "../src/auth/token";

// F-12 contract v0.3 §2 UI and AC-12.5 (TEST-12.5c): states, filters kept in the URL, no stale replacement.
const teams = [{ id: 1, name: "Team A" }, { id: 2, name: "Team A2" }];
const row = (id: number, extra: object = {}) => ({
  teamId: 1, teamName: "Team A", milestoneId: id, title: `Milestone ${id}`, dueAt: "2026-11-28T05:00:00.000Z",
  window: "OPEN", submissionState: "NOT_DUE", feedbackState: "NONE", latestVersion: null, ...extra,
});
const overview = (rows: object[], extra: object = {}) =>
  Response.json({ rows, page: 1, pageSize: 50, total: rows.length, filters: { team: null, state: [] }, ...extra });
type Handler = (url: string) => Response | Promise<Response>;

function Where() {
  const location = useLocation();
  return <div data-testid="where">{location.pathname + location.search}</div>;
}
function open(handler: Handler, path = "/overview", role: "STUDENT" | "SUPERVISOR" = "SUPERVISOR",
  teamsHandler: () => Response = () => Response.json({ teams })) {
  sessionStorage.setItem(TOKEN_KEY, "token");
  const fetchMock = vi.fn((url: string) => {
    if (url.endsWith("/api/auth/me")) return Promise.resolve(Response.json({ user: { id: 9, name: "Pim Supervisor", role } }));
    if (url.endsWith("/api/teams")) return Promise.resolve(teamsHandler());
    return Promise.resolve(handler(url));
  });
  vi.stubGlobal("fetch", fetchMock);
  render(<MemoryRouter initialEntries={[path]}><App /><Where /></MemoryRouter>);
  return fetchMock;
}
const overviewCalls = (fetchMock: ReturnType<typeof open>) =>
  fetchMock.mock.calls.map(([url]) => String(url)).filter((url) => url.includes("/api/overview"));
const where = () => screen.getByTestId("where").textContent;

beforeEach(() => sessionStorage.clear());

describe("F-12 supervisor overview page", () => {
  it("TEST-12.5c shows an Overview link for Supervisors", async () => {
    open(() => overview([]));
    expect(await screen.findByRole("link", { name: "Overview" })).toHaveAttribute("href", "/overview");
  });

  it("TEST-12.5c sends a Student home from /overview, with no link and no request", async () => {
    const fetchMock = open(() => overview([]), "/overview", "STUDENT");
    expect(await screen.findByRole("link", { name: "Progress" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Overview" })).not.toBeInTheDocument();
    expect(where()).toBe("/");
    expect(overviewCalls(fetchMock)).toEqual([]);
  });

  it("TEST-12.5c shows loading, then one labelled row per milestone with links", async () => {
    let resolve!: (r: Response) => void;
    const pending = new Promise<Response>((done) => { resolve = done; });
    const fetchMock = open(() => pending);
    expect(await screen.findByRole("status")).toHaveTextContent("Loading overview…");
    resolve(overview([
      row(1, { title: "Missing one", window: "CLOSED", submissionState: "MISSING" }),
      row(2, { title: "Late one", window: "LATE", submissionState: "LATE", feedbackState: "AWAITING", latestVersion: 2 }),
      row(3, { teamId: 2, teamName: "Team A2", title: "Reviewed one", submissionState: "SUBMITTED", feedbackState: "RECEIVED", latestVersion: 1 }),
      row(4, { title: "Future one" }),
    ]));
    const table = await screen.findByRole("table", { name: "Supervisor overview" });
    expect(within(table).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(
      ["Team", "Milestone", "Due (ICT)", "Window", "Submission", "Feedback"]);
    const [missing, late, reviewed, future] = within(table).getAllByRole("row").slice(1).map((r) => within(r));
    expect(missing.getByText("Team A")).toHaveAttribute("data-label", "Team");
    expect(missing.getByRole("link", { name: "Missing one" })).toHaveAttribute("href", "/milestones/1");
    expect(missing.getByText("28 Nov 2026, 12:00 (ICT)")).toBeInTheDocument();
    expect(missing.getByText("Closed")).toBeInTheDocument();
    expect(missing.getByText("Missing")).toHaveAttribute("data-label", "Submission");
    expect(missing.getByText("—")).toHaveAttribute("data-label", "Feedback");
    expect(late.getByText("Late window")).toBeInTheDocument();
    expect(late.getByText("Late")).toBeInTheDocument();
    expect(late.getByText("Awaiting feedback")).toBeInTheDocument();
    expect(reviewed.getByText("Team A2")).toBeInTheDocument();
    expect(reviewed.getByText("Submitted")).toBeInTheDocument();
    expect(reviewed.getByText("Feedback received")).toBeInTheDocument();
    expect(future.getByText("Open")).toBeInTheDocument();
    expect(future.getByText("Not due")).toBeInTheDocument();
    expect(screen.getByText("Page 1 · 4 milestones")).toBeInTheDocument();
    expect(overviewCalls(fetchMock)).toEqual(["/api/overview?page=1"]);
  });

  it("TEST-12.5c offers All my teams plus each team, and every state as a checkbox", async () => {
    open(() => overview([row(1)]));
    const select = await screen.findByLabelText("Team");
    expect(await within(select).findByRole("option", { name: "Team A2" })).toBeInTheDocument();
    expect(within(select).getAllByRole("option").map((o) => o.textContent)).toEqual(["All my teams", "Team A", "Team A2"]);
    expect(select).toHaveValue("");
    const states = within(screen.getByRole("group", { name: "State" })).getAllByRole("checkbox");
    expect(states.map((c) => c.closest("label")?.textContent)).toEqual(["Late", "Submitted", "Missing", "Not due", "Awaiting feedback"]);
    expect(states.every((c) => !(c as HTMLInputElement).checked)).toBe(true);
  });

  it("TEST-12.5c puts each filter change in the URL and the request, in a fixed order, back on page 1", async () => {
    const fetchMock = open(() => overview([row(1)], { page: 2, total: 60 }), "/overview?page=2");
    expect(await screen.findByRole("link", { name: "Milestone 1" })).toBeInTheDocument();
    fireEvent.change(await screen.findByLabelText("Team"), { target: { value: "2" } });
    expect(where()).toBe("/overview?team=2");
    fireEvent.click(screen.getByRole("checkbox", { name: "Awaiting feedback" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Missing" }));
    expect(where()).toBe("/overview?team=2&state=MISSING&state=AWAITING");
    fireEvent.click(screen.getByRole("checkbox", { name: "Missing" }));
    expect(where()).toBe("/overview?team=2&state=AWAITING");
    fireEvent.change(screen.getByLabelText("Team"), { target: { value: "" } });
    expect(where()).toBe("/overview?state=AWAITING");
    await screen.findByRole("link", { name: "Milestone 1" });
    expect(overviewCalls(fetchMock)).toEqual([
      "/api/overview?page=2",
      "/api/overview?team=2&page=1",
      "/api/overview?team=2&state=AWAITING&page=1",
      "/api/overview?team=2&state=MISSING&state=AWAITING&page=1",
      "/api/overview?team=2&state=AWAITING&page=1",
      "/api/overview?state=AWAITING&page=1",
    ]);
  });

  it("TEST-12.5c reads the filters from a reloaded or shared URL", async () => {
    const fetchMock = open(() => overview([row(1)]), "/overview?state=AWAITING&team=2&state=LATE");
    expect(await screen.findByRole("link", { name: "Milestone 1" })).toBeInTheDocument();
    const select = screen.getByLabelText("Team");
    await within(select).findByRole("option", { name: "Team A2" });
    expect(select).toHaveValue("2");
    expect(screen.getByRole("checkbox", { name: "Late" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Awaiting feedback" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Missing" })).not.toBeChecked();
    expect(overviewCalls(fetchMock)).toEqual(["/api/overview?team=2&state=LATE&state=AWAITING&page=1"]);
  });

  it("TEST-12.5c tells 'no milestones yet' from 'nothing matches these filters'", async () => {
    open(() => overview([]));
    expect(await screen.findByText("No milestones yet")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "Late" }));
    expect(await screen.findByText("Nothing matches these filters")).toBeInTheDocument();
    expect(screen.queryByText("No milestones yet")).not.toBeInTheDocument();
  });

  it("TEST-12.5c shows an error with Retry, and Retry recovers", async () => {
    let calls = 0;
    open(() => (calls++ === 0 ? Response.json({}, { status: 500 }) : overview([row(1)])));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load the overview.");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("link", { name: "Milestone 1" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("TEST-12.5c shows a team-list error beside the select, keeps the table, and Retry restores the options", async () => {
    let teamCalls = 0;
    const fetchMock = open(() => overview([row(1)]), "/overview", "SUPERVISOR",
      () => (teamCalls++ === 0 ? Response.json({}, { status: 500 }) : Response.json({ teams })));
    expect(await screen.findByRole("link", { name: "Milestone 1" })).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load your teams.");
    const select = screen.getByLabelText("Team");
    expect(within(select).getAllByRole("option").map((o) => o.textContent)).toEqual(["All my teams"]);
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument(); // the overview itself is fine

    fireEvent.click(screen.getByRole("button", { name: "Retry loading teams" }));
    expect(await within(select).findByRole("option", { name: "Team A2" })).toBeInTheDocument();
    expect(within(select).getAllByRole("option").map((o) => o.textContent)).toEqual(["All my teams", "Team A", "Team A2"]);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Milestone 1" })).toBeInTheDocument(); // the table stayed throughout
    expect(teamCalls).toBe(2);
    expect(overviewCalls(fetchMock)).toEqual(["/api/overview?page=1"]); // retrying the teams never refetches the rows
  });

  it("TEST-12.5c answers the fixed 404 for a team in the URL with a way back to all teams", async () => {
    const fetchMock = open((url) => url.includes("team=")
      ? Response.json({ error: { code: "NOT_FOUND", message: "Not found" } }, { status: 404 })
      : overview([row(1)]), "/overview?team=77");
    expect(await screen.findByRole("alert")).toHaveTextContent("Team not found.");
    fireEvent.click(screen.getByRole("button", { name: "Show all my teams" }));
    expect(await screen.findByRole("link", { name: "Milestone 1" })).toBeInTheDocument();
    expect(where()).toBe("/overview");
    expect(overviewCalls(fetchMock)).toEqual(["/api/overview?team=77&page=1", "/api/overview?page=1"]);
  });

  it("TEST-12.5c never lets an older filter's response replace the current one", async () => {
    let resolveOld!: (r: Response) => void;
    const old = new Promise<Response>((done) => { resolveOld = done; });
    open((url) => (url.includes("state=MISSING") ? overview([row(2, { title: "Current rows" })]) : old));
    expect(await screen.findByRole("status")).toHaveTextContent("Loading overview…");
    fireEvent.click(screen.getByRole("checkbox", { name: "Missing" }));
    expect(await screen.findByRole("link", { name: "Current rows" })).toBeInTheDocument();
    resolveOld(overview([row(1, { title: "Old rows" })]));
    await new Promise((done) => setTimeout(done, 20));
    expect(screen.getByRole("link", { name: "Current rows" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Old rows" })).not.toBeInTheDocument();
  });

  it("TEST-12.5c pages with Previous and Next and keeps the filters", async () => {
    const fetchMock = open((url) => url.endsWith("page=2")
      ? overview([row(51)], { page: 2, total: 51 }) : overview([row(1)], { total: 51 }), "/overview?state=NOT_DUE");
    expect(await screen.findByRole("link", { name: "Milestone 1" })).toBeInTheDocument();
    expect(screen.getByText("Page 1 · 51 milestones")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByRole("link", { name: "Milestone 51" })).toBeInTheDocument();
    expect(where()).toBe("/overview?state=NOT_DUE&page=2");
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    expect(overviewCalls(fetchMock)).toContain("/api/overview?state=NOT_DUE&page=2");
  });
});
