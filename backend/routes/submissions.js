const express = require("express");
const {
  submitCode,
  listMySubmissions,
  listRecentSubmissions,
  getSubmission,
} = require("../controllers/submissionController");
const { requireAuth } = require("../middleware/auth");
const asyncHandler = require("../utils/asyncHandler");
const rateLimit = require("../middleware/rateLimit");

const router = express.Router();

const submitLimiter = rateLimit({ windowMs: 60_000, max: 10 });

router.post("/problems/:slug/submit", requireAuth, submitLimiter, asyncHandler(submitCode));
router.get("/submissions/mine", requireAuth, asyncHandler(listMySubmissions));
router.get("/submissions/recent", asyncHandler(listRecentSubmissions));
router.get("/submissions/:id", requireAuth, asyncHandler(getSubmission));

module.exports = router;
