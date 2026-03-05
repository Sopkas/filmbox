import { Router } from "express";
import { pool, query } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth);

let reviewListsSchemaReady = null;

async function ensureReviewListsSchema() {
  if (!reviewListsSchemaReady) {
    reviewListsSchemaReady = (async () => {
      await query(
        `CREATE TABLE IF NOT EXISTS user_top10 (
           id SERIAL PRIMARY KEY,
           user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
           review_id INTEGER NOT NULL REFERENCES user_reviews(id) ON DELETE CASCADE,
           position SMALLINT NOT NULL CHECK (position BETWEEN 1 AND 10),
           created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
           updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
           UNIQUE (user_id, review_id)
         )`
      );
      await query(
        `CREATE UNIQUE INDEX IF NOT EXISTS user_top10_user_position_idx
         ON user_top10 (user_id, position)`
      );
      await query(
        `CREATE TABLE IF NOT EXISTS user_watch_later (
           user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
           movie_id INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
           added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
           PRIMARY KEY (user_id, movie_id)
         )`
      );
      await query(
        `CREATE TABLE IF NOT EXISTS user_abandoned (
           user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
           movie_id INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
           added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
           PRIMARY KEY (user_id, movie_id)
         )`
      );
      await query(`ALTER TABLE user_abandoned ADD COLUMN IF NOT EXISTS stopped_season SMALLINT`);
      await query(`ALTER TABLE user_abandoned ADD COLUMN IF NOT EXISTS stopped_episode SMALLINT`);

      /* ---- Migrate rating column to support half-stars ---- */
      const colInfo = await query(
        `SELECT data_type FROM information_schema.columns
         WHERE table_name = 'user_reviews' AND column_name = 'rating'`
      );
      if (colInfo.rows.length > 0 && colInfo.rows[0].data_type === 'smallint') {
        await query(`ALTER TABLE user_reviews DROP CONSTRAINT IF EXISTS user_reviews_rating_check`);
        await query(`ALTER TABLE user_reviews ALTER COLUMN rating TYPE NUMERIC(2,1)`);
        await query(
          `ALTER TABLE user_reviews ADD CONSTRAINT user_reviews_rating_check
           CHECK (rating >= 0.5 AND rating <= 5 AND (rating * 2) = FLOOR(rating * 2))`
        );
      }
    })().catch((error) => {
      reviewListsSchemaReady = null;
      throw error;
    });
  }
  return reviewListsSchemaReady;
}

function normalizeRating(value) {
  const numeric = Number(value);
  if (Number.isNaN(numeric) || numeric < 0.5 || numeric > 5) {
    return null;
  }
  // Only allow 0.5 steps: 0.5, 1, 1.5, 2, ... 5
  if (Math.round(numeric * 2) !== numeric * 2) {
    return null;
  }
  return numeric;
}

async function getOrCreateMovieByExternalId({ externalId, title, posterUrl, year }) {
  const existing = await query("SELECT id FROM movies WHERE external_id = $1", [externalId]);
  if (existing.rowCount > 0) {
    return existing.rows[0].id;
  }

  const inserted = await query(
    `INSERT INTO movies (external_id, title, poster_url, year)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (external_id)
     DO UPDATE SET title = EXCLUDED.title,
                   poster_url = EXCLUDED.poster_url,
                   year = EXCLUDED.year
     RETURNING id`,
    [externalId, title, posterUrl || null, year ?? null]
  );

  return inserted.rows[0].id;
}

async function getOrCreateManualMovie({ title, year, posterUrl }) {
  const existing = await query(
    `SELECT id
     FROM movies
     WHERE external_id IS NULL
       AND LOWER(title) = LOWER($1)
       AND COALESCE(year, -1) = COALESCE($2, -1)`,
    [title, year ?? null]
  );

  if (existing.rowCount > 0) {
    return existing.rows[0].id;
  }

  try {
    const inserted = await query(
      `INSERT INTO movies (external_id, title, poster_url, year)
       VALUES (NULL, $1, $2, $3)
       RETURNING id`,
      [title, posterUrl || null, year ?? null]
    );

    if (inserted.rowCount > 0) {
      return inserted.rows[0].id;
    }
  } catch (error) {
    if (error.code !== "23505") {
      throw error;
    }
  }

  const fallback = await query(
    `SELECT id
     FROM movies
     WHERE external_id IS NULL
       AND LOWER(title) = LOWER($1)
       AND COALESCE(year, -1) = COALESCE($2, -1)`,
    [title, year ?? null]
  );

  return fallback.rows[0].id;
}

