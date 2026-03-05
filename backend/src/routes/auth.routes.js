import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Router } from "express";
import { config } from "../config.js";
import { query } from "../db.js";

const router = Router();

function createToken(userId) {
  return jwt.sign({}, config.jwtSecret, {
    subject: String(userId),
    expiresIn: "7d"
  });
}

function sanitizeUser(row) {
  return {
    id: row.id,
    username: row.username,
    email: row.email
  };
}

router.post("/signup", async (req, res, next) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: "username, email, and password are required" });
    }

    if (String(password).length < 8) {
      return res.status(400).json({ error: "password must be at least 8 characters" });
    }

    const passwordHash = await bcrypt.hash(String(password), 10);

    const insertResult = await query(
      `INSERT INTO users (username, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, username, email`,
      [String(username).trim(), String(email).trim().toLowerCase(), passwordHash]
    );

    const user = insertResult.rows[0];
    const token = createToken(user.id);

    return res.status(201).json({ token, user: sanitizeUser(user) });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ error: "username or email already exists" });
    }
    return next(error);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }

    const userResult = await query(
      `SELECT id, username, email, password_hash
       FROM users
       WHERE email = $1`,
      [String(email).trim().toLowerCase()]
    );

    if (userResult.rowCount === 0) {
      return res.status(401).json({ error: "invalid credentials" });
    }

    const user = userResult.rows[0];
    const isValid = await bcrypt.compare(String(password), user.password_hash);

    if (!isValid) {
      return res.status(401).json({ error: "invalid credentials" });
    }

    const token = createToken(user.id);

    return res.json({
      token,
      user: sanitizeUser(user)
    });
  } catch (error) {
    return next(error);
  }
});

export default router;

