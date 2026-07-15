import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import client from "../api/client";

const DIFFICULTY_CLASS = {
  Easy: "diff-easy",
  Medium: "diff-medium",
  Hard: "diff-hard",
};

export default function ProblemList() {
  const [problems, setProblems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    client
      .get("/problems")
      .then((res) => setProblems(res.data.problems))
      .catch(() => setError("Failed to load problems"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page"><p className="hint">Loading problems...</p></div>;
  if (error) return <div className="page"><p className="error">{error}</p></div>;

  return (
    <div className="page">
      <h1>Problems</h1>
      <p className="section-subtitle">Practice anytime — problems in a live competition are scored and ranked there instead.</p>
      <table className="problem-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Difficulty</th>
            <th>Competition</th>
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
              <td>
                {p.competition ? (
                  <Link to={`/competitions/${p.competition.slug}`} className="badge">
                    {p.competition.title}
                  </Link>
                ) : (
                  <span className="hint">Practice</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {problems.length === 0 && <p>No problems yet.</p>}
    </div>
  );
}
