import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/App";
import { TOKEN_KEY } from "../src/auth/token";

// F-10 contract v0.2 §2 UI and AC-10.5 (TEST-10.5c): the Grade section on the milestone page.
const milestone = {
  id: 7, teamId: 1, title: "Prototype", description: "", dueAt: "2026-11-27T12:00:00.000Z",
  createdBy: 2, createdAt: "2026-11-20T00:00:00.000Z", lateUntil: null, closedAt: null, closedBy: null,
  window: "OPEN", teamStatus: "NOT_SUBMITTED",
};
type Handler = (init?: RequestInit) => Response | Promise<Response>;
type Routes = { grade: Handler; put?: Handler; release?: Handler };
const json = (body: unknown, status = 200) => Response.json(body, { status });

function open(role: "STUDENT" | "SUPERVISOR", routes: Routes) {
  sessionStorage.setItem(TOKEN_KEY, "token");
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    if (url.endsWith("/api/auth/me")) return Promise.resolve(json({ user: { id: 1, name: "Signed-in user", role } }));
    if (url.endsWith("/grade/release")) return Promise.resolve(routes.release!(init));
    if (url.endsWith("/grade") && init?.method === "PUT") return Promise.resolve(routes.put!(init));
    if (url.endsWith("/grade")) return Promise.resolve(routes.grade(init));
    return Promise.resolve(json({ milestone, submission: null }));
  });
  vi.stubGlobal("fetch", fetchMock);
  render(<MemoryRouter initialEntries={["/milestones/7"]}><App /></MemoryRouter>);
  return fetchMock;
}
const section = async () => within(await screen.findByRole("region", { name: "Grade" }));
const writes = (fetchMock: ReturnType<typeof open>, method: string) =>
  fetchMock.mock.calls.filter(([url, init]) => String(url).includes("/grade") && init?.method === method);

