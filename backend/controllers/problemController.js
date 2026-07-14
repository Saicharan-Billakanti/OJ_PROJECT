const Problem = require("../models/Problem");
const TestCase = require("../models/TestCase");
const slugify = require("../utils/slugify");

async function listProblems(req, res) {
  const problems = await Problem.find().select("title slug difficulty createdAt").sort({ createdAt: -1 });
  res.json({ problems });
}

async function getProblem(req, res) {
  const problem = await Problem.findOne({ slug: req.params.slug });
  if (!problem) return res.status(404).json({ message: "Problem not found" });

  const sampleTestCases = await TestCase.find({ problem: problem._id, isSample: true }).select("input output");
  res.json({ problem, sampleTestCases });
}

async function createProblem(req, res) {
  const { title, statement, difficulty, testCases } = req.body;
  if (!title || !statement) {
    return res.status(400).json({ message: "title and statement are required" });
  }

  const baseSlug = slugify(title);
  let slug = baseSlug;
  let suffix = 1;
  while (await Problem.findOne({ slug })) {
    slug = `${baseSlug}-${suffix++}`;
  }

  const problem = await Problem.create({
    title,
    slug,
    statement,
    difficulty: difficulty || "Easy",
    createdBy: req.user._id,
  });

  if (Array.isArray(testCases) && testCases.length > 0) {
    const docs = testCases.map((tc) => ({
      problem: problem._id,
      input: tc.input,
      output: tc.output,
      isSample: Boolean(tc.isSample),
    }));
    await TestCase.insertMany(docs);
  }

  res.status(201).json({ problem });
}

async function updateProblem(req, res) {
  const { title, statement, difficulty } = req.body;
  const problem = await Problem.findOne({ slug: req.params.slug });
  if (!problem) return res.status(404).json({ message: "Problem not found" });

  if (title) problem.title = title;
  if (statement) problem.statement = statement;
  if (difficulty) problem.difficulty = difficulty;
  await problem.save();

  res.json({ problem });
}

async function deleteProblem(req, res) {
  const problem = await Problem.findOneAndDelete({ slug: req.params.slug });
  if (!problem) return res.status(404).json({ message: "Problem not found" });

  await TestCase.deleteMany({ problem: problem._id });
  res.json({ message: "Problem deleted" });
}

async function addTestCase(req, res) {
  const { input, output, isSample } = req.body;
  if (input === undefined || output === undefined) {
    return res.status(400).json({ message: "input and output are required" });
  }

  const problem = await Problem.findOne({ slug: req.params.slug });
  if (!problem) return res.status(404).json({ message: "Problem not found" });

  const testCase = await TestCase.create({
    problem: problem._id,
    input,
    output,
    isSample: Boolean(isSample),
  });

  res.status(201).json({ testCase });
}

async function listAllTestCases(req, res) {
  const problem = await Problem.findOne({ slug: req.params.slug });
  if (!problem) return res.status(404).json({ message: "Problem not found" });

  const testCases = await TestCase.find({ problem: problem._id });
  res.json({ testCases });
}

async function deleteTestCase(req, res) {
  const problem = await Problem.findOne({ slug: req.params.slug });
  if (!problem) return res.status(404).json({ message: "Problem not found" });

  const testCase = await TestCase.findOneAndDelete({
    _id: req.params.testCaseId,
    problem: problem._id,
  });
  if (!testCase) return res.status(404).json({ message: "Test case not found" });

  res.json({ message: "Test case deleted" });
}

module.exports = {
  listProblems,
  getProblem,
  createProblem,
  updateProblem,
  deleteProblem,
  addTestCase,
  listAllTestCases,
  deleteTestCase,
};
