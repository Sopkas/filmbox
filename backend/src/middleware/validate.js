import { ZodError } from "zod";

function formatIssuePath(path) {
  if (!path || path.length === 0) {
    return "payload";
  }
  return path
    .map((part) => (typeof part === "number" ? `[${part}]` : part))
    .join(".")
    .replace(".[", "[");
}

function toValidationResponse(error) {
  return {
    error: "Validation error",
    details: error.issues.map((issue) => ({
      field: formatIssuePath(issue.path),
      message: issue.message
    }))
  };
}

export function validate({ body, query, params } = {}) {
  return (req, res, next) => {
    try {
      if (body) {
        req.body = body.parse(req.body ?? {});
      }
      if (query) {
        req.query = query.parse(req.query ?? {});
      }
      if (params) {
        req.params = params.parse(req.params ?? {});
      }
      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json(toValidationResponse(error));
      }
      return next(error);
    }
  };
}
