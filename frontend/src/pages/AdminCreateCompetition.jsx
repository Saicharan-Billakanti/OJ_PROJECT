import { useState } from "react";
import { useNavigate } from "react-router-dom";
import client from "../api/client";

function toLocalInputValue(date) {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AdminCreateCompetition() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startTime, setStartTime] = useState(toLocalInputValue(Date.now() + 60 * 60 * 1000));
  const [endTime, setEndTime] = useState(toLocalInputValue(Date.now() + 3 * 60 * 60 * 1000));
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await client.post("/competitions", {
        title,
        description,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
      });
      navigate(`/competitions/${res.data.competition.slug}`);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create competition");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page">
      <h1>Create Competition</h1>
      <p className="section-subtitle">Once created, assign problems to it (with a points value) from the problem create/edit form.</p>

      <form onSubmit={handleSubmit} className="admin-form">
        {error && <p className="error">{error}</p>}

        <label className="field-label">
          Title
          <input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </label>

        <label className="field-label">
          Description <span className="hint">(optional)</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </label>

        <label className="field-label">
          Start time
          <input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
        </label>

        <label className="field-label">
          End time
          <input type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
        </label>

        <button type="submit" disabled={submitting} className="primary">
          {submitting ? "Creating..." : "Create Competition"}
        </button>
      </form>
    </div>
  );
}
