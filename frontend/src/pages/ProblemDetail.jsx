import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import client from "../api/client";
import { useAuth } from "../context/AuthContext";

const STARTER_CODE = {
  python: 'name = input()\nprint("Hello, " + name)\n',
  cpp: '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    // your code here\n    return 0;\n}\n',
  java: 'import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        // your code here\n    }\n}\n',
};

const FILE_EXTENSIONS = { python: ".py", cpp: ".cpp", java: ".java" };
const MAX_UPLOAD_BYTES = 65_536; // matches the backend's MAX_CODE_LENGTH

const VERDICT_CLASS = {
  Accepted: "verdict-accepted",
  "Wrong Answer": "verdict-failed",
  "Compilation Error": "verdict-failed",
  "Runtime Error": "verdict-failed",
  "Time Limit Exceeded": "verdict-failed",
  Pending: "verdict-pending",
};

function VerdictBox({ result, eyebrow }) {
  return (
    <div className={`verdict-box ${VERDICT_CLASS[result.verdict] || ""}`}>
      {eyebrow && <p className="verdict-eyebrow">{eyebrow}</p>}
      <h3>{result.verdict}</h3>
      <p>
        Passed {result.passedCount} / {result.totalCount} test cases
      </p>
      {result.errorMessage && <pre className="error-message">{result.errorMessage}</pre>}

      {result.failedTestCase && (
        <div className="testcase-diff">
          {result.failedTestCase.isSample ? (
            <>
              <h4>Test case {result.failedTestCase.index}</h4>
              <div className="diff-grid">
                <div>
                  <strong>Input</strong>
                  <pre>{result.failedTestCase.input}</pre>
                </div>
                <div>
                  <strong>Expected Output</strong>
                  <pre>{result.failedTestCase.expectedOutput}</pre>
                </div>
                <div>
                  <strong>Your Output</strong>
                  <pre className="your-output">{result.failedTestCase.actualOutput}</pre>
                </div>
              </div>
            </>
          ) : (
            <p className="hint">
              Failed on hidden test case {result.failedTestCase.index} — input/expected output aren't shown for hidden test cases.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function ProblemDetail() {
  const { slug } = useParams();
  const { user, loading: authLoading } = useAuth();
  const [problem, setProblem] = useState(null);
  const [samples, setSamples] = useState([]);
  const [language, setLanguage] = useState("python");
  const [code, setCode] = useState(STARTER_CODE.python);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [runResult, setRunResult] = useState(null);
  const [result, setResult] = useState(null);
  const [uploadedFileName, setUploadedFileName] = useState("");
  const fileInputRef = useRef(null);

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
    setUploadedFileName("");
  }

  function handleFileUpload(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;

    if (file.size > MAX_UPLOAD_BYTES) {
      setError(`File is too large — max ${MAX_UPLOAD_BYTES / 1024}KB`);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setCode(String(reader.result));
      setUploadedFileName(file.name);
      setError("");
    };
    reader.onerror = () => setError("Failed to read file");
    reader.readAsText(file);
  }

  async function handleRun() {
    if (authLoading) return;
    if (!user) {
      setError("Please login to run code");
      return;
    }
    setRunning(true);
    setError("");
    setResult(null);
    setRunResult(null);
    try {
      const res = await client.post(`/problems/${slug}/run`, { code, language });
      setRunResult(res.data.run);
    } catch (err) {
      setError(err.response?.data?.message || "Run failed");
    } finally {
      setRunning(false);
    }
  }

  async function handleSubmit() {
    if (authLoading) return; // auth state still resolving — button is disabled, but guard anyway
    if (!user) {
      setError("Please login to submit code");
      return;
    }
    setSubmitting(true);
    setError("");
    setRunResult(null);
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

  if (loading) return <div className="page"><p className="hint">Loading...</p></div>;
  if (!problem) return <div className="page"><p className="error">{error || "Problem not found"}</p></div>;

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
          <div className="editor-toolbar-actions">
            <button type="button" className="secondary" onClick={() => fileInputRef.current?.click()}>
              Upload File
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept={`${FILE_EXTENSIONS[language]},.txt`}
              onChange={handleFileUpload}
              style={{ display: "none" }}
            />
            <button
              type="button"
              className="secondary"
              onClick={handleRun}
              disabled={running || submitting || authLoading || samples.length === 0}
              title={samples.length === 0 ? "No sample test cases to run against" : undefined}
            >
              {running ? "Running..." : "Run"}
            </button>
            <button onClick={handleSubmit} disabled={running || submitting || authLoading}>
              {submitting ? "Submitting..." : authLoading ? "..." : "Submit"}
            </button>
          </div>
        </div>

        {uploadedFileName && (
          <p className="hint" style={{ marginBottom: 8 }}>
            Loaded from <strong>{uploadedFileName}</strong> — editing below still works normally.
          </p>
        )}

        <textarea
          className="code-editor"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setUploadedFileName("");
          }}
          spellCheck="false"
        />

        {error && <p className="error">{error}</p>}

        {running && <p className="hint">Running against sample test cases in Docker...</p>}
        {submitting && <p className="hint">Compiling and running against all test cases in Docker — this can take a few seconds...</p>}

        {runResult && <VerdictBox result={runResult} eyebrow="Run result — sample test cases only, not an official submission" />}
        {result && <VerdictBox result={result} />}
      </div>
    </div>
  );
}
