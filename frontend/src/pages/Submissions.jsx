import { useEffect, useState } from "react";
import client from "../api/client";

const VERDICT_CLASS = {
  Accepted: "verdict-accepted",
  "Wrong Answer": "verdict-failed",
  "Compilation Error": "verdict-failed",
  "Runtime Error": "verdict-failed",
  "Time Limit Exceeded": "verdict-failed",
  Pending: "verdict-pending",
};

export default function Submissions() {
  const [mine, setMine] = useState([]);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([client.get("/submissions/mine"), client.get("/submissions/recent")])
      .then(([mineRes, recentRes]) => {
        setMine(mineRes.data.submissions);
        setRecent(recentRes.data.submissions);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page"><p className="hint">Loading...</p></div>;

  return (
    <div className="page">
      <section className="section">
        <h1>My Submissions</h1>
        <p className="section-subtitle">Your last 50 submissions across all problems.</p>
        <SubmissionTable submissions={mine} showUser={false} />
      </section>

      <section className="section">
        <h1>Recent Submissions</h1>
        <p className="section-subtitle">Latest activity from everyone on the platform.</p>
        <SubmissionTable submissions={recent} showUser={true} />
      </section>
    </div>
  );
}

function SubmissionTable({ submissions, showUser }) {
  if (submissions.length === 0) return <p className="empty-state">No submissions yet.</p>;

  return (
    <table className="problem-table">
      <thead>
        <tr>
          {showUser && <th>User</th>}
          <th>Problem</th>
          <th>Language</th>
          <th>Verdict</th>
          <th>Passed</th>
          <th>Submitted At</th>
        </tr>
      </thead>
      <tbody>
        {submissions.map((s) => (
          <tr key={s._id}>
            {showUser && <td>{s.user?.fullName || "—"}</td>}
            <td>{s.problem?.title || "—"}</td>
            <td>{s.language}</td>
            <td>
              <span className={`badge ${VERDICT_CLASS[s.verdict] || ""}`}>{s.verdict}</span>
            </td>
            <td>
              {s.passedCount}/{s.totalCount}
            </td>
            <td>{new Date(s.createdAt).toLocaleString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
