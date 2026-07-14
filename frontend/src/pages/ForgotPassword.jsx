import { useState } from "react";
import { Link } from "react-router-dom";
import client from "../api/client";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [devResetUrl, setDevResetUrl] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    setDevResetUrl("");
    setSubmitting(true);
    try {
      const res = await client.post("/auth/forgot-password", { email });
      setMessage(res.data.message);
      if (res.data.devResetUrl) setDevResetUrl(res.data.devResetUrl);
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <form onSubmit={handleSubmit} className="auth-form">
        <h2>Forgot Password</h2>
        {error && <p className="error">{error}</p>}
        {message && <p className="hint" style={{ color: "var(--success)" }}>{message}</p>}

        {devResetUrl && (
          <p className="hint">
            No email service is configured in this dev environment, so here's your reset link directly:
            <br />
            <Link to={devResetUrl.replace(/^https?:\/\/[^/]+/, "")}>{devResetUrl}</Link>
          </p>
        )}

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <button type="submit" disabled={submitting}>
          {submitting ? "Sending..." : "Send Reset Link"}
        </button>
        <p>
          Remembered your password? <Link to="/login">Login</Link>
        </p>
      </form>
    </div>
  );
}
