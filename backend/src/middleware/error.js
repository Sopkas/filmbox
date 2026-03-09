export function notFoundHandler(req, res) {
  res.status(404).json({
    error: "Not found",
    requestId: req.requestId
  });
}

export function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  const status = err.statusCode || 500;
  const message = err.message || "Internal server error";

  if (req.log) {
    req.log.error("request.failed", {
      status,
      route: req.originalUrl,
      error: err
    });
  } else {
    console.error(err);
  }

  res.status(status).json({
    error: message,
    requestId: req.requestId
  });
}
