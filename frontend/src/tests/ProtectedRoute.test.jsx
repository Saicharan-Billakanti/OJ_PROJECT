import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { describe, test, expect, vi, beforeEach } from "vitest";
import ProtectedRoute from "../components/ProtectedRoute";
import { AuthProvider } from "../context/AuthContext";
import client from "../api/client";

vi.mock("../api/client", () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

function renderWithRoute(initialEntries = ["/secret"]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<div>Login Page</div>} />
          <Route
            path="/secret"
            element={
              <ProtectedRoute>
                <div>Secret Content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe("ProtectedRoute", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  test("redirects to /login when there is no logged-in user", async () => {
    renderWithRoute();
    expect(await screen.findByText("Login Page")).toBeInTheDocument();
    expect(screen.queryByText("Secret Content")).not.toBeInTheDocument();
  });

  test("renders the protected content once authenticated", async () => {
    localStorage.setItem("oj_token", "valid-token");
    client.get.mockResolvedValueOnce({
      data: { user: { id: "1", fullName: "Test", email: "a@b.com", role: "user" } },
    });

    renderWithRoute();
    expect(await screen.findByText("Secret Content")).toBeInTheDocument();
  });
});
