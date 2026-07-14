const express = require("express");
const {
  submitCode,
  listMySubmissions,
  listRecentSubmissions,
  getSubmission,
} = require("../controllers/submissionController");
const { requireAuth } = require("../middleware/auth");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

router.post("/problems/:slug/submit", requireAuth, asyncHandler(submitCode));
router.get("/submissions/mine", requireAuth, asyncHandler(listMySubmissions));
router.get("/submissions/recent", asyncHandler(listRecentSubmissions));
router.get("/submissions/:id", requireAuth, asyncHandler(getSubmission));

module.exports = router;
