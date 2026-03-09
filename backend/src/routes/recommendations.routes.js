import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { recommendMovieWithAi } from "../services/recommendations.js";

const router = Router();

router.use(requireAuth);

const currentYear = new Date().getFullYear() + 1;

const genreSchema = z.string().trim().min(1).max(40);
const optionalYearSchema = z
  .union([
    z.coerce.number().int().min(1888).max(currentYear),
    z.literal(""),
    z.null(),
    z.undefined()
  ])
  .transform((value) => (value === "" || value === null || value === undefined ? null : Number(value)));

const positiveIntSchema = z.coerce.number().int().positive();

const recommendMovieBodySchema = z.object({
  genres: z.array(genreSchema).max(5).optional().default([]),
  yearFrom: optionalYearSchema.optional().default(null),
  country: z.string().trim().max(80).optional().default(""),
  vibePrompt: z.string().trim().max(400).optional().default(""),
  excludeTitles: z.array(z.string().trim().min(1).max(255)).max(50).optional().default([]),
  excludeExternalIds: z.array(positiveIntSchema).max(50).optional().default([])
});

router.post("/movie", validate({ body: recommendMovieBodySchema }), async (req, res, next) => {
  try {
    const recommendationPayload = await recommendMovieWithAi(req.body);
    req.log?.info("recommendations.movie.success", {
      userId: req.user?.id,
      genresCount: req.body.genres.length,
      hasCountry: Boolean(req.body.country),
      hasVibePrompt: Boolean(req.body.vibePrompt),
      hasYearFrom: Boolean(req.body.yearFrom),
      model: recommendationPayload.meta.model
    });
    return res.json(recommendationPayload);
  } catch (error) {
    req.log?.warn("recommendations.movie.failed", {
      userId: req.user?.id,
      message: error.message,
      statusCode: error.statusCode
    });
    return next(error);
  }
});

export default router;
