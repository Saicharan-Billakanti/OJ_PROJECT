require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const connectDB = require("../config/db");
const User = require("../models/User");
const Problem = require("../models/Problem");
const TestCase = require("../models/TestCase");
const slugify = require("../utils/slugify");

const PROBLEMS = [
  {
    title: "Sum of Two Numbers",
    difficulty: "Easy",
    statement:
      "Given two integers A and B on a single line (space separated), print their sum.\n\nInput:\nA single line containing two space-separated integers A and B.\n\nOutput:\nA single integer, the sum of A and B.",
    testCases: [
      { input: "2 3\n", output: "5", isSample: true },
      { input: "10 20\n", output: "30", isSample: true },
      { input: "-5 5\n", output: "0", isSample: false },
      { input: "1000000 2000000\n", output: "3000000", isSample: false },
    ],
  },
  {
    title: "Reverse a String",
    difficulty: "Easy",
    statement:
      "Given a string S on a single line, print the reverse of S.\n\nInput:\nA single line containing string S (no spaces).\n\nOutput:\nThe reverse of S.",
    testCases: [
      { input: "hello\n", output: "olleh", isSample: true },
      { input: "algouniversity\n", output: "ytisrevinuogla", isSample: true },
      { input: "a\n", output: "a", isSample: false },
      { input: "racecar\n", output: "racecar", isSample: false },
    ],
  },
  {
    title: "Check Prime",
    difficulty: "Medium",
    statement:
      "Given an integer N, print 'YES' if N is prime, otherwise print 'NO'.\n\nInput:\nA single integer N (1 <= N <= 10^6).\n\nOutput:\n'YES' or 'NO'.",
    testCases: [
      { input: "7\n", output: "YES", isSample: true },
      { input: "10\n", output: "NO", isSample: true },
      { input: "1\n", output: "NO", isSample: false },
      { input: "97\n", output: "YES", isSample: false },
      { input: "100\n", output: "NO", isSample: false },
    ],
  },
];

async function run() {
  await connectDB();

  let admin = await User.findOne({ email: "admin@oj.local" });
  if (!admin) {
    const passwordHash = await bcrypt.hash("Admin@123", 10);
    admin = await User.create({
      fullName: "OJ Admin",
      email: "admin@oj.local",
      passwordHash,
      role: "admin",
    });
    console.log("Created admin user: admin@oj.local / Admin@123");
  } else {
    console.log("Admin user already exists, skipping creation");
  }

  for (const p of PROBLEMS) {
    const slug = slugify(p.title);
    let problem = await Problem.findOne({ slug });
    if (problem) {
      console.log(`Problem "${p.title}" already exists, skipping`);
      continue;
    }

    problem = await Problem.create({
      title: p.title,
      slug,
      statement: p.statement,
      difficulty: p.difficulty,
      createdBy: admin._id,
    });

    const docs = p.testCases.map((tc) => ({ ...tc, problem: problem._id }));
    await TestCase.insertMany(docs);
    console.log(`Seeded problem "${p.title}" with ${docs.length} test cases`);
  }

  console.log("Seeding complete.");
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
