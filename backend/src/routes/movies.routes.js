import { Router } from "express";
import { searchPoiskkinoMovies } from "../services/poiskkino.js";

const router = Router();

router.get("/search", async (req, res, next) => {
  try {
    const q = String(req.query.q || "").trim();

    if (q.length < 2) {
      return res.status(400).json({ error: "q must be at least 2 characters" });
    }

    const movies = await searchPoiskkinoMovies(q);
    return res.json({ results: movies });
  } catch (error) {
    return next(error);
  }
});

export default router;