async function upsertUserReview({ userId, movieId, rating, comment }) {
  const result = await query(
    `INSERT INTO user_reviews (user_id, movie_id, rating, comment)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, movie_id)
     DO UPDATE SET rating = EXCLUDED.rating,
                   comment = EXCLUDED.comment,
                   updated_at = NOW()
     RETURNING id, user_id AS "userId", movie_id AS "movieId", rating, comment, created_at AS "createdAt", updated_at AS "updatedAt"`,
    [userId, movieId, rating, comment || ""]
  );

  return result.rows[0];
}

async function getManualTop10(userId) {
  await ensureReviewListsSchema();

  const topResult = await query(
    `SELECT
       r.id,
       m.title,
       m.year,
       m.poster_url AS "posterUrl",
       r.rating,
       r.comment,
       r.created_at AS "createdAt",
       t.position AS "topPosition"
     FROM user_top10 t
     JOIN user_reviews r ON r.id = t.review_id AND r.user_id = t.user_id
     JOIN movies m ON m.id = r.movie_id
     WHERE t.user_id = $1
     ORDER BY t.position ASC
     LIMIT 10`,
    [userId]
  );

  return topResult.rows;
}

async function getMovieListByType(userId, type) {
  await ensureReviewListsSchema();

  const tableName = type === "watchLater" ? "user_watch_later" : "user_abandoned";
  const extraCols = type === "abandoned"
    ? `, l.stopped_season AS "stoppedSeason", l.stopped_episode AS "stoppedEpisode"`
    : "";
  const result = await query(
    `SELECT
       m.id AS "movieId",
       m.title,
       m.year,
       m.poster_url AS "posterUrl",
       m.external_id AS "externalId",
       l.added_at AS "addedAt"${extraCols}
     FROM ${tableName} l
     JOIN movies m ON m.id = l.movie_id
     WHERE l.user_id = $1
     ORDER BY l.added_at DESC`,
    [userId]
  );

  return result.rows;
}

function normalizeMovieIdList(rawList) {
  const parsed = Array.isArray(rawList)
    ? rawList.map((value) => Number(value))
    : null;

  if (!parsed) {
    return { ok: false, error: "movieIds must be an array" };
  }

  if (parsed.some((id) => !Number.isInteger(id) || id <= 0)) {
    return { ok: false, error: "movieIds must contain positive integers" };
  }

  const uniqueCount = new Set(parsed).size;
  if (uniqueCount !== parsed.length) {
    return { ok: false, error: "movieIds must not contain duplicates" };
  }

  return { ok: true, ids: parsed };
}

function normalizeReviewIdList(rawList) {
  const parsed = Array.isArray(rawList)
    ? rawList.map((value) => Number(value))
    : null;

  if (!parsed) {
    return { ok: false, error: "reviewIds must be an array" };
  }

  if (parsed.some((id) => !Number.isInteger(id) || id <= 0)) {
    return { ok: false, error: "reviewIds must contain positive integers" };
  }

  const uniqueCount = new Set(parsed).size;
  if (uniqueCount !== parsed.length) {
    return { ok: false, error: "reviewIds must not contain duplicates" };
  }

  return { ok: true, ids: parsed };
}

async function ensureReviewsOwnership(userId, reviewIds) {
  if (reviewIds.length === 0) {
    return true;
  }

  const ownership = await query(
    `SELECT id
     FROM user_reviews
     WHERE user_id = $1
       AND id = ANY($2::int[])`,
    [userId, reviewIds]
  );

  return ownership.rowCount === reviewIds.length;
}

async function ensureMoviesExist(movieIds) {
  if (movieIds.length === 0) {
    return true;
  }

  const result = await query(
    `SELECT id FROM movies WHERE id = ANY($1::int[])`,
    [movieIds]
  );

  return result.rowCount === movieIds.length;
}

