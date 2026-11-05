import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { App } from "../src/App";
import { TOKEN_KEY } from "../src/auth/token";

function open(role: "STUDENT" | "SUPERVISOR", path: string, result: () => Response | Promise<Response>) {
  sessionStorage.setItem(TOKEN_KEY, "test-token");
  const fetchMock = vi.fn((url: string) =>
    url.endsWith("/api/auth/me")
      ? Promise.resolve(Response.json({ user: { id: 1, name: "Signed-in user", role } }))
      : Promise.resolve(result()),
  );
  vi.stubGlobal("fetch", fetchMock);
  render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
  return fetchMock;
}

it("TEST-03.3c shows loading, then the student's team and roster", async () => {
  let complete!: (value: Response) => void;
  const pending = new Promise<Response>((resolve) => { complete = resolve; });
  const fetchMock = open("STUDENT", "/team", () => pending);
  expect(await screen.findByRole("status")).toHaveTextContent("Loading");
  complete(Response.json({ team: {
    id: 1, name: "Team A",
    members: [{ id: 2, name: "Student A" }],
    supervisors: [{ id: 3, name: "Supervisor A" }],
  } }));
  expect(await screen.findByRole("heading", { name: "Team A" })).toBeInTheDocument();
  expect(screen.getByText("Student A")).toBeInTheDocument();
  expect(screen.getByText("Supervisor A")).toBeInTheDocument();
  expect(fetchMock.mock.calls[1]?.[0]).toMatch(/\/api\/teams\/mine$/);
});

it("TEST-03.4c shows the student's no-team state only for the expected 404", async () => {
  open("STUDENT", "/team", () => Response.json({ error: { code: "NOT_FOUND" } }, { status: 404 }));
  expect(await screen.findByText("You are not assigned to a team yet")).toBeInTheDocument();
});

it("TEST-03.6c shows the supervisor's assigned teams", async () => {
  const fetchMock = open("SUPERVISOR", "/teams", () => Response.json({ teams: [{ id: 2, name: "Team B" }] }));
  expect(await screen.findByText("Team B")).toBeInTheDocument();
  expect(fetchMock.mock.calls[1]?.[0]).toMatch(/\/api\/teams$/);
});

it("TEST-03.7c shows a safe error and retries to the supervisor's empty state", async () => {
  const result = vi.fn()
    .mockImplementationOnce(() => Response.json({ error: { message: "internal detail" } }, { status: 500 }))
    .mockImplementationOnce(() => Response.json({ teams: [] }));
  open("SUPERVISOR", "/teams", result);
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not load team information");
  expect(screen.queryByText("internal detail")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(await screen.findByText("No teams assigned yet")).toBeInTheDocument();
});

it.each([["STUDENT", "/teams"], ["SUPERVISOR", "/team"]] as const)(
  "TEST-03.8c does not fetch the other role's team endpoint (%s)",
  async (role, path) => {
    const fetchMock = open(role, path, () => Response.json({}));
    expect(await screen.findByRole("alert")).toHaveTextContent("You do not have permission");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  },
);
