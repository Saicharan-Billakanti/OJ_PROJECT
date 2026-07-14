const Problem = require("../models/Problem");
const TestCase = require("../models/TestCase");
const Submission = require("../models/Submission");
const { runSubmission, LANGUAGES } = require("../services/executor");

async function submitCode(req, res) {
  const { slug } = req.params;
  const { code, language } = req.body;

  if (!code || !language) {
    return res.status(400).json({ message: "code and language are required" });
  }
  if (!LANGUAGES[language]) {
    return res.status(400).json({ message: `Unsupported language: ${language}` });
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

  const result = await runSubmission({
    language,
    code,
    testCases: testCases.map((tc) => ({ input: tc.input, output: tc.output })),
  });

  submission.verdict = result.verdict;
  submission.passedCount = result.passedCount;
  submission.totalCount = result.totalCount;
  submission.errorMessage = result.errorMessage;
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

module.exports = { submitCode, listMySubmissions, listRecentSubmissions, getSubmission };
