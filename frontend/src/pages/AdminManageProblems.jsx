import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import client from "../api/client";

const DIFFICULTY_CLASS = {
  Easy: "diff-easy",
  Medium: "diff-medium",
  Hard: "diff-hard",
};

export default function AdminManageProblems() {
  const [problems, setProblems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingSlug, setDeletingSlug] = useState(null);

  useEffect(() => {
    loadProblems();
  }, []);

  function loadProblems() {
    setLoading(true);
    client
      .get("/problems")
      .then((res) => setProblems(res.data.problems))
      .catch(() => setError("Failed to load problems"))
      .finally(() => setLoading(false));
  }

  async function handleDelete(slug, title) {
    if (!window.confirm(`Delete "${title}"? This also deletes all its test cases. This cannot be undone.`)) {
      return;
    }
    setDeletingSlug(slug);
    try {
      await client.delete(`/problems/${slug}`);
      setProblems((prev) => prev.filter((p) => p.slug !== slug));
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete problem");
    } finally {
      setDeletingSlug(null);
    }
  }

  if (loading) return <div className="page"><p className="hint">Loading...</p></div>;

  return (
    <div className="page">
      <div className="page-header-row">
        <div>
          <h1>Manage Problems</h1>
          <p className="section-subtitle">Edit or remove existing problems and their test cases.</p>
        </div>
        <Link to="/admin/new-problem" className="secondary-link">
          + New Problem
        </Link>
      </div>

      {error && <p className="error">{error}</p>}

      {problems.length === 0 ? (
        <p className="empty-state">No problems yet.</p>
      ) : (
        <table className="problem-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Difficulty</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {problems.map((p) => (
              <tr key={p._id}>
                <td>
                  <Link to={`/problems/${p.slug}`}>{p.title}</Link>
                </td>
                <td>
                  <span className={`badge ${DIFFICULTY_CLASS[p.difficulty] || ""}`}>{p.difficulty}</span>
                </td>
                <td className="row-actions">
                  <Link to={`/admin/problems/${p.slug}/edit`} className="secondary-link">
                    Edit
                  </Link>
                  <button
                    className="danger-outline"
                    disabled={deletingSlug === p.slug}
                    onClick={() => handleDelete(p.slug, p.title)}
                  >
                    {deletingSlug === p.slug ? "Deleting..." : "Delete"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
