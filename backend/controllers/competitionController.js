const mongoose = require("mongoose");
const Competition = require("../models/Competition");
const Problem = require("../models/Problem");
const Submission = require("../models/Submission");
const slugify = require("../utils/slugify");

function computeStatus(competition) {
  const now = Date.now();
  if (now < new Date(competition.startTime).getTime()) return "upcoming";
  if (now > new Date(competition.endTime).getTime()) return "ended";
  return "live";
}

async function listCompetitions(req, res) {
  const competitions = await Competition.find().sort({ startTime: -1 });
  res.json({
    competitions: competitions.map((c) => ({ ...c.toObject(), status: computeStatus(c) })),
  });
}

async function getCompetition(req, res) {
  const competition = await Competition.findOne({ slug: req.params.slug });
  if (!competition) return res.status(404).json({ message: "Competition not found" });

  const problems = await Problem.find({ competition: competition._id }).select(
    "title slug difficulty points"
  );

  res.json({ competition: { ...competition.toObject(), status: computeStatus(competition) }, problems });
}

async function createCompetition(req, res) {
  const { title, description, startTime, endTime } = req.body;
  if (!title || !startTime || !endTime) {
    return res.status(400).json({ message: "title, startTime, and endTime are required" });
  }
  if (new Date(startTime).getTime() >= new Date(endTime).getTime()) {
    return res.status(400).json({ message: "startTime must be before endTime" });
  }

  const baseSlug = slugify(title);
  let slug = baseSlug;
  let suffix = 1;
  while (await Competition.findOne({ slug })) {
    slug = `${baseSlug}-${suffix++}`;
  }

  const competition = await Competition.create({
    title,
    slug,
    description: description || "",
    startTime,
    endTime,
    createdBy: req.user._id,
  });

  res.status(201).json({ competition });
}

async function updateCompetition(req, res) {
  const { title, description, startTime, endTime } = req.body;
  const competition = await Competition.findOne({ slug: req.params.slug });
  if (!competition) return res.status(404).json({ message: "Competition not found" });

  if (title) competition.title = title;
  if (description !== undefined) competition.description = description;
  if (startTime) competition.startTime = startTime;
  if (endTime) competition.endTime = endTime;
  if (new Date(competition.startTime).getTime() >= new Date(competition.endTime).getTime()) {
    return res.status(400).json({ message: "startTime must be before endTime" });
  }
  await competition.save();

  res.json({ competition });
}

async function deleteCompetition(req, res) {
  const competition = await Competition.findOneAndDelete({ slug: req.params.slug });
  if (!competition) return res.status(404).json({ message: "Competition not found" });

  // Un-scope its problems back to practice problems rather than deleting them
  // or their test cases/submission history.
  await Problem.updateMany({ competition: competition._id }, { competition: null });

  res.json({ message: "Competition deleted" });
}

/**
 * Ranks participants by total score within this competition: for each user,
 * their best (highest-scoring) submission per problem is taken, then summed
 * across all problems in the competition. Ties broken by who solved more
 * problems, then by whoever reached that score earliest.
 */
async function getLeaderboard(req, res) {
  const competition = await Competition.findOne({ slug: req.params.slug });
  if (!competition) return res.status(404).json({ message: "Competition not found" });

  const problems = await Problem.find({ competition: competition._id }).select("_id");
  const problemIds = problems.map((p) => p._id);

  if (problemIds.length === 0) {
    return res.json({ competition: { ...competition.toObject(), status: computeStatus(competition) }, standings: [] });
  }

  const standings = await Submission.aggregate([
    { $match: { problem: { $in: problemIds } } },
    { $sort: { score: -1, createdAt: 1 } },
    {
      $group: {
        _id: { user: "$user", problem: "$problem" },
        bestScore: { $first: "$score" },
        bestAt: { $first: "$createdAt" },
      },
    },
    {
      $group: {
        _id: "$_id.user",
        totalScore: { $sum: "$bestScore" },
        problemsSolved: { $sum: { $cond: [{ $gt: ["$bestScore", 0] }, 1, 0] } },
        lastSolvedAt: { $max: "$bestAt" },
      },
    },
    { $sort: { totalScore: -1, problemsSolved: -1, lastSolvedAt: 1 } },
    {
      $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" },
    },
    { $unwind: "$user" },
    {
      $project: {
        _id: 0,
        userId: "$_id",
        fullName: "$user.fullName",
        totalScore: 1,
        problemsSolved: 1,
      },
    },
  ]);

  res.json({
    competition: { ...competition.toObject(), status: computeStatus(competition) },
    totalProblems: problemIds.length,
    standings,
  });
}

module.exports = {
  listCompetitions,
  getCompetition,
  createCompetition,
  updateCompetition,
  deleteCompetition,
  getLeaderboard,
};
