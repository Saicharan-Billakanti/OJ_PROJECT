const express = require("express");
const {
  listProblems,
  getProblem,
  createProblem,
  updateProblem,
  deleteProblem,
  addTestCase,
  listAllTestCases,
  deleteTestCase,
} = require("../controllers/problemController");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

router.get("/", asyncHandler(listProblems));
router.get("/:slug", asyncHandler(getProblem));
router.post("/", requireAuth, requireAdmin, asyncHandler(createProblem));
router.put("/:slug", requireAuth, requireAdmin, asyncHandler(updateProblem));
router.delete("/:slug", requireAuth, requireAdmin, asyncHandler(deleteProblem));

router.post("/:slug/testcases", requireAuth, requireAdmin, asyncHandler(addTestCase));
router.get("/:slug/testcases", requireAuth, requireAdmin, asyncHandler(listAllTestCases));
router.delete("/:slug/testcases/:testCaseId", requireAuth, requireAdmin, asyncHandler(deleteTestCase));

module.exports = router;
