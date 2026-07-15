const express = require("express");
const {
  submitCode,
  runCode,
  listMySubmissions,
  listRecentSubmissions,
  getSubmission,
  getMyStats,
} = require("../controllers/submissionController");
const { requireAuth } = require("../middleware/auth");
const asyncHandler = require("../utils/asyncHandler");
const rateLimit = require("../middleware/rateLimit");

const router = express.Router();

// Run and Submit both hit the same expensive Docker execution path, so they
// share one rate-limit bucket — otherwise Run would be a free way around the
// Submit limit.
const executionLimiter = rateLimit({ windowMs: 60_000, max: 10 });

router.post("/problems/:slug/run", requireAuth, executionLimiter, asyncHandler(runCode));
router.post("/problems/:slug/submit", requireAuth, executionLimiter, asyncHandler(submitCode));
router.get("/submissions/mine", requireAuth, asyncHandler(listMySubmissions));
router.get("/submissions/recent", asyncHandler(listRecentSubmissions));
router.get("/submissions/stats", requireAuth, asyncHandler(getMyStats));
router.get("/submissions/:id", requireAuth, asyncHandler(getSubmission));

module.exports = router;
