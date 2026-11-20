import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ErrorBoundary from "../ErrorBoundary.jsx";

let shouldThrow = true;
function Bomb() {
  if (shouldThrow) throw new Error("boom");
  return <p>All good</p>;
}

describe("ErrorBoundary", () => {
  it("shows a friendly fallback instead of crashing, then recovers on 'Try again'", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    shouldThrow = true;
    render(<ErrorBoundary><Bomb /></ErrorBoundary>);
    expect(screen.getByRole("alert")).toHaveTextContent(/something went wrong/i);

    shouldThrow = false;
    await userEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(screen.getByText("All good")).toBeInTheDocument();
    vi.restoreAllMocks();
  });

  it("clears the error automatically when resetKeys change", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    shouldThrow = true;
    const { rerender } = render(<ErrorBoundary resetKeys={["a"]}><Bomb /></ErrorBoundary>);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    shouldThrow = false;
    rerender(<ErrorBoundary resetKeys={["b"]}><Bomb /></ErrorBoundary>);
    expect(screen.getByText("All good")).toBeInTheDocument();
    vi.restoreAllMocks();
  });
});
