import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import client from "../api/client";

export default function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setSubmitting(true);
    try {
      await client.post("/auth/reset-password", { token, newPassword });
      navigate("/login");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to reset password");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <form onSubmit={handleSubmit} className="auth-form">
        <h2>Reset Password</h2>
        {error && <p className="error">{error}</p>}
        <input
          type="password"
          placeholder="New password (min 6 characters)"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          minLength={6}
        />
        <input
          type="password"
          placeholder="Confirm new password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          minLength={6}
        />
        <button type="submit" disabled={submitting}>
          {submitting ? "Resetting..." : "Reset Password"}
        </button>
        <p>
          <Link to="/login">Back to Login</Link>
        </p>
      </form>
    </div>
  );
}
