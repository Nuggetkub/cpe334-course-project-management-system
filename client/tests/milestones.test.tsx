import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { App } from "../src/App";
import { TOKEN_KEY } from "../src/auth/token";

const row = { id: 7, teamId: 1, title: "Prototype", description: "Build it", dueAt: "2026-11-08T16:59:00Z", window: "OPEN", teamStatus: "NOT_SUBMITTED" };
const response = (rows = [row], page = 1, total = rows.length) => Response.json({ milestones: rows, page, pageSize: 50, total });
beforeEach(() => sessionStorage.clear());
function open(role: "STUDENT" | "SUPERVISOR", handler: (url: string, init?: RequestInit) => Response | Promise<Response>, path = "/teams/1/milestones") {
  sessionStorage.setItem(TOKEN_KEY, "token");
  const fetchMock = vi.fn((url: string, init?: RequestInit) => Promise.resolve(url.endsWith("/api/auth/me")
    ? Response.json({ user: { id: 1, name: "User", role } }) : handler(url, init)));
  vi.stubGlobal("fetch", fetchMock);
  render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
  return fetchMock;
}
async function fill() {
  fireEvent.change(await screen.findByLabelText("Title"), { target: { value: "New milestone" } });
  fireEvent.change(screen.getByLabelText("Description (optional)"), { target: { value: "New description" } });
  fireEvent.change(screen.getByLabelText("Due date and time (Asia/Bangkok)"), { target: { value: "2028-11-08T23:59" } });
}

it("TEST-04.6c announces loading then empty", async () => {
  let resolve!: (r: Response) => void;
  open("STUDENT", () => new Promise<Response>((done) => { resolve = done; }));
  expect(await screen.findByRole("status")).toHaveTextContent("Loading milestones");
  resolve(response([]));
  expect(await screen.findByText("No milestones yet")).toBeInTheDocument();
  expect(screen.queryByLabelText("Title")).not.toBeInTheDocument();
});

it("TEST-04.6c retries a safe list error", async () => {
  const handler = vi.fn().mockImplementationOnce(() => Response.json({}, { status: 500 })).mockImplementation(() => response([]));
  open("STUDENT", handler);
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not load milestones");
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(await screen.findByText("No milestones yet")).toBeInTheDocument();
});

it("TEST-04.2c blocks empty input and displays server field errors beside retained values", async () => {
  const fetchMock = open("SUPERVISOR", (_url, init) => init?.method === "POST"
    ? Response.json({ error: { code: "VALIDATION_ERROR", message: "Check fields", fields: { dueAt: "Choose a future deadline" } } }, { status: 400 }) : response([]));
  fireEvent.click(await screen.findByRole("button", { name: "Create milestone" }));
  expect(await screen.findByText("Enter a title (1–120 characters).")).toBeInTheDocument();
  expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(0);
  await fill();
  fireEvent.click(screen.getByRole("button", { name: "Create milestone" }));
  expect(await screen.findByText("Choose a future deadline")).toBeInTheDocument();
  expect(screen.getByLabelText("Title")).toHaveValue("New milestone");
});

it.each(["server", "network"])("TEST-04.5c retains the busy form after %s failure and refreshes page one on retry", async (kind) => {
  let finish!: (r: Response) => void;
  let fail!: (e: Error) => void;
  let writes = 0;
  const fetchMock = open("SUPERVISOR", (_url, init) => {
    if (init?.method === "POST") {
      writes++;
      return writes === 1 ? new Promise<Response>((resolve, reject) => { finish = resolve; fail = reject; }) : Response.json({ milestone: row }, { status: 201 });
    }
    return response(writes > 1 ? [row] : []);
  });
  await fill();
  fireEvent.click(screen.getByRole("button", { name: "Create milestone" }));
  expect(await screen.findByRole("button", { name: "Creating milestone…" })).toBeDisabled();
  expect(screen.getByLabelText("Title")).toBeDisabled();
  if (kind === "server") finish(Response.json({}, { status: 500 })); else fail(new TypeError("network"));
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not create milestone");
  expect(screen.getByLabelText("Title")).toHaveValue("New milestone");
  expect(screen.getByLabelText("Description (optional)")).toHaveValue("New description");
  fireEvent.click(screen.getByRole("button", { name: "Create milestone" }));
  expect(await screen.findByRole("link", { name: "Prototype" })).toHaveAttribute("href", "/milestones/7");
  await waitFor(() => expect(screen.getByLabelText("Title")).toHaveValue(""));
  const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
  expect(JSON.parse(String(post?.[1]?.body))).toMatchObject({ dueAt: "2028-11-08T16:59:00.000Z" });
});

it("TEST-04.3c shows Bangkok time and separate statuses without a Student create form", async () => {
  open("STUDENT", () => response());
  expect(await screen.findByRole("link", { name: "Prototype" })).toBeInTheDocument();
  expect(screen.getByText("8 Nov 2026, 23:59 (ICT)")).toBeInTheDocument();
  expect(screen.getByText("Window: Open")).toBeInTheDocument();
  expect(screen.getByText("Team status: Not submitted")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Create milestone" })).not.toBeInTheDocument();
});

it("TEST-04.8c loads the next page rather than hiding older milestones", async () => {
  const fetchMock = open("STUDENT", (url) => response([{ ...row, title: url.includes("page=2") ? "Page two" : "Page one" }], url.includes("page=2") ? 2 : 1, 51));
  expect(await screen.findByRole("link", { name: "Page one" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(await screen.findByRole("link", { name: "Page two" })).toBeInTheDocument();
  expect(fetchMock.mock.calls.some(([url]) => url.endsWith("/milestones?page=2"))).toBe(true);
});

it("TEST-04.3c shows a no-team message without fetching team milestones", async () => {
  const fetchMock = open("STUDENT", () => Response.json({ error: { code: "NOT_FOUND" } }, { status: 404 }), "/milestones");
  expect(await screen.findByText("You are not assigned to a team yet")).toBeInTheDocument();
  expect(fetchMock.mock.calls.some(([url]) => /\/teams\/\d+\/milestones/.test(url))).toBe(false);
});

it("TEST-04.3c opens read-only detail and hides missing detail safely", async () => {
  open("STUDENT", () => Response.json({ milestone: row }), "/milestones/7");
  expect(await screen.findByRole("heading", { name: "Prototype" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Create milestone" })).not.toBeInTheDocument();
});

it("TEST-04.3c shows no fields for a hidden milestone", async () => {
  open("STUDENT", () => Response.json({ error: { code: "NOT_FOUND" } }, { status: 404 }), "/milestones/7");
  expect(await screen.findByRole("alert")).toHaveTextContent("Milestone not found.");
  expect(screen.queryByText("Build it")).not.toBeInTheDocument();
});

it("TEST-04.8c ignores old-team results after selecting another supervised team", async () => {
  let old!: (r: Response) => void;
  open("SUPERVISOR", (url) => {
    if (url.endsWith("/api/teams")) return Response.json({ teams: [{ id: 1, name: "Team A" }, { id: 2, name: "Team B" }] });
    if (url.includes("/teams/1/")) return new Promise<Response>((resolve) => { old = resolve; });
    return response([{ ...row, teamId: 2, title: "Team B milestone" }]);
  }, "/milestones");
  fireEvent.change(await screen.findByLabelText("Team"), { target: { value: "2" } });
  expect(await screen.findByRole("link", { name: "Team B milestone" })).toBeInTheDocument();
  old(response([{ ...row, title: "Team A private draft" }]));
  await waitFor(() => expect(screen.queryByText("Team A private draft")).not.toBeInTheDocument());
});
