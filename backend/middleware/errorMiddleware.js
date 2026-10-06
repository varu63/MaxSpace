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
  // driver internals / stack traces never reach the client — EXCEPT when the
  // controller marked the error `userFacing`, meaning the message was written
  // for a person (e.g. "we could not send your verification email") and
  // contains no internals.
  const isProduction = process.env.NODE_ENV === "production";
  const isUserFacing = err.userFacing === true;
  const message =
    statusCode >= 500
      ? isProduction && !isUserFacing
        ? "Internal server error"
        : err.message || "Server Error"
      : err.message || "Server Error";

  // Standard envelope: the message is always present (frontends read
  // error.message), plus success:false and the numeric status for callers
  // that need them (e.g. distinguishing 404 from 5xx failures).
  // Validation/access errors also carry a machine-readable `code` and the
  // offending `field`, so a form can highlight the right input instead of
  // showing a generic banner. `code` is exposed for 4xx and for explicitly
  // user-facing 5xx only — a raw driver `code` from a broken query must
  // never leave the server.
  const body = {
    success: false,
    status: statusCode,
    message,
  };
  if (statusCode < 500 || isUserFacing) {
    if (err.code) body.code = err.code;
  }
  if (statusCode < 500) {
    if (err.field) body.field = err.field;
    if (Array.isArray(err.fieldErrors) && err.fieldErrors.length) body.fieldErrors = err.fieldErrors;
  }
  res.status(statusCode).json(body);
};
