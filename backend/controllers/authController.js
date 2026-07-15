const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User");

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function signToken(user) {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
}

async function signup(req, res) {
  const { fullName, email, password, dob } = req.body;
  if (!fullName || !email || !password) {
    return res.status(400).json({ message: "fullName, email, and password are required" });
  }
  if (password.length < 6) {
    return res.status(400).json({ message: "Password must be at least 6 characters" });
  }
  if (dob && Number.isNaN(new Date(dob).getTime())) {
    return res.status(400).json({ message: "dob must be a valid date" });
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) return res.status(409).json({ message: "Email already registered" });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ fullName, email, passwordHash, dob: dob || undefined });

  const token = signToken(user);
  res.status(201).json({
    token,
    user: { id: user._id, fullName: user.fullName, email: user.email, role: user.role, dob: user.dob },
  });
}

async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: "email and password are required" });
  }

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) return res.status(401).json({ message: "Invalid email or password" });

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) return res.status(401).json({ message: "Invalid email or password" });

  const token = signToken(user);
  res.json({
    token,
    user: { id: user._id, fullName: user.fullName, email: user.email, role: user.role, dob: user.dob },
  });
}

async function me(req, res) {
  res.json({ user: req.user });
}

async function updateProfile(req, res) {
  const { fullName, dob } = req.body;
  if (!fullName || !fullName.trim()) {
    return res.status(400).json({ message: "fullName is required" });
  }
  if (dob && Number.isNaN(new Date(dob).getTime())) {
    return res.status(400).json({ message: "dob must be a valid date" });
  }

  req.user.fullName = fullName.trim();
  if (dob !== undefined) req.user.dob = dob || null;
  await req.user.save();

  res.json({
    user: {
      id: req.user._id,
      fullName: req.user.fullName,
      email: req.user.email,
      role: req.user.role,
      dob: req.user.dob,
    },
  });
}

/**
 * Requests a password reset. No email service is configured in this project,
 * so in non-production environments the raw reset link is returned directly
 * in the response (and logged) instead of emailed — clearly a dev-only
 * convenience, not something that should ship as-is to production. Always
 * responds with the same generic message regardless of whether the email
 * exists, so this endpoint can't be used to enumerate registered accounts.
 */
async function forgotPassword(req, res) {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: "email is required" });
  }

  const genericResponse = {
    message: "If that email is registered, a password reset link has been sent.",
  };

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    return res.json(genericResponse);
  }

  const rawToken = crypto.randomBytes(32).toString("hex");
  user.resetTokenHash = hashToken(rawToken);
  user.resetTokenExpiry = new Date(Date.now() + RESET_TOKEN_TTL_MS);
  await user.save();

  const resetUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/reset-password/${rawToken}`;
  console.log(`[password reset] ${user.email} -> ${resetUrl}`);

  if (process.env.NODE_ENV !== "production") {
    return res.json({ ...genericResponse, devResetUrl: resetUrl });
  }

  res.json(genericResponse);
}

async function resetPassword(req, res) {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) {
    return res.status(400).json({ message: "token and newPassword are required" });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ message: "Password must be at least 6 characters" });
  }

  const user = await User.findOne({
    resetTokenHash: hashToken(token),
    resetTokenExpiry: { $gt: new Date() },
  }).select("+resetTokenHash +resetTokenExpiry");

  if (!user) {
    return res.status(400).json({ message: "Invalid or expired reset token" });
  }

  user.passwordHash = await bcrypt.hash(newPassword, 10);
  user.resetTokenHash = undefined;
  user.resetTokenExpiry = undefined;
  await user.save();

  res.json({ message: "Password reset successfully. You can now log in." });
}

module.exports = { signup, login, me, updateProfile, forgotPassword, resetPassword };
