import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Router } from "express";
import { z } from "zod";
import { config } from "../config.js";
import { query } from "../db.js";
import { validate } from "../middleware/validate.js";
import { verifyGoogleIdentityToken } from "../services/google-auth.js";

const router = Router();

const signupBodySchema = z.object({
  username: z.string().trim().min(3).max(40),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(128)
});

const loginBodySchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(1).max(128)
});

const googleAuthBodySchema = z.object({
  idToken: z.string().trim().min(1).max(5000)
});

function getAuthCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: config.nodeEnv === "production",
    maxAge: config.authCookieMaxAgeMs,
    path: "/"
  };
}

function createToken(userId) {
  return jwt.sign({}, config.jwtSecret, {
    subject: String(userId),
    expiresIn: "7d"
  });
}

function setAuthCookie(res, token) {
  res.cookie(config.authCookieName, token, getAuthCookieOptions());
}

function clearAuthCookie(res) {
  res.clearCookie(config.authCookieName, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.nodeEnv === "production",
    path: "/"
  });
}

function sanitizeUser(row) {
  return {
    id: row.id,
    username: row.username,
    email: row.email
  };
}

async function findSignupConflict({ email, username }) {
  const result = await query(
    `SELECT username, email
     FROM users
     WHERE LOWER(email) = LOWER($1)
        OR LOWER(username) = LOWER($2)
     LIMIT 1`,
    [email, username]
  );

  if (result.rowCount === 0) {
    return null;
  }

  const row = result.rows[0];
  if (String(row.email).toLowerCase() === String(email).toLowerCase()) {
    return "email";
  }

  if (String(row.username).toLowerCase() === String(username).toLowerCase()) {
    return "username";
  }

  return "username_or_email";
}

function normalizeGoogleUsernameBase(value) {
  const normalized = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return (normalized || "user").slice(0, 32);
}

function buildGoogleUsernameCandidate(base, attempt) {
  if (attempt === 0) {
    return base.slice(0, 40);
  }

  const suffix = `_${attempt + 1}`;
  const safeBase = base.slice(0, Math.max(1, 40 - suffix.length));
  return `${safeBase}${suffix}`;
}

async function getUserByGoogleId(googleId) {
  const result = await query(
    `SELECT id, username, email
     FROM users
     WHERE google_id = $1
     LIMIT 1`,
    [googleId]
  );

  return result.rows[0] || null;
}

async function getUserByEmail(email) {
  const result = await query(
    `SELECT id, username, email, google_id AS "googleId"
     FROM users
     WHERE LOWER(email) = LOWER($1)
     LIMIT 1`,
    [email]
  );

  return result.rows[0] || null;
}

async function resolveGoogleUser({ googleId, email, name }) {
  const byGoogle = await getUserByGoogleId(googleId);
  if (byGoogle) {
    return byGoogle;
  }

  const byEmail = await getUserByEmail(email);
  if (byEmail) {
    if (byEmail.googleId && byEmail.googleId !== googleId) {
      const error = new Error("email already linked to another Google account");
      error.statusCode = 409;
      throw error;
    }

    if (!byEmail.googleId) {
      await query(
        `UPDATE users
         SET google_id = $1
         WHERE id = $2`,
        [googleId, byEmail.id]
      );
    }

    return {
      id: byEmail.id,
      username: byEmail.username,
      email: byEmail.email
    };
  }

  const baseUsername = normalizeGoogleUsernameBase(name || email.split("@")[0]);
  const generatedPassword = randomBytes(24).toString("hex");
  const passwordHash = await bcrypt.hash(generatedPassword, 10);

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const username = buildGoogleUsernameCandidate(baseUsername, attempt);

    try {
      const created = await query(
        `INSERT INTO users (username, email, password_hash, google_id)
         VALUES ($1, $2, $3, $4)
         RETURNING id, username, email`,
        [username, email, passwordHash, googleId]
      );
      return created.rows[0];
    } catch (error) {
      if (error.code !== "23505") {
        throw error;
      }

      const existingByGoogle = await getUserByGoogleId(googleId);
      if (existingByGoogle) {
        return existingByGoogle;
      }

      const existingByEmail = await getUserByEmail(email);
      if (existingByEmail) {
        if (existingByEmail.googleId && existingByEmail.googleId !== googleId) {
          const linkError = new Error("email already linked to another Google account");
          linkError.statusCode = 409;
          throw linkError;
        }
        if (!existingByEmail.googleId) {
          await query(
            `UPDATE users
             SET google_id = $1
             WHERE id = $2`,
            [googleId, existingByEmail.id]
          );
        }
        return {
          id: existingByEmail.id,
          username: existingByEmail.username,
          email: existingByEmail.email
        };
      }
    }
  }

  const error = new Error("Failed to create Google user");
  error.statusCode = 500;
  throw error;
}

