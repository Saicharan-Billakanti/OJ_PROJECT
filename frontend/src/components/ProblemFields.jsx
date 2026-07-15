import { useEffect, useState } from "react";
import client from "../api/client";

export default function ProblemFields({
  title,
  setTitle,
  statement,
  setStatement,
  difficulty,
  setDifficulty,
  competition,
  setCompetition,
  points,
  setPoints,
}) {
  const [competitions, setCompetitions] = useState([]);

  useEffect(() => {
    client
      .get("/competitions")
      .then((res) => setCompetitions(res.data.competitions))
      .catch(() => {});
  }, []);

  return (
    <>
      <label>
        Title
        <input value={title} onChange={(e) => setTitle(e.target.value)} required />
      </label>
      <label>
        Difficulty
        <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
          <option>Easy</option>
          <option>Medium</option>
          <option>Hard</option>
        </select>
      </label>
      <label>
        Statement
        <textarea value={statement} onChange={(e) => setStatement(e.target.value)} rows={6} required />
      </label>
      <label>
        Competition <span className="hint">(leave as Practice if this problem shouldn't be scored/ranked)</span>
        <select value={competition} onChange={(e) => setCompetition(e.target.value)}>
          <option value="">Practice (no competition)</option>
          {competitions.map((c) => (
            <option key={c._id} value={c.slug}>
              {c.title} ({c.status})
            </option>
          ))}
        </select>
      </label>
      {competition && (
        <label>
          Points <span className="hint">(awarded on an Accepted submission)</span>
          <input
            type="number"
            min={1}
            value={points}
            onChange={(e) => setPoints(Number(e.target.value))}
          />
        </label>
      )}
    </>
  );
}
