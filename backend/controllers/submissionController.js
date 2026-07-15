const Problem = require("../models/Problem");
const TestCase = require("../models/TestCase");
const Submission = require("../models/Submission");
const { runSubmission, LANGUAGES, MAX_CODE_LENGTH, ServerBusyError } = require("../services/executor");

/**
 * Never let a hidden test case's input/expected/actual output reach the
 * client (or even get persisted) — that would let a user reverse-engineer
 * exactly what's being tested. Sample-case failures keep full detail so
 * users can actually debug, matching how every real judge behaves.
 */
function redactFailedTestCase(failedTestCase) {
  if (!failedTestCase) return undefined;
  if (!failedTestCase.isSample) {
    return { index: failedTestCase.index, isSample: false };
  }
  return failedTestCase;
}

async function submitCode(req, res) {
  const { slug } = req.params;
  const { code, language } = req.body;

  if (!code || !language) {
    return res.status(400).json({ message: "code and language are required" });
  }
  if (!LANGUAGES[language]) {
    return res.status(400).json({ message: `Unsupported language: ${language}` });
  }
  if (code.length > MAX_CODE_LENGTH) {
    return res.status(400).json({ message: `Code exceeds the ${MAX_CODE_LENGTH} character limit` });
  }

  const problem = await Problem.findOne({ slug });
  if (!problem) return res.status(404).json({ message: "Problem not found" });

  const testCases = await TestCase.find({ problem: problem._id }).select("input output isSample");
  if (testCases.length === 0) {
    return res.status(400).json({ message: "This problem has no test cases configured yet" });
  }

  const submission = await Submission.create({
    user: req.user._id,
    problem: problem._id,
    language,
    code,
    verdict: "Pending",
    totalCount: testCases.length,
  });

  let result;
  try {
    result = await runSubmission({
      language,
      code,
      testCases: testCases.map((tc) => ({ input: tc.input, output: tc.output, isSample: tc.isSample })),
    });
  } catch (err) {
    if (err instanceof ServerBusyError) {
      submission.verdict = "Pending";
      await submission.save();
      return res.status(503).json({ message: err.message });
    }
    throw err;
  }

  submission.verdict = result.verdict;
  submission.passedCount = result.passedCount;
  submission.totalCount = result.totalCount;
  submission.errorMessage = result.errorMessage;
  // Only Accepted submissions earn points; practice problems (competition:
  // null) still get a score computed the same way, it just isn't surfaced
  // anywhere since no leaderboard aggregates over practice problems.
  submission.score = result.verdict === "Accepted" ? problem.points : 0;
  submission.failedTestCase = redactFailedTestCase(result.failedTestCase);
  await submission.save();

  res.json({ submission });
}

/**
 * Runs code against sample test cases only — a scratch sanity check, not an
 * official submission. Nothing is persisted to the Submission collection and
 * no score is computed. Every test case passed to the executor here is a
 * sample by definition, so failedTestCase never needs redaction the way
 * submitCode's does.
 */
async function runCode(req, res) {
  const { slug } = req.params;
  const { code, language } = req.body;

  if (!code || !language) {
    return res.status(400).json({ message: "code and language are required" });
  }
  if (!LANGUAGES[language]) {
    return res.status(400).json({ message: `Unsupported language: ${language}` });
  }
  if (code.length > MAX_CODE_LENGTH) {
    return res.status(400).json({ message: `Code exceeds the ${MAX_CODE_LENGTH} character limit` });
  }

  const problem = await Problem.findOne({ slug });
  if (!problem) return res.status(404).json({ message: "Problem not found" });

  const sampleTestCases = await TestCase.find({ problem: problem._id, isSample: true }).select("input output isSample");
  if (sampleTestCases.length === 0) {
    return res.status(400).json({ message: "This problem has no sample test cases to run against" });
  }

  try {
    const result = await runSubmission({
      language,
      code,
      testCases: sampleTestCases.map((tc) => ({ input: tc.input, output: tc.output, isSample: tc.isSample })),
    });
    res.json({ run: result });
  } catch (err) {
    if (err instanceof ServerBusyError) {
      return res.status(503).json({ message: err.message });
    }
    throw err;
  }
}

async function listMySubmissions(req, res) {
  const submissions = await Submission.find({ user: req.user._id })
    .populate("problem", "title slug")
    .sort({ createdAt: -1 })
    .limit(50);
  res.json({ submissions });
}

async function listRecentSubmissions(req, res) {
  const submissions = await Submission.find()
    .populate("problem", "title slug")
    .populate("user", "fullName")
    .sort({ createdAt: -1 })
    .limit(10);
  res.json({ submissions });
}

async function getSubmission(req, res) {
  const submission = await Submission.findById(req.params.id).populate("problem", "title slug");
  if (!submission) return res.status(404).json({ message: "Submission not found" });

  if (String(submission.user) !== String(req.user._id) && req.user.role !== "admin") {
    return res.status(403).json({ message: "Not allowed to view this submission" });
  }

  res.json({ submission });
}

async function getMyStats(req, res) {
  const [totalSubmissions, acceptedSubmissions, solvedProblems] = await Promise.all([
    Submission.countDocuments({ user: req.user._id }),
    Submission.countDocuments({ user: req.user._id, verdict: "Accepted" }),
    Submission.distinct("problem", { user: req.user._id, verdict: "Accepted" }),
  ]);

  res.json({
    totalSubmissions,
    acceptedSubmissions,
    problemsSolved: solvedProblems.length,
  });
}

module.exports = {
  submitCode,
  runCode,
  listMySubmissions,
  listRecentSubmissions,
  getSubmission,
  getMyStats,
};
