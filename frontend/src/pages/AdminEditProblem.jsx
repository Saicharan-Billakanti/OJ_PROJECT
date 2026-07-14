import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import client from "../api/client";
import ProblemFields from "../components/ProblemFields";

const EMPTY_TEST_CASE = { input: "", output: "", isSample: false };

export default function AdminEditProblem() {
  const { slug } = useParams();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [statement, setStatement] = useState("");
  const [difficulty, setDifficulty] = useState("Easy");
  const [testCases, setTestCases] = useState([]);
  const [newTestCase, setNewTestCase] = useState(EMPTY_TEST_CASE);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [addingTestCase, setAddingTestCase] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    Promise.all([client.get(`/problems/${slug}`), client.get(`/problems/${slug}/testcases`)])
      .then(([problemRes, testCasesRes]) => {
        const { problem } = problemRes.data;
        setTitle(problem.title);
        setStatement(problem.statement);
        setDifficulty(problem.difficulty);
        setTestCases(testCasesRes.data.testCases);
      })
      .catch(() => setError("Failed to load problem"))
      .finally(() => setLoading(false));
  }, [slug]);

  async function handleSave(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await client.put(`/problems/${slug}`, { title, statement, difficulty });
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save problem");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddTestCase(e) {
    e.preventDefault();
    setError("");
    setAddingTestCase(true);
    try {
      const res = await client.post(`/problems/${slug}/testcases`, newTestCase);
      setTestCases((prev) => [...prev, res.data.testCase]);
      setNewTestCase(EMPTY_TEST_CASE);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to add test case");
    } finally {
      setAddingTestCase(false);
    }
  }

  async function handleDeleteTestCase(id) {
    if (!window.confirm("Delete this test case?")) return;
    setDeletingId(id);
    try {
      await client.delete(`/problems/${slug}/testcases/${id}`);
      setTestCases((prev) => prev.filter((tc) => tc._id !== id));
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete test case");
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) return <div className="page"><p className="hint">Loading...</p></div>;

  return (
    <div className="page">
      <div className="page-header-row">
        <div>
          <h1>Edit Problem</h1>
          <p className="section-subtitle">{title}</p>
        </div>
        <Link to="/admin/problems" className="secondary-link">
          ← Back to Manage Problems
        </Link>
      </div>

      {error && <p className="error">{error}</p>}

      <form onSubmit={handleSave} className="admin-form">
        <ProblemFields
          title={title}
          setTitle={setTitle}
          statement={statement}
          setStatement={setStatement}
          difficulty={difficulty}
          setDifficulty={setDifficulty}
        />
        <button type="submit" disabled={saving} className="primary">
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </form>

      <section className="section">
        <h2>Test Cases ({testCases.length})</h2>
        <p className="section-subtitle">Existing test cases for this problem.</p>

        {testCases.length === 0 ? (
          <p className="empty-state">No test cases yet — add one below.</p>
        ) : (
          <div className="testcase-list">
            {testCases.map((tc) => (
              <div key={tc._id} className="testcase-row">
                <div>
                  <strong>Input</strong>
                  <pre>{tc.input}</pre>
                </div>
                <div>
                  <strong>Expected Output</strong>
                  <pre>{tc.output}</pre>
                </div>
                <span className={`badge ${tc.isSample ? "diff-easy" : ""}`}>
                  {tc.isSample ? "Sample" : "Hidden"}
                </span>
                <button
                  className="danger-outline"
                  disabled={deletingId === tc._id}
                  onClick={() => handleDeleteTestCase(tc._id)}
                >
                  {deletingId === tc._id ? "Deleting..." : "Delete"}
                </button>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleAddTestCase} className="admin-form" style={{ marginTop: 20 }}>
          <h3>Add Test Case</h3>
          <div className="testcase-row">
            <textarea
              placeholder="Input"
              value={newTestCase.input}
              onChange={(e) => setNewTestCase((p) => ({ ...p, input: e.target.value }))}
              rows={2}
              required
            />
            <textarea
              placeholder="Expected Output"
              value={newTestCase.output}
              onChange={(e) => setNewTestCase((p) => ({ ...p, output: e.target.value }))}
              rows={2}
              required
            />
            <label className="sample-checkbox">
              <input
                type="checkbox"
                checked={newTestCase.isSample}
                onChange={(e) => setNewTestCase((p) => ({ ...p, isSample: e.target.checked }))}
              />
              Sample (visible to users)
            </label>
            <button type="submit" disabled={addingTestCase} className="secondary">
              {addingTestCase ? "Adding..." : "+ Add"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