beforeEach(() => sessionStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("F-10 Grade section, Student", () => {
  it("TEST-10.5c shows loading, then Not released, with no form, action or draft text", async () => {
    let resolve!: (r: Response) => void;
    const pending = new Promise<Response>((done) => { resolve = done; });
    open("STUDENT", { grade: () => pending });
    const grade = await section();
    expect(await grade.findByRole("status")).toHaveTextContent("Loading grade…");
    resolve(json({ grade: { released: false } }));
    expect(await grade.findByText("Not released")).toBeInTheDocument();
    expect(grade.queryByRole("spinbutton")).not.toBeInTheDocument();
    expect(grade.queryByRole("button")).not.toBeInTheDocument();
    expect(grade.queryByText(/draft/i)).not.toBeInTheDocument();
  });

  it("TEST-10.5c shows a published score of 0", async () => {
    open("STUDENT", { grade: () => json({ grade: { released: true, score: 0 } }) });
    expect(await (await section()).findByText("0 / 100")).toBeInTheDocument();
  });

  it("TEST-10.5c shows a read error with Retry, and Retry recovers", async () => {
    let calls = 0;
    open("STUDENT", { grade: () => (calls++ === 0 ? json({}, 500) : json({ grade: { released: true, score: 88 } })) });
    const grade = await section();
    expect(await grade.findByRole("alert")).toHaveTextContent("Could not load the grade.");
    fireEvent.click(grade.getByRole("button", { name: "Retry" }));
    expect(await grade.findByText("88 / 100")).toBeInTheDocument();
  });
});

describe("F-10 Grade section, Supervisor", () => {
  it("TEST-10.5c validates the score beside the field without sending, then saves a draft from the API response", async () => {
    const fetchMock = open("SUPERVISOR", {
      grade: () => json({ grade: { draftScore: null, released: false } }),
      put: () => json({ grade: { draftScore: 70, released: false } }),
    });
    const grade = await section();
    expect(await grade.findByText("Not released yet")).toBeInTheDocument();
    const input = grade.getByLabelText("Score (0–100)");
    expect(grade.getByRole("button", { name: "Release grade" })).toBeDisabled(); // nothing saved yet

    fireEvent.change(input, { target: { value: "101" } });
    fireEvent.click(grade.getByRole("button", { name: "Save draft" }));
    expect(await grade.findByText("Enter a whole number from 0 to 100.")).toBeInTheDocument();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(writes(fetchMock, "PUT")).toHaveLength(0);

    fireEvent.change(input, { target: { value: "70" } });
    fireEvent.click(grade.getByRole("button", { name: "Save draft" }));
    expect(await grade.findByRole("status")).toHaveTextContent("Draft saved.");
    expect(JSON.parse(String(writes(fetchMock, "PUT")[0][1]?.body))).toEqual({ score: 70 });
    expect(grade.getByText("Saved draft: 70 / 100")).toBeInTheDocument();
    expect(grade.getByRole("button", { name: "Release grade" })).toBeEnabled();
  });

  it("TEST-10.5c shows a server field error, keeps the input on a failed save and disables writes while pending", async () => {
    let finish!: (r: Response) => void;
    let saves = 0;
    open("SUPERVISOR", {
      grade: () => json({ grade: { draftScore: 60, released: false } }),
      put: () => {
        saves++;
        if (saves === 1) return json({ error: { code: "VALIDATION_ERROR", message: "Check", fields: { score: "Score must be 0 to 100." } } }, 400);
        return new Promise<Response>((done) => { finish = done; });
      },
    });
    const grade = await section();
    const input = await grade.findByLabelText("Score (0–100)");
    expect(input).toHaveValue(60);

    fireEvent.change(input, { target: { value: "65" } });
    fireEvent.click(grade.getByRole("button", { name: "Save draft" }));
    expect(await grade.findByText("Score must be 0 to 100.")).toBeInTheDocument();

    fireEvent.click(grade.getByRole("button", { name: "Save draft" }));
    expect(await grade.findByRole("button", { name: "Saving draft…" })).toBeDisabled();
    expect(input).toBeDisabled();
    expect(grade.getByRole("button", { name: "Release grade" })).toBeDisabled();
    finish(json({}, 500));
    expect(await grade.findByRole("alert")).toHaveTextContent("Could not save the grade. Please try again.");
    expect(input).toHaveValue(65);
  });

  it("TEST-10.5c blocks release while the form has unsaved changes", async () => {
    open("SUPERVISOR", { grade: () => json({ grade: { draftScore: 70, released: false } }) });
    const grade = await section();
    const release = await grade.findByRole("button", { name: "Release grade" });
    expect(release).toBeEnabled();
    fireEvent.change(grade.getByLabelText("Score (0–100)"), { target: { value: "75" } });
    expect(release).toBeDisabled();
    expect(grade.getByText("Save the draft before releasing it.")).toBeInTheDocument();
    fireEvent.change(grade.getByLabelText("Score (0–100)"), { target: { value: "70" } });
    expect(release).toBeEnabled();
  });

  it("TEST-10.5c asks for confirmation with the saved score and renders the released response", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    const fetchMock = open("SUPERVISOR", {
      grade: () => json({ grade: { draftScore: 82, released: true, score: 70, releasedAt: "2026-11-25T03:00:00.000Z" } }),
      release: () => json({ grade: { draftScore: 82, released: true, score: 82, releasedAt: "2026-11-26T03:00:00.000Z" } }),
    });
    const grade = await section();
    expect(await grade.findByText("Published: 70 / 100")).toBeInTheDocument();
    expect(grade.getByText("Saved draft: 82 / 100 (not released yet)")).toBeInTheDocument();

    fireEvent.click(grade.getByRole("button", { name: "Release grade" }));
    expect(confirm).toHaveBeenLastCalledWith("Release 82 / 100 to the team? Students will see this score.");
    expect(writes(fetchMock, "POST")).toHaveLength(0); // cancelled

    fireEvent.click(grade.getByRole("button", { name: "Release grade" }));
    expect(await grade.findByRole("status")).toHaveTextContent("Grade released.");
    expect(writes(fetchMock, "POST")).toHaveLength(1);
    // F-10 v0.5: the request names the score the Supervisor confirmed.
    expect(JSON.parse(String(writes(fetchMock, "POST")[0][1]?.body))).toEqual({ expectedScore: 82 });
    await waitFor(() => expect(grade.getByText("Published: 82 / 100")).toBeInTheDocument());
    expect(grade.queryByText(/not released yet/)).not.toBeInTheDocument();
  });

  it("TEST-10.5c announces a failed release and keeps the saved draft", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    open("SUPERVISOR", {
      grade: () => json({ grade: { draftScore: 0, released: false } }),
      release: () => json({}, 500),
    });
    const grade = await section();
    fireEvent.click(await grade.findByRole("button", { name: "Release grade" }));
    expect(await grade.findByRole("alert")).toHaveTextContent("Could not release the grade. Please try again.");
    expect(grade.getByText("Saved draft: 0 / 100")).toBeInTheDocument();
    expect(grade.getByLabelText("Score (0–100)")).toHaveValue(0);
  });

  it("TEST-10.5c shows the newer draft after GRADE_DRAFT_CHANGED and needs a fresh confirmation", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    let reads = 0;
    const fetchMock = open("SUPERVISOR", {
      // Another Supervisor saves 82 after this page loaded draft 70.
      grade: () => json({ grade: reads++ === 0 ? { draftScore: 70, released: false } : { draftScore: 82, released: false } }),
      release: (init) => JSON.parse(String(init?.body)).expectedScore === 82
        ? json({ grade: { draftScore: 82, released: true, score: 82, releasedAt: "2026-11-26T03:00:00.000Z" } })
        : json({ error: { code: "GRADE_DRAFT_CHANGED", message: "The draft changed." } }, 409),
    });
    const grade = await section();
    fireEvent.click(await grade.findByRole("button", { name: "Release grade" }));
    expect(confirm).toHaveBeenLastCalledWith("Release 70 / 100 to the team? Students will see this score.");
    expect(await grade.findByRole("alert")).toHaveTextContent("The draft changed to 82 / 100 before it was released. Check it and release again.");
    expect(grade.getByText("Saved draft: 82 / 100")).toBeInTheDocument();
    expect(grade.getByLabelText("Score (0–100)")).toHaveValue(82);
    expect(grade.queryByText(/^Published/)).not.toBeInTheDocument();

    fireEvent.click(grade.getByRole("button", { name: "Release grade" }));
    expect(confirm).toHaveBeenLastCalledWith("Release 82 / 100 to the team? Students will see this score.");
    expect(await grade.findByRole("status")).toHaveTextContent("Grade released.");
    expect(writes(fetchMock, "POST").map(([, init]) => JSON.parse(String(init?.body)))).toEqual([{ expectedScore: 70 }, { expectedScore: 82 }]);
  });
});

