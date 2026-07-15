import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import client from "../api/client";

const STATUS_CLASS = { live: "diff-easy", upcoming: "diff-medium", ended: "" };
const DIFFICULTY_CLASS = { Easy: "diff-easy", Medium: "diff-medium", Hard: "diff-hard" };

export default function CompetitionDetail() {
  const { slug } = useParams();
  const [competition, setCompetition] = useState(null);
  const [problems, setProblems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    client
      .get(`/competitions/${slug}`)
      .then((res) => {
        setCompetition(res.data.competition);
        setProblems(res.data.problems);
      })
      .catch(() => setError("Failed to load competition"))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <div className="page"><p className="hint">Loading...</p></div>;
  if (!competition) return <div className="page"><p className="error">{error || "Competition not found"}</p></div>;

  return (
    <div className="page">
      <div className="page-header-row">
        <div>
          <h1>{competition.title}</h1>
          <p className="section-subtitle">
            <span className={`badge ${STATUS_CLASS[competition.status]}`}>{competition.status}</span>
            {"  "}
            {new Date(competition.startTime).toLocaleString()} → {new Date(competition.endTime).toLocaleString()}
          </p>
        </div>
        <Link to={`/competitions/${slug}/leaderboard`} className="secondary-link">
          View Leaderboard →
        </Link>
      </div>

      {competition.description && <p style={{ margin: "16px 0" }}>{competition.description}</p>}

      <h3 style={{ marginTop: 28 }}>Problems ({problems.length})</h3>
      {problems.length === 0 ? (
        <p className="empty-state">No problems added to this competition yet.</p>
      ) : (
        <table className="problem-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Difficulty</th>
              <th>Points</th>
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
                <td>{p.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
