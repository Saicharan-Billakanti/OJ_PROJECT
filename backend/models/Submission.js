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
  },
  { timestamps: true }
);

module.exports = mongoose.model("Submission", submissionSchema);
module.exports.VERDICTS = VERDICTS;
