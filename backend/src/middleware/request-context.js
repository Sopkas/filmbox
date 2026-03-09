import { randomUUID } from "node:crypto";
import { logger } from "../utils/logger.js";

export function requestContext(req, res, next) {
  const externalRequestId = req.headers["x-request-id"];
  const requestId = typeof externalRequestId === "string" && externalRequestId.trim()
    ? externalRequestId.trim()
    : randomUUID();

  req.requestId = requestId;
  req.log = logger.child({ requestId, method: req.method, path: req.originalUrl });

  res.setHeader("x-request-id", requestId);

  const startedAt = process.hrtime.bigint();
  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    req.log.info("request.completed", {
      status: res.statusCode,
      durationMs: Number(durationMs.toFixed(2))
    });
  });

  return next();
}
