const mongoose = require("mongoose");

const problemSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    statement: { type: String, required: true },
    difficulty: { type: String, enum: ["Easy", "Medium", "Hard"], default: "Easy" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    // null/absent = a practice problem (doesn't contribute to any competition's scoring/ranking)
    competition: { type: mongoose.Schema.Types.ObjectId, ref: "Competition", default: null, index: true },
    points: { type: Number, default: 100 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Problem", problemSchema);
