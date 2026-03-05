export function notFoundHandler(req, res) {
  res.status(404).json({ error: "Not found" });
}

export function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  console.error(err);

  const status = err.statusCode || 500;
  const message = err.message || "Internal server error";

  res.status(status).json({ error: message });
}

