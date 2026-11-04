import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/App";
import { TOKEN_KEY } from "../src/auth/token";

const student = { id: 1, name: "Somchai Student", email: "student@example.test", role: "STUDENT" };
const supervisor = { id: 2, name: "Dr. Supervisor", email: "supervisor@example.test", role: "SUPERVISOR" };

function jsonResponse(status: number, body: unknown) {
  return Promise.resolve(Response.json(body, { status }));
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

function fillLogin(email: string, password: string) {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: password } });
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
}

beforeEach(() => {
  sessionStorage.clear();
});

describe("role navigation (AC-01.7)", () => {
  it("TEST-01.7a shows Student navigation for a signed-in student", async () => {
    sessionStorage.setItem(TOKEN_KEY, "student-token");
    vi.stubGlobal("fetch", vi.fn(() => jsonResponse(200, { user: student })));

    renderAt("/");

    expect(await screen.findByText("Somchai Student")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "My team" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Milestones" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "My teams" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log out" })).toBeInTheDocument();
  });

  it("TEST-01.7a shows Supervisor navigation for a signed-in supervisor", async () => {
    sessionStorage.setItem(TOKEN_KEY, "supervisor-token");
    vi.stubGlobal("fetch", vi.fn(() => jsonResponse(200, { user: supervisor })));

    renderAt("/");

    expect(await screen.findByText("Dr. Supervisor")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "My teams" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Milestones" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "My team" })).not.toBeInTheDocument();
  });

  it("TEST-01.7a redirects to the login page when there is no session", async () => {
    vi.stubGlobal("fetch", vi.fn());

    renderAt("/milestones");

    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
  });
});

describe("Login form (AC-01.8, AC-01.9)", () => {
  it("TEST-01.8a shows field messages and sends no request for invalid input", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    renderAt("/login");

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Enter a valid email address.")).toBeInTheDocument();
    expect(screen.getByText("Enter your password.")).toBeInTheDocument();

    fillLogin("not-an-email", "something");
    expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument();
    expect(screen.queryByText("Enter your password.")).not.toBeInTheDocument();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("TEST-01.8b shows one generic message on 401", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        jsonResponse(401, { error: { code: "INVALID_CREDENTIALS", message: "Email or password is incorrect" } }),
      ),
    );
    renderAt("/login");

    fillLogin("student@example.test", "wrong-password");

    expect(await screen.findByRole("alert")).toHaveTextContent("Email or password is incorrect");
  });

  it.each([
    ["a 500 response", () => jsonResponse(500, { error: { code: "INTERNAL", message: "Internal server error" } })],
    ["a network error", () => Promise.reject(new TypeError("Failed to fetch"))],
  ])("TEST-01.9 shows a retryable error after %s, keeping the email", async (_label, respond) => {
    vi.stubGlobal("fetch", vi.fn(respond));
    renderAt("/login");

    fillLogin("student@example.test", "Corr3ct-horse");

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not sign in. Please try again.");
    expect(screen.getByLabelText("Email")).toHaveValue("student@example.test");
    expect(screen.getByLabelText("Password")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
  });

  it("TEST-01.1b stores the token and shows the role navigation after a successful login", async () => {
    vi.stubGlobal("fetch", vi.fn(() => jsonResponse(200, { token: "t".repeat(43), user: student })));
    renderAt("/login");

    fillLogin("student@example.test", "Corr3ct-horse");

    expect(await screen.findByRole("link", { name: "My team" })).toBeInTheDocument();
    expect(sessionStorage.getItem(TOKEN_KEY)).toBe("t".repeat(43));
  });
});