async function replaceMovieList({ userId, movieIds, type }) {
  await ensureReviewListsSchema();
  const tableName = type === "watchLater" ? "user_watch_later" : "user_abandoned";

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM ${tableName} WHERE user_id = $1`, [userId]);
    for (let index = 0; index < movieIds.length; index += 1) {
      const movieId = movieIds[index];
      await client.query(
        `INSERT INTO ${tableName} (user_id, movie_id, added_at)
         VALUES ($1, $2, NOW())`,
        [userId, movieId]
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function parseSafeYear(year) {
  const safeYear = year === null || year === undefined || year === "" ? null : Number(year);
  if (safeYear !== null && (!Number.isInteger(safeYear) || safeYear < 1888 || safeYear > 2100)) {
    return { ok: false };
  }
  return { ok: true, value: safeYear };
}

router.post("/", async (req, res, next) => {
  try {
    const { externalId, title, posterUrl, year, rating, comment } = req.body;

    if (!externalId || !title) {
      return res.status(400).json({ error: "externalId and title are required" });
    }

    const safeRating = normalizeRating(rating);
    if (!safeRating) {
      return res.status(400).json({ error: "rating must be an integer from 1 to 5" });
    }

    const safeExternalId = Number(externalId);
    if (!Number.isInteger(safeExternalId) || safeExternalId <= 0) {
      return res.status(400).json({ error: "externalId must be a positive integer" });
    }

    const yearResult = parseSafeYear(year);
    if (!yearResult.ok) {
      return res.status(400).json({ error: "year must be between 1888 and 2100" });
    }

    const movieId = await getOrCreateMovieByExternalId({
      externalId: safeExternalId,
      title: String(title).trim(),
      posterUrl,
      year: yearResult.value
    });

    const review = await upsertUserReview({
      userId: req.user.id,
      movieId,
      rating: safeRating,
      comment: String(comment || "").trim()
    });

    // Auto-remove from watch_later when a review is created
    await query(
      `DELETE FROM user_watch_later WHERE user_id = $1 AND movie_id = $2`,
      [req.user.id, movieId]
    ).catch(() => { });

    return res.status(201).json({ review });
  } catch (error) {
    return next(error);
  }
});

router.post("/manual", async (req, res, next) => {
  try {
    const { title, year, rating, comment, posterUrl } = req.body;

    if (!title) {
      return res.status(400).json({ error: "title is required" });
    }

    const safeRating = normalizeRating(rating);
    if (!safeRating) {
      return res.status(400).json({ error: "rating must be an integer from 1 to 5" });
    }

    const yearResult = parseSafeYear(year);
    if (!yearResult.ok) {
      return res.status(400).json({ error: "year must be between 1888 and 2100" });
    }

    const movieId = await getOrCreateManualMovie({
      title: String(title).trim(),
      year: yearResult.value,
      posterUrl
    });

    const review = await upsertUserReview({
      userId: req.user.id,
      movieId,
      rating: safeRating,
      comment: String(comment || "").trim()
    });

    // Auto-remove from watch_later when a review is created
    await query(
      `DELETE FROM user_watch_later WHERE user_id = $1 AND movie_id = $2`,
      [req.user.id, movieId]
    ).catch(() => { });

    return res.status(201).json({ review });
  } catch (error) {
    return next(error);
  }
});

router.get("/me", async (req, res, next) => {
  try {
    await ensureReviewListsSchema();

    const sortByParam = String(req.query.sortBy || "createdAt");
    const orderParam = String(req.query.order || "desc").toUpperCase();
    const limitParam = Number(req.query.limit || 50);

    const sortByMap = {
      title: "m.title",
      rating: "r.rating",
      createdAt: "r.created_at"
    };

    const sortColumn = sortByMap[sortByParam] || sortByMap.createdAt;
    const sortOrder = orderParam === "ASC" ? "ASC" : "DESC";
    const limit = Number.isInteger(limitParam) ? Math.max(1, Math.min(100, limitParam)) : 50;

    const listResult = await query(
      `SELECT
         r.id,
         r.rating,
         r.comment,
         r.created_at AS "createdAt",
         r.updated_at AS "updatedAt",
         m.id AS "movieId",
         m.external_id AS "externalId",
         m.title,
         m.poster_url AS "posterUrl",
         m.year,
         t.position AS "topPosition"
       FROM user_reviews r
       JOIN movies m ON m.id = r.movie_id
       LEFT JOIN user_top10 t ON t.review_id = r.id AND t.user_id = r.user_id
       WHERE r.user_id = $1
       ORDER BY ${sortColumn} ${sortOrder}, r.created_at DESC
       LIMIT $2`,
      [req.user.id, limit]
    );

    const [top10, watchLater, abandoned] = await Promise.all([
      getManualTop10(req.user.id),
      getMovieListByType(req.user.id, "watchLater"),
      getMovieListByType(req.user.id, "abandoned")
    ]);

    return res.json({
      items: listResult.rows,
      top10,
      watchLater,
      abandoned
    });
  } catch (error) {
    return next(error);
  }
});

router.put("/me/top10", async (req, res, next) => {
  try {
    await ensureReviewListsSchema();

    const orderedReviewIds = Array.isArray(req.body?.orderedReviewIds)
      ? req.body.orderedReviewIds.map((value) => Number(value))
      : null;

    if (!orderedReviewIds) {
      return res.status(400).json({ error: "orderedReviewIds must be an array" });
    }

    if (orderedReviewIds.length > 10) {
      return res.status(400).json({ error: "Top-10 can contain at most 10 reviews" });
    }

    if (orderedReviewIds.some((id) => !Number.isInteger(id) || id <= 0)) {
      return res.status(400).json({ error: "orderedReviewIds must contain positive integers" });
    }

    const uniqueCount = new Set(orderedReviewIds).size;
    if (uniqueCount !== orderedReviewIds.length) {
      return res.status(400).json({ error: "orderedReviewIds must not contain duplicates" });
    }

    if (orderedReviewIds.length > 0) {
      const ownership = await query(
        `SELECT id
         FROM user_reviews
         WHERE user_id = $1
           AND id = ANY($2::int[])`,
        [req.user.id, orderedReviewIds]
      );

      if (ownership.rowCount !== orderedReviewIds.length) {
        return res.status(400).json({ error: "All reviews must belong to current user" });
      }
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM user_top10 WHERE user_id = $1", [req.user.id]);
      for (let index = 0; index < orderedReviewIds.length; index += 1) {
        const reviewId = orderedReviewIds[index];
        await client.query(
          `INSERT INTO user_top10 (user_id, review_id, position, updated_at)
           VALUES ($1, $2, $3, NOW())`,
          [req.user.id, reviewId, index + 1]
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    const top10 = await getManualTop10(req.user.id);
    return res.json({ top10 });
  } catch (error) {
    return next(error);
  }
});

/* ---- Watch Later ---- */

router.post("/me/watch-later/add", async (req, res, next) => {
  try {
    await ensureReviewListsSchema();

    const { externalId, title, posterUrl, year } = req.body;

    if (!title) {
      return res.status(400).json({ error: "title is required" });
    }

    let movieId;
    if (externalId) {
      const safeExternalId = Number(externalId);
      if (!Number.isInteger(safeExternalId) || safeExternalId <= 0) {
        return res.status(400).json({ error: "externalId must be a positive integer" });
      }
      const yearResult = parseSafeYear(year);
      if (!yearResult.ok) {
        return res.status(400).json({ error: "year must be between 1888 and 2100" });
      }
      movieId = await getOrCreateMovieByExternalId({
        externalId: safeExternalId,
        title: String(title).trim(),
        posterUrl,
        year: yearResult.value
      });
    } else {
      const yearResult = parseSafeYear(year);
      if (!yearResult.ok) {
        return res.status(400).json({ error: "year must be between 1888 and 2100" });
      }
      movieId = await getOrCreateManualMovie({
        title: String(title).trim(),
        year: yearResult.value,
        posterUrl
      });
    }

    await query(
      `INSERT INTO user_watch_later (user_id, movie_id, added_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id, movie_id) DO NOTHING`,
      [req.user.id, movieId]
    );

    const watchLater = await getMovieListByType(req.user.id, "watchLater");
    return res.json({ watchLater });
  } catch (error) {
    return next(error);
  }
});

router.put("/me/watch-later", async (req, res, next) => {
  try {
    await ensureReviewListsSchema();

    const normalized = normalizeMovieIdList(req.body?.movieIds);
    if (!normalized.ok) {
      return res.status(400).json({ error: normalized.error });
    }

    const moviesExist = await ensureMoviesExist(normalized.ids);
    if (!moviesExist) {
      return res.status(400).json({ error: "All movies must exist" });
    }

    await replaceMovieList({
      userId: req.user.id,
      movieIds: normalized.ids,
      type: "watchLater"
    });

    const watchLater = await getMovieListByType(req.user.id, "watchLater");
    return res.json({ watchLater });
  } catch (error) {
    return next(error);
  }
});

router.delete("/me/watch-later/:movieId", async (req, res, next) => {
  try {
    await ensureReviewListsSchema();

    const movieId = Number(req.params.movieId);
    if (!Number.isInteger(movieId) || movieId <= 0) {
      return res.status(400).json({ error: "movieId must be a positive integer" });
    }

    await query(
      `DELETE FROM user_watch_later WHERE user_id = $1 AND movie_id = $2`,
      [req.user.id, movieId]
    );

    const watchLater = await getMovieListByType(req.user.id, "watchLater");
    return res.json({ watchLater });
  } catch (error) {
    return next(error);
  }
});

/* ---- Abandoned ---- */

router.post("/me/abandoned/add", async (req, res, next) => {
  try {
    await ensureReviewListsSchema();

    const { externalId, title, posterUrl, year, stoppedSeason, stoppedEpisode } = req.body;

    if (!title) {
      return res.status(400).json({ error: "title is required" });
    }

    // Validate optional season/episode
    const safeStoppedSeason = stoppedSeason != null ? Number(stoppedSeason) : null;
    const safeStoppedEpisode = stoppedEpisode != null ? Number(stoppedEpisode) : null;
    if (safeStoppedSeason !== null && (!Number.isInteger(safeStoppedSeason) || safeStoppedSeason < 1)) {
      return res.status(400).json({ error: "stoppedSeason must be a positive integer" });
    }
    if (safeStoppedEpisode !== null && (!Number.isInteger(safeStoppedEpisode) || safeStoppedEpisode < 1)) {
      return res.status(400).json({ error: "stoppedEpisode must be a positive integer" });
    }

    let movieId;
    if (externalId) {
      const safeExternalId = Number(externalId);
      if (!Number.isInteger(safeExternalId) || safeExternalId <= 0) {
        return res.status(400).json({ error: "externalId must be a positive integer" });
      }
      const yearResult = parseSafeYear(year);
      if (!yearResult.ok) {
        return res.status(400).json({ error: "year must be between 1888 and 2100" });
      }
      movieId = await getOrCreateMovieByExternalId({
        externalId: safeExternalId,
        title: String(title).trim(),
        posterUrl,
        year: yearResult.value
      });
    } else {
      const yearResult = parseSafeYear(year);
      if (!yearResult.ok) {
        return res.status(400).json({ error: "year must be between 1888 and 2100" });
      }
      movieId = await getOrCreateManualMovie({
        title: String(title).trim(),
        year: yearResult.value,
        posterUrl
      });
    }

    await query(
      `INSERT INTO user_abandoned (user_id, movie_id, stopped_season, stopped_episode, added_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (user_id, movie_id) DO UPDATE
         SET stopped_season = EXCLUDED.stopped_season,
             stopped_episode = EXCLUDED.stopped_episode`,
      [req.user.id, movieId, safeStoppedSeason, safeStoppedEpisode]
    );

    const abandoned = await getMovieListByType(req.user.id, "abandoned");
    return res.json({ abandoned });
  } catch (error) {
    return next(error);
  }
});

router.put("/me/abandoned", async (req, res, next) => {
  try {
    await ensureReviewListsSchema();

    const normalized = normalizeMovieIdList(req.body?.movieIds);
    if (!normalized.ok) {
      return res.status(400).json({ error: normalized.error });
    }

    const moviesExist = await ensureMoviesExist(normalized.ids);
    if (!moviesExist) {
      return res.status(400).json({ error: "All movies must exist" });
    }

    await replaceMovieList({
      userId: req.user.id,
      movieIds: normalized.ids,
      type: "abandoned"
    });

    const abandoned = await getMovieListByType(req.user.id, "abandoned");
    return res.json({ abandoned });
  } catch (error) {
    return next(error);
  }
});

router.delete("/me/abandoned/:movieId", async (req, res, next) => {
  try {
    await ensureReviewListsSchema();

    const movieId = Number(req.params.movieId);
    if (!Number.isInteger(movieId) || movieId <= 0) {
      return res.status(400).json({ error: "movieId must be a positive integer" });
    }

    await query(
      `DELETE FROM user_abandoned WHERE user_id = $1 AND movie_id = $2`,
      [req.user.id, movieId]
    );

    const abandoned = await getMovieListByType(req.user.id, "abandoned");
    return res.json({ abandoned });
  } catch (error) {
    return next(error);
  }
});

export default router;
