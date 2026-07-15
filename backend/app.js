const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const authRoutes = require("./routes/auth");
const problemRoutes = require("./routes/problems");
const submissionRoutes = require("./routes/submissions");
const competitionRoutes = require("./routes/competitions");

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRoutes);
app.use("/api/problems", problemRoutes);
app.use("/api", submissionRoutes);
app.use("/api/competitions", competitionRoutes);

app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// Centralized error handler — catches anything forwarded via asyncHandler's next(err)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || "Internal server error" });
});

module.exports = app;
