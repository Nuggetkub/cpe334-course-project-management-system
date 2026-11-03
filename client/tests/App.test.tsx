import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { App } from "../src/App";

function stubFetch(response: Promise<Response>) {
  const fetchMock = vi.fn(() => response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("App", () => {
  it("shows the API as ok when /api/health answers ok", async () => {
    const fetchMock = stubFetch(Promise.resolve(Response.json({ status: "ok" })));

    render(<App />);

    expect(screen.getByRole("heading", { name: "Course Project Management System" })).toBeInTheDocument();
    expect(await screen.findByText("API: ok")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/api\/health$/));
  });

  it("shows the API as unreachable when the request fails", async () => {
    stubFetch(Promise.reject(new TypeError("Failed to fetch")));

    render(<App />);

    expect(await screen.findByText("API: unreachable")).toBeInTheDocument();
  });
});
