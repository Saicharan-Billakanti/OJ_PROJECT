const Problem = require("../models/Problem");
const TestCase = require("../models/TestCase");
const Submission = require("../models/Submission");
const { runSubmission, LANGUAGES, MAX_CODE_LENGTH, ServerBusyError } = require("../services/executor");

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

  const testCases = await TestCase.find({ problem: problem._id }).select("input output");
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
      testCases: testCases.map((tc) => ({ input: tc.input, output: tc.output })),
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
  await submission.save();

  res.json({ submission });
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
  listMySubmissions,
  listRecentSubmissions,
  getSubmission,
  getMyStats,
};
