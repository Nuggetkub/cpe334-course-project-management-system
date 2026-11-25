import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { App } from "../src/App";
import { TOKEN_KEY } from "../src/auth/token";

const team = { id: 7, name: "Team A" };
const member = { id: 20, name: "Student A" };
const candidate = { id: 21, name: "Student B" };
const failure = (status: number, code: string, message: string, fields?: Record<string, string>) =>
  Response.json({ error: { code, message, fields } }, { status });

function open(path: string, handler: (path: string, init?: RequestInit) => Response | Promise<Response>, role = "SUPERVISOR") {
  sessionStorage.setItem(TOKEN_KEY, "test-token");
  const mock = vi.fn(async (url: string, init?: RequestInit) => {
    const apiPath = new URL(url, "http://localhost").pathname;
    if (apiPath === "/api/auth/me") return Response.json({ user: { id: 1, name: "Test user", role } });
    return handler(apiPath, init);
  });
  vi.stubGlobal("fetch", mock);
  render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
  return mock;
}

it("TEST-07.6c retains a rejected team name, retries, and opens the persisted team", async () => {
  let attempts = 0;
  open("/teams", (path, init) => {
    if (path === "/api/teams" && init?.method === "POST") {
      attempts++;
      expect(JSON.parse(String(init.body))).toEqual({ name: team.name });
      return attempts === 1 ? failure(409, "TEAM_NAME_UNAVAILABLE", "Unavailable", { name: "Choose another name" })
        : Response.json({ team }, { status: 201 });
    }
    if (path === "/api/teams") return Response.json({ teams: attempts > 1 ? [team] : [] });
    if (path === `/api/teams/${team.id}`) return Response.json({ team: { ...team, members: [] } });
    if (path.endsWith("/member-candidates")) return Response.json({ students: [], page: 1, hasMore: false });
    throw new Error(`Unexpected path ${path}`);
  });
  expect(await screen.findByText("No teams assigned yet")).toBeInTheDocument();
  const name = screen.getByRole("textbox", { name: "Team name" });
  fireEvent.change(name, { target: { value: team.name } });
  fireEvent.click(screen.getByRole("button", { name: "Create team" }));
  expect(await screen.findByText("Choose another name")).toBeInTheDocument();
  expect(name).toHaveValue(team.name);
  fireEvent.click(screen.getByRole("button", { name: "Create team" }));
  expect(await screen.findByRole("heading", { name: `Manage ${team.name}` })).toBeInTheDocument();
  expect(screen.getByText("No members listed")).toBeInTheDocument();
});

it("TEST-07.6c retries roster and candidates and leaves a protected member visible", async () => {
  let rosterLoads = 0;
  let candidateLoads = 0;
  open(`/teams/${team.id}/manage`, (path, init) => {
    if (path === `/api/teams/${team.id}`) return ++rosterLoads === 1 ? failure(500, "INTERNAL", "private detail")
      : Response.json({ team: { ...team, members: [member] } });
    if (path.endsWith("/member-candidates")) return ++candidateLoads === 1 ? failure(500, "INTERNAL", "private detail")
      : Response.json({ students: [candidate], page: 1, hasMore: false });
    if (init?.method === "DELETE") return failure(409, "MEMBER_HAS_SUBMISSIONS", "This student has submitted work for this team.");
    throw new Error(`Unexpected path ${path}`);
  });
  fireEvent.click(await screen.findByRole("button", { name: "Retry roster" }));
  fireEvent.click(await screen.findByRole("button", { name: "Retry candidates" }));
  expect(await screen.findByRole("option", { name: candidate.name })).toBeInTheDocument();
  fireEvent.click(await screen.findByRole("button", { name: `Remove ${member.name}` }));
  expect(screen.getByText(`Remove ${member.name} from this team?`)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Confirm removal" }));
  expect(await screen.findByText("This student has submitted work for this team.")).toBeInTheDocument();
  expect(screen.getByText(member.name)).toBeInTheDocument();
  expect(screen.queryByText("private detail")).not.toBeInTheDocument();
});

it("TEST-07.6c discards a roster response for a team the supervisor has left", async () => {
  let complete!: (value: Response) => void;
  const old = new Promise<Response>((resolve) => { complete = resolve; });
  const next = { id: 8, name: "Team B" };
  const mock = open(`/teams/${team.id}/manage`, (path) => {
    if (path === `/api/teams/${team.id}`) return old;
    if (path === "/api/teams") return Response.json({ teams: [next] });
    if (path === `/api/teams/${next.id}`) return Response.json({ team: { ...next, members: [] } });
    if (path.endsWith("/member-candidates")) return Response.json({ students: [], page: 1, hasMore: false });
    throw new Error(`Unexpected path ${path}`);
  });
  await waitFor(() => expect(mock.mock.calls.some(([url]) => url.endsWith(`/api/teams/${team.id}`))).toBe(true));
  expect(screen.getByText("Loading roster…")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("link", { name: "Back to My teams" }));
  fireEvent.click(await screen.findByRole("link", { name: `Manage ${next.name}` }));
  expect(await screen.findByRole("heading", { name: `Manage ${next.name}` })).toBeInTheDocument();
  await act(async () => complete(Response.json({ team: { ...team, members: [member] } })));
  expect(screen.queryByText(member.name)).not.toBeInTheDocument();
});

it("TEST-07.6c never loads management data for a student", async () => {
  const mock = open(`/teams/${team.id}/manage`, () => { throw new Error("Management data requested"); }, "STUDENT");
  expect(await screen.findByRole("alert")).toHaveTextContent("You do not have permission");
  expect(screen.queryByRole("button", { name: /create team|add student|remove/i })).not.toBeInTheDocument();
  expect(mock).toHaveBeenCalledTimes(1);
});
