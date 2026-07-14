import { useEffect, useState } from "react";
import client from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function Profile() {
  const { user, updateUser } = useAuth();
  const [fullName, setFullName] = useState(user?.fullName || "");
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    client
      .get("/submissions/stats")
      .then((res) => setStats(res.data))
      .catch(() => setError("Failed to load stats"))
      .finally(() => setStatsLoading(false));
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    setError("");
    setSaved(false);
    setSaving(true);
    try {
      const res = await client.put("/auth/me", { fullName });
      updateUser(res.data.user);
      setSaved(true);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <h1>Profile</h1>
      <p className="section-subtitle">Your account details and activity on the platform.</p>

      <section className="section" style={{ marginTop: 24 }}>
        <div className="admin-form" style={{ maxWidth: 480 }}>
          {error && <p className="error">{error}</p>}
          {saved && <p className="hint" style={{ color: "var(--success)" }}>Saved.</p>}

          <label>
            Full Name
            <form onSubmit={handleSave} style={{ display: "flex", gap: 10 }}>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              <button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </button>
            </form>
          </label>

          <label>
            Email
            <input value={user?.email || ""} disabled />
          </label>

          <label>
            Role
            <input value={user?.role || ""} disabled style={{ textTransform: "capitalize" }} />
          </label>
        </div>
      </section>

      <section className="section">
        <h2>Your Stats</h2>
        {statsLoading ? (
          <p className="hint">Loading stats...</p>
        ) : (
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">{stats.totalSubmissions}</div>
              <div className="stat-label">Total Submissions</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.acceptedSubmissions}</div>
              <div className="stat-label">Accepted</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.problemsSolved}</div>
              <div className="stat-label">Problems Solved</div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
