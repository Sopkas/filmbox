import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { query } from "../db.js";

function parseCookieHeader(raw) {
  if (!raw) {
    return {};
  }

  return raw.split(";").reduce((acc, part) => {
    const [key, ...rest] = part.trim().split("=");
    if (!key) {
      return acc;
    }
    const value = rest.join("=");
    const unquoted = value.startsWith("\"") && value.endsWith("\"") ? value.slice(1, -1) : value;
    try {
      acc[key] = decodeURIComponent(unquoted);
    } catch {
      acc[key] = unquoted;
    }
    return acc;
  }, {});
}

function getTokenFromRequest(req) {
  const cookies = parseCookieHeader(req.headers.cookie || "");
  const cookieToken = cookies[config.authCookieName];
  if (cookieToken) {
    return cookieToken;
  }

  const authHeader = req.headers.authorization || "";
  if (authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }

  return "";
}

export async function requireAuth(req, res, next) {
  const token = getTokenFromRequest(req);
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }

  const userId = Number(payload?.sub);
  if (!Number.isInteger(userId) || userId < 1) {
    return res.status(401).json({ error: "Invalid token" });
  }

  try {
    const userResult = await query("SELECT id FROM users WHERE id = $1", [userId]);
    if (userResult.rowCount === 0) {
      return res.status(401).json({ error: "Invalid token" });
    }

    req.user = { id: userId };
    return next();
  } catch (error) {
    return next(error);
  }
}
