import { useState } from "react";
import { useNavigate } from "react-router-dom";
import client from "../api/client";

const EMPTY_TEST_CASE = { input: "", output: "", isSample: false };

export default function AdminCreateProblem() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [statement, setStatement] = useState("");
  const [difficulty, setDifficulty] = useState("Easy");
  const [testCases, setTestCases] = useState([{ ...EMPTY_TEST_CASE, isSample: true }]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function updateTestCase(index, field, value) {
    setTestCases((prev) => prev.map((tc, i) => (i === index ? { ...tc, [field]: value } : tc)));
  }

  function addTestCase() {
    setTestCases((prev) => [...prev, { ...EMPTY_TEST_CASE }]);
  }

  function removeTestCase(index) {
    setTestCases((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await client.post("/problems", { title, statement, difficulty, testCases });
      navigate(`/problems/${res.data.problem.slug}`);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create problem");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page">
      <h1>Create Problem (Admin)</h1>
      <form onSubmit={handleSubmit} className="admin-form">
        {error && <p className="error">{error}</p>}
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
          <textarea
            value={statement}
            onChange={(e) => setStatement(e.target.value)}
            rows={6}
            required
          />
        </label>

        <h3>Test Cases</h3>
        {testCases.map((tc, i) => (
          <div key={i} className="testcase-row">
            <textarea
              placeholder="Input"
              value={tc.input}
              onChange={(e) => updateTestCase(i, "input", e.target.value)}
              rows={2}
              required
            />
            <textarea
              placeholder="Expected Output"
              value={tc.output}
              onChange={(e) => updateTestCase(i, "output", e.target.value)}
              rows={2}
              required
            />
            <label className="sample-checkbox">
              <input
                type="checkbox"
                checked={tc.isSample}
                onChange={(e) => updateTestCase(i, "isSample", e.target.checked)}
              />
              Sample (visible to users)
            </label>
            {testCases.length > 1 && (
              <button type="button" onClick={() => removeTestCase(i)}>
                Remove
              </button>
            )}
          </div>
        ))}
        <button type="button" onClick={addTestCase}>
          + Add Test Case
        </button>

        <button type="submit" disabled={submitting} className="primary">
          {submitting ? "Creating..." : "Create Problem"}
        </button>
      </form>
    </div>
  );
}
