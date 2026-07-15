import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import client from "../api/client";

export default function CompetitionLeaderboard() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    client
      .get(`/competitions/${slug}/leaderboard`)
      .then((res) => setData(res.data))
      .catch(() => setError("Failed to load leaderboard"))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <div className="page"><p className="hint">Loading...</p></div>;
  if (!data) return <div className="page"><p className="error">{error || "Not found"}</p></div>;

  return (
    <div className="page">
      <div className="page-header-row">
        <div>
          <h1>{data.competition.title} — Leaderboard</h1>
          <p className="section-subtitle">Ranked by total score across {data.totalProblems} problem{data.totalProblems === 1 ? "" : "s"}.</p>
        </div>
        <Link to={`/competitions/${slug}`} className="secondary-link">
          ← Back to Competition
        </Link>
      </div>

      {data.standings.length === 0 ? (
        <p className="empty-state">No submissions yet — this leaderboard will fill in as participants solve problems.</p>
      ) : (
        <table className="problem-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Participant</th>
              <th>Score</th>
              <th>Problems Solved</th>
            </tr>
          </thead>
          <tbody>
            {data.standings.map((s, i) => (
              <tr key={s.userId}>
                <td>{i + 1}</td>
                <td>{s.fullName}</td>
                <td><strong>{s.totalScore}</strong></td>
                <td>{s.problemsSolved} / {data.totalProblems}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
