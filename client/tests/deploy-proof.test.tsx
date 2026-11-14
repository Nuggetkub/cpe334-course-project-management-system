import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/App";

const MARKER = "Lab 5 deployment demo — release 2";

beforeEach(() => sessionStorage.clear());

function showLogin() {
  render(<MemoryRouter initialEntries={["/login"]}><App /></MemoryRouter>);
}

describe("Issue #21 visible release proof", () => {
  it("TEST-C06.1 shows a labelled static release marker without changing sign-in controls or requesting data", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    showLogin();

    const region = await screen.findByRole("region", { name: "Release information" });
    expect(within(region).getByText(MARKER, { exact: true })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Sign in" })).toBeVisible();
    expect(screen.getByLabelText("Email")).toHaveValue("");
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("TEST-C06.2 leaves the marker behind after normal successful sign-in", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(Response.json({
      token: "t".repeat(43),
      user: { id: 1, name: "Demo Student", email: "student@example.test", role: "STUDENT" },
    }))));
    showLogin();
    expect(await screen.findByText(MARKER, { exact: true })).toBeVisible();

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "student@example.test" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "test-only-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("link", { name: "My team" })).toBeVisible();
    expect(screen.queryByRole("region", { name: "Release information" })).not.toBeInTheDocument();
  });
});
