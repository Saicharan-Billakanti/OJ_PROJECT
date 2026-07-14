import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import client from "../api/client";
import { useAuth } from "../context/AuthContext";

const STARTER_CODE = {
  python: 'name = input()\nprint("Hello, " + name)\n',
  cpp: '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    // your code here\n    return 0;\n}\n',
  java: 'import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        // your code here\n    }\n}\n',
};

const VERDICT_CLASS = {
  Accepted: "verdict-accepted",
  "Wrong Answer": "verdict-failed",
  "Compilation Error": "verdict-failed",
  "Runtime Error": "verdict-failed",
  "Time Limit Exceeded": "verdict-failed",
  Pending: "verdict-pending",
};

export default function ProblemDetail() {
  const { slug } = useParams();
  const { user } = useAuth();
  const [problem, setProblem] = useState(null);
  const [samples, setSamples] = useState([]);
  const [language, setLanguage] = useState("python");
  const [code, setCode] = useState(STARTER_CODE.python);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    client
      .get(`/problems/${slug}`)
      .then((res) => {
        setProblem(res.data.problem);
        setSamples(res.data.sampleTestCases);
      })
      .catch(() => setError("Failed to load problem"))
      .finally(() => setLoading(false));
  }, [slug]);

  function handleLanguageChange(newLang) {
    setLanguage(newLang);
    setCode(STARTER_CODE[newLang]);
  }

  async function handleSubmit() {
    if (!user) {
      setError("Please login to submit code");
      return;
    }
    setSubmitting(true);
    setError("");
    setResult(null);
    try {
      const res = await client.post(`/problems/${slug}/submit`, { code, language });
      setResult(res.data.submission);
    } catch (err) {
      setError(err.response?.data?.message || "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p style={{ padding: 24 }}>Loading...</p>;
  if (!problem) return <p style={{ padding: 24 }} className="error">{error || "Problem not found"}</p>;

  return (
    <div className="page problem-detail">
      <div className="statement-pane">
        <h1>{problem.title}</h1>
        <span className="badge">{problem.difficulty}</span>
        <pre className="statement">{problem.statement}</pre>

        {samples.length > 0 && (
          <div className="samples">
            <h3>Sample Test Cases</h3>
            {samples.map((s, i) => (
              <div key={i} className="sample">
                <div>
                  <strong>Input</strong>
                  <pre>{s.input}</pre>
                </div>
                <div>
                  <strong>Expected Output</strong>
                  <pre>{s.output}</pre>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="editor-pane">
        <div className="editor-toolbar">
          <select value={language} onChange={(e) => handleLanguageChange(e.target.value)}>
            <option value="python">Python</option>
            <option value="cpp">C++</option>
            <option value="java">Java</option>
          </select>
          <button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Running..." : "Submit"}
          </button>
        </div>

        <textarea
          className="code-editor"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          spellCheck="false"
        />

        {error && <p className="error">{error}</p>}

        {submitting && <p className="hint">Compiling and running against test cases in Docker — this can take a few seconds...</p>}

        {result && (
          <div className={`verdict-box ${VERDICT_CLASS[result.verdict] || ""}`}>
            <h3>{result.verdict}</h3>
            <p>
              Passed {result.passedCount} / {result.totalCount} test cases
            </p>
            {result.errorMessage && <pre className="error-message">{result.errorMessage}</pre>}
          </div>
        )}
      </div>
    </div>
  );
}
