export const notFound = (req, res, next) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
};

export const errorHandler = (err, req, res, next) => {
  // Prefer an explicit HTTP status set by the controller; fall back to a
  // status carried on the error object (e.g. from auth utilities).
  const statusCode = res.statusCode !== 200 ? res.statusCode : err.statusCode || 500;
  console.error(err.stack || err);

  // 4xx messages are user-facing strings set by controllers and can be
  // passed through. 5xx responses are scrubbed in production so database
  // driver internals / stack traces never reach the client.
  const isProduction = process.env.NODE_ENV === "production";
  const message =
    statusCode >= 500
      ? isProduction
        ? "Internal server error"
        : err.message || "Server Error"
      : err.message || "Server Error";

  // Standard envelope: the message is always present (frontends read
  // error.message), plus success:false and the numeric status for callers
  // that need them (e.g. distinguishing 404 from 5xx failures).
  res.status(statusCode).json({
    success: false,
    status: statusCode,
    message,
  });
};