router.post("/signup", validate({ body: signupBodySchema }), async (req, res, next) => {
  try {
    const { username, email, password } = req.body;
    const normalizedUsername = String(username).trim();
    const normalizedEmail = String(email).trim().toLowerCase();

    const conflict = await findSignupConflict({
      email: normalizedEmail,
      username: normalizedUsername
    });
    if (conflict === "email") {
      req.log?.warn("auth.signup.conflict_email");
      return res.status(409).json({ error: "email already exists" });
    }
    if (conflict === "username") {
      req.log?.warn("auth.signup.conflict_username");
      return res.status(409).json({ error: "username already exists" });
    }
    if (conflict === "username_or_email") {
      req.log?.warn("auth.signup.conflict");
      return res.status(409).json({ error: "username or email already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const insertResult = await query(
      `INSERT INTO users (username, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, username, email`,
      [normalizedUsername, normalizedEmail, passwordHash]
    );

    const user = insertResult.rows[0];
    const token = createToken(user.id);
    setAuthCookie(res, token);
    req.log?.info("auth.signup.success", { userId: user.id });

    return res.status(201).json({ token, user: sanitizeUser(user) });
  } catch (error) {
    if (error.code === "23505") {
      req.log?.warn("auth.signup.conflict");
      return res.status(409).json({ error: "username or email already exists" });
    }
    return next(error);
  }
});

router.post("/login", validate({ body: loginBodySchema }), async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const userResult = await query(
      `SELECT id, username, email, password_hash
       FROM users
       WHERE email = $1`,
      [email.toLowerCase()]
    );

    if (userResult.rowCount === 0) {
      req.log?.warn("auth.login.invalid_credentials");
      return res.status(401).json({ error: "invalid credentials" });
    }

    const user = userResult.rows[0];
    const isValid = await bcrypt.compare(password, user.password_hash);

    if (!isValid) {
      req.log?.warn("auth.login.invalid_credentials", { userId: user.id });
      return res.status(401).json({ error: "invalid credentials" });
    }

    const token = createToken(user.id);
    setAuthCookie(res, token);
    req.log?.info("auth.login.success", { userId: user.id });

    return res.json({
      token,
      user: sanitizeUser(user)
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/google", validate({ body: googleAuthBodySchema }), async (req, res, next) => {
  try {
    const { idToken } = req.body;
    const profile = await verifyGoogleIdentityToken(idToken);
    const googleId = String(profile.sub).trim();
    const normalizedEmail = String(profile.email).trim().toLowerCase();

    const user = await resolveGoogleUser({
      googleId,
      email: normalizedEmail,
      name: profile.name
    });

    const token = createToken(user.id);
    setAuthCookie(res, token);
    req.log?.info("auth.google.success", { userId: user.id });

    return res.json({
      token,
      user: sanitizeUser(user)
    });
  } catch (error) {
    if (error.statusCode === 409) {
      req.log?.warn("auth.google.conflict", { message: error.message });
    } else {
      req.log?.warn("auth.google.failed", { message: error.message, statusCode: error.statusCode });
    }
    return next(error);
  }
});

router.post("/logout", (req, res) => {
  clearAuthCookie(res);
  req.log?.info("auth.logout.success");
  return res.json({ ok: true });
});

export default router;
