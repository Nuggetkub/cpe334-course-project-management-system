import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/App";
import { TOKEN_KEY } from "../src/auth/token";

const milestone = {
  id: 7, teamId: 1, title: "Prototype", description: "", dueAt: "2026-11-08T16:59:59.000Z",
  createdBy: 2, createdAt: "2026-11-01T00:00:00.000Z", window: "CLOSED", teamStatus: "SUBMITTED",
};
const submission = {
  id: 3, milestoneId: 7, version: 1, title: "Week 1 prototype", description: "", link: "https://a.b/work",
  submittedAt: "2026-11-08T10:00:00.000Z", submittedBy: { id: 1, name: "Somchai Student" },
};
const entry = (id: number, text: string, createdAt: string) =>
  ({ id, submissionId: 3, version: 1, text, createdAt, author: { id: 2, name: "Dr. Supervisor" } });
const MESSAGE = "Enter feedback (1–2000 characters).";

type Handler = (init?: RequestInit) => Response | Promise<Response>;

function open(role: "STUDENT" | "SUPERVISOR", feedback: Handler, post: Handler = () => Response.json({}, { status: 500 })) {
  sessionStorage.setItem(TOKEN_KEY, "token");
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    if (url.endsWith("/api/auth/me")) return Promise.resolve(Response.json({ user: { id: 2, name: "Dr. Supervisor", role } }));
    if (url.endsWith("/api/milestones/7/submission")) return Promise.resolve(Response.json({ milestone, submission }));
    if (url.endsWith("/api/submissions/3/feedback")) return Promise.resolve(init?.method === "POST" ? post(init) : feedback(init));
    return Promise.resolve(Response.json({ error: { code: "NOT_FOUND" } }, { status: 404 }));
  });
  vi.stubGlobal("fetch", fetchMock);
  render(<MemoryRouter initialEntries={["/milestones/7"]}><App /></MemoryRouter>);
  return fetchMock;
}
const posts = (fetchMock: ReturnType<typeof open>) => fetchMock.mock.calls.filter(([, init]) => init?.method === "POST");
const box = () => screen.getByLabelText("Feedback");
const add = () => fireEvent.click(screen.getByRole("button", { name: "Add feedback" }));

beforeEach(() => sessionStorage.clear());

describe("F-06 feedback on the milestone page", () => {
  it("TEST-06.5a shows loading, then the empty state, to a student without a form", async () => {
    // Created before rendering, so resolving never depends on when the request is sent.
    let respond!: (r: Response) => void;
    const pending = new Promise<Response>((resolve) => { respond = resolve; });
    open("STUDENT", () => pending);
    expect(await screen.findByText("Loading feedback…")).toBeInTheDocument();
    respond(Response.json({ feedback: [] }));
    expect(await screen.findByText("No feedback yet")).toBeInTheDocument();
    expect(screen.queryByLabelText("Feedback")).not.toBeInTheDocument();
  });

  it("TEST-06.5a lists entries oldest first with author, Bangkok time and version", async () => {
    open("STUDENT", () => Response.json({ feedback: [
      entry(1, "First note", "2026-11-09T03:00:00.000Z"), entry(2, "Second note", "2026-11-09T04:30:00.000Z"),
    ] }));
    expect(await screen.findByText("First note")).toBeInTheDocument();
    const texts = screen.getAllByText(/ note$/).map((el) => el.textContent);
    expect(texts).toEqual(["First note", "Second note"]);
    expect(screen.getByText("Dr. Supervisor on 9 Nov 2026, 10:00 (ICT) · version 1")).toBeInTheDocument();
    expect(screen.getByText("Dr. Supervisor on 9 Nov 2026, 11:30 (ICT) · version 1")).toBeInTheDocument();
  });

  it("TEST-06.2c checks the text before sending, then shows the server's field message", async () => {
    const fetchMock = open("SUPERVISOR", () => Response.json({ feedback: [] }),
      () => Response.json({ error: { code: "VALIDATION_ERROR", message: "Check the highlighted fields", fields: { text: MESSAGE } } }, { status: 400 }));
    await screen.findByText("No feedback yet");
    add();
    expect(await screen.findByText(MESSAGE)).toBeInTheDocument();
    fireEvent.change(box(), { target: { value: "x".repeat(2001) } });
    add();
    expect(await screen.findByText(MESSAGE)).toBeInTheDocument();
    expect(posts(fetchMock)).toHaveLength(0);

    fireEvent.change(box(), { target: { value: "Looks good" } });
    add();
    const message = await screen.findByText(MESSAGE);
    expect(posts(fetchMock)).toHaveLength(1);
    expect(box()).toHaveAttribute("aria-describedby", message.id);
  });

  it("TEST-06.5b keeps the text after 5xx and network errors, then adds the entry on retry", async () => {
    const outcomes: Array<() => Response | Promise<Response>> = [
      () => Response.json({ error: { code: "INTERNAL", message: "Internal server error" } }, { status: 500 }),
      () => Promise.reject(new TypeError("Failed to fetch")),
      () => Response.json({ feedback: entry(5, "Add tests for login", "2026-11-09T03:00:00.000Z") }, { status: 201 }),
    ];
    open("SUPERVISOR", () => Response.json({ feedback: [] }), () => outcomes.shift()!());
    await screen.findByText("No feedback yet");
    fireEvent.change(box(), { target: { value: "Add tests for login" } });
    for (let i = 0; i < 2; i += 1) {
      add();
      expect(await screen.findByRole("alert")).toHaveTextContent("Could not save feedback. Please try again.");
      expect(box()).toHaveValue("Add tests for login");
      expect(screen.getByRole("button", { name: "Add feedback" })).toBeEnabled();
    }
    add();
    expect(await screen.findByText("Add tests for login", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByText("Feedback added.")).toBeInTheDocument();
    expect(box()).toHaveValue("");
    expect(screen.queryByText("No feedback yet")).not.toBeInTheDocument();
  });

  it("TEST-06.5c shows a load error with Retry, then the empty state", async () => {
    const outcomes = [() => Response.json({ error: { code: "INTERNAL" } }, { status: 500 }), () => Response.json({ feedback: [] })];
    open("STUDENT", () => outcomes.shift()!());
    expect(await screen.findByText("Could not load feedback.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("No feedback yet")).toBeInTheDocument();
  });
});
