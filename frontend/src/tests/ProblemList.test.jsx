import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, test, expect, vi, beforeEach } from "vitest";
import ProblemList from "../pages/ProblemList";
import client from "../api/client";

vi.mock("../api/client", () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

describe("ProblemList page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renders fetched problems with their difficulty badges", async () => {
    client.get.mockResolvedValueOnce({
      data: {
        problems: [
          { _id: "1", title: "Sum of Two Numbers", slug: "sum-of-two-numbers", difficulty: "Easy", competition: null },
          { _id: "2", title: "Check Prime", slug: "check-prime", difficulty: "Medium", competition: null },
        ],
      },
    });

    render(
      <MemoryRouter>
        <ProblemList />
      </MemoryRouter>
    );

    expect(await screen.findByText("Sum of Two Numbers")).toBeInTheDocument();
    expect(screen.getByText("Check Prime")).toBeInTheDocument();
    expect(screen.getByText("Easy")).toBeInTheDocument();
    expect(screen.getByText("Medium")).toBeInTheDocument();
  });

  test("shows 'Practice' for problems with no competition, and links to the competition otherwise", async () => {
    client.get.mockResolvedValueOnce({
      data: {
        problems: [
          { _id: "1", title: "Free Problem", slug: "free-problem", difficulty: "Easy", competition: null },
          {
            _id: "2",
            title: "Contest Problem",
            slug: "contest-problem",
            difficulty: "Hard",
            competition: { title: "Spring Cup", slug: "spring-cup" },
          },
        ],
      },
    });

    render(
      <MemoryRouter>
        <ProblemList />
      </MemoryRouter>
    );

    expect(await screen.findByText("Practice")).toBeInTheDocument();
    expect(screen.getByText("Spring Cup")).toBeInTheDocument();
  });

  test("shows an empty state when there are no problems", async () => {
    client.get.mockResolvedValueOnce({ data: { problems: [] } });

    render(
      <MemoryRouter>
        <ProblemList />
      </MemoryRouter>
    );

    expect(await screen.findByText("No problems yet.")).toBeInTheDocument();
  });

  test("shows an error message when the fetch fails", async () => {
    client.get.mockRejectedValueOnce(new Error("network error"));

    render(
      <MemoryRouter>
        <ProblemList />
      </MemoryRouter>
    );

    expect(await screen.findByText("Failed to load problems")).toBeInTheDocument();
  });
});
