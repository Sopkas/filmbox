import { Router } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate.js";
import { searchPoiskkinoMovies } from "../services/poiskkino.js";

const router = Router();

const searchQuerySchema = z.object({
  q: z.string().trim().min(2).max(120)
});

router.get("/search", validate({ query: searchQuerySchema }), async (req, res, next) => {
  try {
    const { q } = req.query;
    const { results, meta } = await searchPoiskkinoMovies(q);
    req.log?.info("movies.search.success", {
      queryLength: q.length,
      results: results.length,
      source: meta.source,
      cacheHit: meta.cacheHit,
      throttleDelayMs: meta.throttleDelayMs
    });
    return res.json({ results, meta });
  } catch (error) {
    return next(error);
  }
});

export default router;
