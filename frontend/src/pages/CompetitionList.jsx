import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import client from "../api/client";
import { useAuth } from "../context/AuthContext";

const STATUS_CLASS = {
  live: "diff-easy",
  upcoming: "diff-medium",
  ended: "",
};

export default function CompetitionList() {
  const { user } = useAuth();
  const [competitions, setCompetitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    client
      .get("/competitions")
      .then((res) => setCompetitions(res.data.competitions))
      .catch(() => setError("Failed to load competitions"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page"><p className="hint">Loading...</p></div>;

  return (
    <div className="page">
      <div className="page-header-row">
        <div>
          <h1>Competitions</h1>
          <p className="section-subtitle">Scored, ranked contests. Problems outside a competition are always free practice.</p>
        </div>
        {user?.role === "admin" && (
          <Link to="/admin/competitions/new" className="secondary-link">
            + New Competition
          </Link>
        )}
      </div>

      {error && <p className="error">{error}</p>}

      {competitions.length === 0 ? (
        <p className="empty-state">No competitions yet — every problem is currently a practice problem.</p>
      ) : (
        <table className="problem-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Status</th>
              <th>Starts</th>
              <th>Ends</th>
            </tr>
          </thead>
          <tbody>
            {competitions.map((c) => (
              <tr key={c._id}>
                <td>
                  <Link to={`/competitions/${c.slug}`}>{c.title}</Link>
                </td>
                <td>
                  <span className={`badge ${STATUS_CLASS[c.status]}`}>{c.status}</span>
                </td>
                <td>{new Date(c.startTime).toLocaleString()}</td>
                <td>{new Date(c.endTime).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
