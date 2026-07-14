import { render, screen } from "@testing-library/react";
import { describe, test, expect, vi } from "vitest";
import ErrorBoundary from "../components/ErrorBoundary";

function Bomb() {
  throw new Error("boom");
}

describe("ErrorBoundary", () => {
  test("renders a fallback UI instead of crashing when a child throws", () => {
    // React logs the error to console — silence it for this expected-error test.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    spy.mockRestore();
  });

  test("renders children normally when there is no error", () => {
    render(
      <ErrorBoundary>
        <div>All good</div>
      </ErrorBoundary>
    );
    expect(screen.getByText("All good")).toBeInTheDocument();
  });
});
