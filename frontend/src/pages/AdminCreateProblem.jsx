import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import client from "../api/client";
import ProblemFields from "../components/ProblemFields";

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
      <div className="page-header-row">
        <div>
          <h1>Create Problem</h1>
          <p className="section-subtitle">Add a new problem with its statement and test cases.</p>
        </div>
        <Link to="/admin/problems" className="secondary-link">
          Manage existing problems →
        </Link>
      </div>
      <form onSubmit={handleSubmit} className="admin-form">
        {error && <p className="error">{error}</p>}
        <ProblemFields
          title={title}
          setTitle={setTitle}
          statement={statement}
          setStatement={setStatement}
          difficulty={difficulty}
          setDifficulty={setDifficulty}
        />

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
              <button type="button" className="danger-outline" onClick={() => removeTestCase(i)}>
                Remove
              </button>
            )}
          </div>
        ))}
        <button type="button" className="secondary" onClick={addTestCase}>
          + Add Test Case
        </button>

        <button type="submit" disabled={submitting} className="primary">
          {submitting ? "Creating..." : "Create Problem"}
        </button>
      </form>
    </div>
  );
}
