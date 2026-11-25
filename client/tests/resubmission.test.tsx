import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/App";
import { TOKEN_KEY } from "../src/auth/token";

// F-09 contract §2 UI and AC-09.8: new versions, Late marking, closed milestones and earlier versions.
const milestone = {
  id: 7, teamId: 1, title: "Prototype", description: "", dueAt: "2026-11-27T12:00:00.000Z",
  createdBy: 2, createdAt: "2026-11-20T00:00:00.000Z", lateUntil: null, closedAt: null, closedBy: null,
  window: "OPEN", teamStatus: "SUBMITTED",
};
const version = (n: number, late = false) => ({
  id: 100 + n, milestoneId: 7, version: n, title: `Work v${n}`, description: "", link: `https://example.com/v${n}`,
  submittedAt: "2026-11-26T05:00:00.000Z", submittedBy: { id: 1, name: "Somchai Student" }, late,
});
type Routes = { page: object; history?: () => Response | Promise<Response>; post?: () => Response };

function open(role: "STUDENT" | "SUPERVISOR", routes: Routes) {
  sessionStorage.setItem(TOKEN_KEY, "token");
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    if (url.endsWith("/api/auth/me")) return Promise.resolve(Response.json({ user: { id: 1, name: "Somchai Student", role } }));
    if (url.endsWith("/feedback")) return Promise.resolve(Response.json({ feedback: [] }));
    if (url.endsWith("/submissions") && init?.method === "POST") return Promise.resolve(routes.post!());
    if (url.endsWith("/submissions")) return Promise.resolve(routes.history ? routes.history() : Response.json({ milestone, submissions: [] }));
    return Promise.resolve(Response.json(routes.page));
  });
  vi.stubGlobal("fetch", fetchMock);
  render(<MemoryRouter initialEntries={["/milestones/7"]}><App /></MemoryRouter>);
  return fetchMock;
}

beforeEach(() => sessionStorage.clear());

describe("F-09 milestone page", () => {
  it("TEST-09.8c submits a Late new version in the late window and moves the old one to Earlier versions", async () => {
    let versions = [version(1)];
    open("STUDENT", {
      page: { milestone: { ...milestone, window: "LATE", lateUntil: "2026-11-27T18:00:00.000Z" }, submission: version(1) },
      history: () => Response.json({ milestone, submissions: versions }),
      post: () => { versions = [version(2, true), version(1)]; return Response.json({ submission: version(2, true) }, { status: 201 }); },
    });
    expect(await screen.findByText("Submissions now are marked Late.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Submit a new version" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Work v2" } });
    fireEvent.change(screen.getByLabelText("Link"), { target: { value: "https://example.com/v2" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(await screen.findByText("Version 2")).toBeInTheDocument();
    expect(screen.getByText("Team status: Late")).toBeInTheDocument();
    const earlier = await screen.findByRole("region", { name: "Earlier versions" });
    expect(within(earlier).getByText("Version 1")).toBeInTheDocument();
    expect(within(earlier).getByText("Work v1")).toBeInTheDocument();
  });

  it("TEST-09.8c shows every earlier version with its Late badge and feedback form to a Supervisor", async () => {
    open("SUPERVISOR", {
      page: { milestone, submission: version(3) },
      history: () => Response.json({ milestone, submissions: [version(3), version(2, true), version(1)] }),
    });
    const earlier = await screen.findByRole("region", { name: "Earlier versions" });
    expect(within(earlier).getAllByText(/^Version [12]$/).map((e) => e.textContent)).toEqual(["Version 2", "Version 1"]);
    expect(within(earlier).getAllByText("Late")).toHaveLength(1);
    await waitFor(() => expect(within(earlier).getAllByRole("button", { name: "Add feedback" })).toHaveLength(2));
    expect(screen.queryByRole("button", { name: "Submit" })).not.toBeInTheDocument();
  });

  it("TEST-09.8c shows a closed milestone with its stored work and no form", async () => {
    open("STUDENT", { page: { milestone: { ...milestone, window: "CLOSED", closedAt: "2026-11-25T00:00:00.000Z", closedBy: 2 }, submission: version(1) } });
    expect(await screen.findByText("Work v1")).toBeInTheDocument();
    expect(screen.getByText("This milestone is closed.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit" })).not.toBeInTheDocument();
  });

  it("TEST-09.8c reports a failed history load and retries it", async () => {
    let fail = true;
    const fetchMock = open("STUDENT", {
      page: { milestone, submission: version(2) },
      history: () => (fail ? Response.json({ error: { code: "INTERNAL", message: "x" } }, { status: 500 }) : Response.json({ milestone, submissions: [version(2), version(1)] })),
    });
    expect(await screen.findByText("Could not load earlier versions.")).toBeInTheDocument();
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Retry earlier versions" }));
    expect(await screen.findByText("Work v1")).toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([url, init]) => String(url).endsWith("/submissions") && (init?.method ?? "GET") === "GET").length).toBeGreaterThanOrEqual(2);
  });
});
