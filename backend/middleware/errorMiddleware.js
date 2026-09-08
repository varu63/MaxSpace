export const notFound = (req, res, next) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
};

export const errorHandler = (err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  console.error(err.stack || err);
  res.status(statusCode).json({
    message: err.message || "Server Error",
  });
};
