import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/App";
import { TOKEN_KEY } from "../src/auth/token";

const milestone = {
  id: 7, teamId: 1, title: "Prototype", description: "Build it", dueAt: "2026-11-08T16:59:59.000Z",
  createdBy: 2, createdAt: "2026-11-01T00:00:00.000Z", window: "OPEN", teamStatus: "NOT_SUBMITTED",
};
const submission = {
  id: 3, milestoneId: 7, version: 1, title: "Week 1 prototype", description: "Login and team view",
  link: "https://github.com/org/repo", submittedAt: "2026-11-08T16:59:59.000Z",
  submittedBy: { id: 1, name: "Somchai Student" },
};
const page = (overrides: object = {}, sub: object | null = null) => Response.json({ milestone: { ...milestone, ...overrides }, submission: sub });

type Handler = (url: string, init?: RequestInit) => Response | Promise<Response>;

function open(role: "STUDENT" | "SUPERVISOR", get: Handler, post: Handler = () => Response.json({}, { status: 500 })) {
  sessionStorage.setItem(TOKEN_KEY, "token");
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    if (url.endsWith("/api/auth/me")) return Promise.resolve(Response.json({ user: { id: 1, name: "Somchai Student", role } }));
    return Promise.resolve(init?.method === "POST" ? post(url, init) : get(url, init));
  });
  vi.stubGlobal("fetch", fetchMock);
  render(<MemoryRouter initialEntries={["/milestones/7"]}><App /></MemoryRouter>);
  return fetchMock;
}
const posts = (fetchMock: ReturnType<typeof open>) => fetchMock.mock.calls.filter(([, init]) => init?.method === "POST");

async function fill(title: string, link: string, description = "") {
  fireEvent.change(await screen.findByLabelText("Title"), { target: { value: title } });
  fireEvent.change(screen.getByLabelText("Description (optional)"), { target: { value: description } });
  fireEvent.change(screen.getByLabelText("Link"), { target: { value: link } });
}
const submit = () => fireEvent.click(screen.getByRole("button", { name: "Submit" }));

beforeEach(() => sessionStorage.clear());

describe("F-05 milestone page", () => {
  it("TEST-05.7 shows loading, then the empty state with the form, from the submission endpoint", async () => {
    let respond!: (r: Response) => void;
    const fetchMock = open("STUDENT", () => new Promise<Response>((resolve) => { respond = resolve; }));
    expect(await screen.findByText("Loading submission…")).toBeInTheDocument();
    respond(page());
    expect(await screen.findByText("Not submitted yet")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Prototype" })).toBeInTheDocument();
    expect(screen.getByText("Team status: Not submitted")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit" })).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => /\/api\/milestones\/7\/submission$/.test(url))).toBe(true);
  });

  it("TEST-05.7 shows a persisted submission read-only with a safe link and Bangkok time", async () => {
    open("STUDENT", () => page({ teamStatus: "SUBMITTED" }, submission));
    const link = await screen.findByRole("link", { name: "https://github.com/org/repo" });
    expect(link).toHaveAttribute("href", "https://github.com/org/repo");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByText("Week 1 prototype")).toBeInTheDocument();
    expect(screen.getByText("Submitted by Somchai Student on 8 Nov 2026, 23:59 (ICT)")).toBeInTheDocument();
    expect(screen.getByText("Team status: Submitted")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit" })).not.toBeInTheDocument();
  });

  it("TEST-05.7 shows no form after the deadline or to a supervisor", async () => {
    open("STUDENT", () => page({ window: "CLOSED", teamStatus: "OVERDUE" }));
    expect(await screen.findByText("The deadline has passed.")).toBeInTheDocument();
    expect(screen.getByText("Not submitted yet")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit" })).not.toBeInTheDocument();
  });

  it("TEST-05.7 keeps the page read-only for a supervisor while the window is open", async () => {
    open("SUPERVISOR", () => page());
    expect(await screen.findByText("Not submitted yet")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit" })).not.toBeInTheDocument();
  });

  it("TEST-05.2c shows field messages and sends no request for invalid input", async () => {
    const fetchMock = open("STUDENT", () => page());
    await screen.findByText("Not submitted yet");
    submit();
    expect(await screen.findByText("Enter a title (1–120 characters).")).toBeInTheDocument();
    expect(screen.getByText("Enter a full link starting with http:// or https://.")).toBeInTheDocument();
    await fill("Week 1", "example.com");
    submit();
    expect(await screen.findByText("Enter a full link starting with http:// or https://.")).toBeInTheDocument();
    expect(screen.queryByText("Enter a title (1–120 characters).")).not.toBeInTheDocument();
    expect(posts(fetchMock)).toHaveLength(0);
  });

  it("TEST-05.2d shows the server's field message under the matching input", async () => {
    open("STUDENT", () => page(), () => Response.json({ error: {
      code: "VALIDATION_ERROR", message: "Check the highlighted fields", fields: { link: "Enter a full link starting with http:// or https://." },
    } }, { status: 400 }));
    await fill("Week 1", "https://a.b");
    submit();
    const message = await screen.findByText("Enter a full link starting with http:// or https://.");
    expect(screen.getByLabelText("Link")).toHaveAttribute("aria-describedby", message.id);
  });

  it("TEST-05.6 keeps the values after 409, 5xx and network errors, then succeeds on retry", async () => {
    const outcomes: Array<() => Response | Promise<Response>> = [
      () => Response.json({ error: { code: "DEADLINE_PASSED", message: "The deadline for this milestone has passed." } }, { status: 409 }),
      () => Response.json({ error: { code: "INTERNAL", message: "Internal server error" } }, { status: 500 }),
      () => Promise.reject(new TypeError("Failed to fetch")),
      () => Response.json({ submission }, { status: 201 }),
    ];
    open("STUDENT", () => page(), () => outcomes.shift()!());
    await fill("Week 1 prototype", "https://github.com/org/repo", "Login and team view");

    for (const banner of ["The deadline for this milestone has passed.", "Could not submit. Please try again.", "Could not submit. Please try again."]) {
      submit();
      expect(await screen.findByRole("alert")).toHaveTextContent(banner);
      expect(screen.getByLabelText("Title")).toHaveValue("Week 1 prototype");
      expect(screen.getByLabelText("Description (optional)")).toHaveValue("Login and team view");
      expect(screen.getByLabelText("Link")).toHaveValue("https://github.com/org/repo");
      expect(screen.getByRole("button", { name: "Submit" })).toBeEnabled();
    }

    submit();
    expect(await screen.findByText("Submitted by Somchai Student on 8 Nov 2026, 23:59 (ICT)")).toBeInTheDocument();
    expect(screen.getByText("Team status: Submitted")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit" })).not.toBeInTheDocument();
  });
});
