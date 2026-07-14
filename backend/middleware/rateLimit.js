const buckets = new Map();

// Periodic sweep so the map doesn't grow unbounded over a long-running process.
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of buckets) {
    if (now > entry.resetAt) buckets.delete(key);
  }
}, 60_000).unref();

/**
 * Minimal in-memory fixed-window rate limiter, keyed by req.user._id.
 * Good enough for a single-instance dev/demo deployment; a multi-instance
 * production setup would need this backed by Redis instead.
 */
function rateLimit({ windowMs, max }) {
  return (req, res, next) => {
    const key = String(req.user?._id || req.ip);
    const now = Date.now();
    const entry = buckets.get(key);

    if (!entry || now > entry.resetAt) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (entry.count >= max) {
      const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
      res.set("Retry-After", String(retryAfterSec));
      return res.status(429).json({
        message: `Too many submissions. Try again in ${retryAfterSec}s.`,
      });
    }

    entry.count += 1;
    next();
  };
}

module.exports = rateLimit;
