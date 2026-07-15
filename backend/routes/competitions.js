const express = require("express");
const {
  listCompetitions,
  getCompetition,
  createCompetition,
  updateCompetition,
  deleteCompetition,
  getLeaderboard,
} = require("../controllers/competitionController");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

router.get("/", asyncHandler(listCompetitions));
router.get("/:slug", asyncHandler(getCompetition));
router.get("/:slug/leaderboard", asyncHandler(getLeaderboard));
router.post("/", requireAuth, requireAdmin, asyncHandler(createCompetition));
router.put("/:slug", requireAuth, requireAdmin, asyncHandler(updateCompetition));
router.delete("/:slug", requireAuth, requireAdmin, asyncHandler(deleteCompetition));

module.exports = router;
