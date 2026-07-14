const express = require("express");
const {
  signup,
  login,
  me,
  updateProfile,
  forgotPassword,
  resetPassword,
} = require("../controllers/authController");
const { requireAuth } = require("../middleware/auth");
const asyncHandler = require("../utils/asyncHandler");
const rateLimit = require("../middleware/rateLimit");

const router = express.Router();

const forgotPasswordLimiter = rateLimit({ windowMs: 15 * 60_000, max: 8 });

router.post("/signup", asyncHandler(signup));
router.post("/login", asyncHandler(login));
router.get("/me", requireAuth, asyncHandler(me));
router.put("/me", requireAuth, asyncHandler(updateProfile));
router.post("/forgot-password", forgotPasswordLimiter, asyncHandler(forgotPassword));
router.post("/reset-password", asyncHandler(resetPassword));

module.exports = router;
