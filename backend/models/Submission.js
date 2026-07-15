const mongoose = require("mongoose");

const VERDICTS = [
  "Pending",
  "Accepted",
  "Wrong Answer",
  "Compilation Error",
  "Runtime Error",
  "Time Limit Exceeded",
];

const submissionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    problem: { type: mongoose.Schema.Types.ObjectId, ref: "Problem", required: true, index: true },
    language: { type: String, enum: ["python", "cpp", "java"], required: true },
    code: { type: String, required: true },
    verdict: { type: String, enum: VERDICTS, default: "Pending" },
    passedCount: { type: Number, default: 0 },
    totalCount: { type: Number, default: 0 },
    errorMessage: { type: String, default: "" },
    // problem.points if verdict is Accepted, else 0 — only meaningful for
    // problems attached to a competition; practice problems just carry 0.
    score: { type: Number, default: 0 },
    // Details of the first test case that failed (if any). Redacted to just
    // { index, isSample: false } before this is ever saved when the failing
    // case was hidden — showing a hidden test's input/expected output would
    // let users reverse-engineer exactly what's being tested.
    failedTestCase: {
      index: Number,
      input: String,
      expectedOutput: String,
      actualOutput: String,
      isSample: Boolean,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Submission", submissionSchema);
module.exports.VERDICTS = VERDICTS;