describe("F-10 Grade section, malformed success responses", () => {
  it.each([
    ["STUDENT", { released: true }],
    ["STUDENT", { released: true, score: "70" }],
    ["SUPERVISOR", { draftScore: 70, released: true, score: 70 }],
    ["SUPERVISOR", { draftScore: 70, released: true, score: 70, releasedAt: "not a date" }],
    ["SUPERVISOR", { released: false }],
  ] as const)("TEST-10.5c treats a malformed read for a %s as an error with Retry (%j)", async (role, body) => {
    let calls = 0;
    open(role, { grade: () => (calls++ === 0 ? json({ grade: body }) : json({ grade: role === "STUDENT" ? { released: false } : { draftScore: null, released: false } })) });
    const grade = await section();
    expect(await grade.findByRole("alert")).toHaveTextContent("Could not load the grade.");
    expect(screen.getByRole("heading", { name: "Prototype" })).toBeInTheDocument(); // the page still renders
    fireEvent.click(grade.getByRole("button", { name: "Retry" }));
    expect(await grade.findByText(role === "STUDENT" ? "Not released" : "Not released yet")).toBeInTheDocument();
  });

  it("TEST-10.5c treats a malformed save response as a failed save and keeps the input", async () => {
    open("SUPERVISOR", {
      grade: () => json({ grade: { draftScore: 60, released: false } }),
      put: () => json({ grade: { draftScore: "65", released: false } }),
    });
    const grade = await section();
    fireEvent.change(await grade.findByLabelText("Score (0–100)"), { target: { value: "65" } });
    fireEvent.click(grade.getByRole("button", { name: "Save draft" }));
    expect(await grade.findByRole("alert")).toHaveTextContent("Could not save the grade. Please try again.");
    expect(grade.getByLabelText("Score (0–100)")).toHaveValue(65);
    expect(grade.getByText("Saved draft: 60 / 100")).toBeInTheDocument();
  });

  it("TEST-10.5c treats a malformed release response as a failed release", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    open("SUPERVISOR", {
      grade: () => json({ grade: { draftScore: 70, released: false } }),
      release: () => json({ grade: { draftScore: 70, released: true, score: 70 } }),
    });
    const grade = await section();
    fireEvent.click(await grade.findByRole("button", { name: "Release grade" }));
    expect(await grade.findByRole("alert")).toHaveTextContent("Could not release the grade. Please try again.");
    expect(grade.getByText("Not released yet")).toBeInTheDocument();
  });
});
