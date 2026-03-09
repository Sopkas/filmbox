import { Router } from "express";
import { z } from "zod";
import { pool, query } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const router = Router();
router.use(requireAuth);

const positiveIntSchema = z.coerce.number().int().positive();

const collectionIdParamsSchema = z.object({
  id: positiveIntSchema
});

const collectionMovieParamsSchema = z.object({
  id: positiveIntSchema,
  movieId: positiveIntSchema
});

const createCollectionBodySchema = z.object({
  name: z.string().trim().min(1).max(255)
});

const collectionOrderBodySchema = z.object({
  movieIds: z
    .array(positiveIntSchema)
    .max(500)
    .refine((ids) => new Set(ids).size === ids.length, "movieIds must not contain duplicates")
});

const optionalYearSchema = z
  .union([
    z.coerce.number().int().min(1888).max(2100),
    z.literal(""),
    z.null(),
    z.undefined()
  ])
  .transform((value) => (value === "" || value === undefined ? null : value));

const addMovieBodySchema = z.object({
  externalId: positiveIntSchema.optional(),
  title: z.string().trim().min(1).max(255),
  posterUrl: z.string().trim().max(2048).nullish(),
  year: optionalYearSchema
});

let collectionsSchemaReady = null;

async function ensureCollectionsSchema() {
  if (!collectionsSchemaReady) {
    collectionsSchemaReady = (async () => {
      await query(
        `CREATE TABLE IF NOT EXISTS user_collections (
           id SERIAL PRIMARY KEY,
           user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
           name VARCHAR(255) NOT NULL,
           created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
           updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
         )`
      );

      await query(`ALTER TABLE user_collections ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`);

      await query(
        `CREATE TABLE IF NOT EXISTS user_collection_items (
           collection_id INTEGER NOT NULL REFERENCES user_collections(id) ON DELETE CASCADE,
           movie_id INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
           sort_order INTEGER NOT NULL DEFAULT 0,
           added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
           PRIMARY KEY (collection_id, movie_id)
         )`
      );

      await query(`ALTER TABLE user_collection_items ADD COLUMN IF NOT EXISTS sort_order INTEGER`);
      await query(`ALTER TABLE user_collection_items ALTER COLUMN sort_order SET DEFAULT 0`);
      await query(`UPDATE user_collection_items SET sort_order = 0 WHERE sort_order IS NULL`);
      await query(
        `WITH ranked AS (
           SELECT
             collection_id,
             movie_id,
             ROW_NUMBER() OVER (
               PARTITION BY collection_id
               ORDER BY sort_order ASC, added_at ASC, movie_id ASC
             ) AS next_order
           FROM user_collection_items
         )
         UPDATE user_collection_items ci
         SET sort_order = ranked.next_order
         FROM ranked
         WHERE ci.collection_id = ranked.collection_id
           AND ci.movie_id = ranked.movie_id
           AND ci.sort_order <> ranked.next_order`
      );
      await query(
        `CREATE UNIQUE INDEX IF NOT EXISTS user_collection_items_collection_sort_idx
         ON user_collection_items (collection_id, sort_order)`
      );
    })().catch((error) => {
      collectionsSchemaReady = null;
      throw error;
    });
  }

  return collectionsSchemaReady;
}

function parseSafeYear(year) {
  const safeYear = year === null || year === undefined || year === "" ? null : Number(year);
  if (safeYear !== null && (!Number.isInteger(safeYear) || safeYear < 1888 || safeYear > 2100)) {
    return { ok: false };
  }
  return { ok: true, value: safeYear };
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
    `SELECT id FROM movies
     WHERE external_id IS NULL AND LOWER(title) = LOWER($1) AND COALESCE(year, -1) = COALESCE($2, -1)`,
    [title, year ?? null]
  );
  if (existing.rowCount > 0) {
    return existing.rows[0].id;
  }

  try {
    const inserted = await query(
      `INSERT INTO movies (external_id, title, poster_url, year)
       VALUES (NULL, $1, $2, $3) RETURNING id`,
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
    `SELECT id FROM movies
     WHERE external_id IS NULL AND LOWER(title) = LOWER($1) AND COALESCE(year, -1) = COALESCE($2, -1)`,
    [title, year ?? null]
  );
  return fallback.rows[0].id;
}

async function normalizeCollectionOrder(db, collectionId) {
  await db.query(
    `WITH ranked AS (
       SELECT
         collection_id,
         movie_id,
         ROW_NUMBER() OVER (
           PARTITION BY collection_id
           ORDER BY sort_order ASC, added_at ASC, movie_id ASC
         ) AS next_order
       FROM user_collection_items
       WHERE collection_id = $1
     )
     UPDATE user_collection_items ci
     SET sort_order = ranked.next_order
     FROM ranked
     WHERE ci.collection_id = ranked.collection_id
       AND ci.movie_id = ranked.movie_id
       AND ci.sort_order <> ranked.next_order`,
    [collectionId]
  );
}

async function getOwnedCollection(userId, collectionId) {
  const result = await query(
    `SELECT id, name, created_at AS "createdAt", updated_at AS "updatedAt"
     FROM user_collections
     WHERE id = $1 AND user_id = $2`,
    [collectionId, userId]
  );
  return result.rowCount > 0 ? result.rows[0] : null;
}

async function getCollectionMovies(collectionId) {
  const result = await query(
    `SELECT
       m.id AS "movieId",
       m.title,
       m.year,
       m.poster_url AS "posterUrl",
       m.external_id AS "externalId",
       ci.sort_order AS "sortOrder",
       ci.added_at AS "addedAt"
     FROM user_collection_items ci
     JOIN movies m ON m.id = ci.movie_id
     WHERE ci.collection_id = $1
     ORDER BY ci.sort_order ASC, ci.added_at ASC`,
    [collectionId]
  );
  return result.rows;
}

async function getCollectionMovieIds(collectionId) {
  const result = await query(
    `SELECT movie_id AS id
     FROM user_collection_items
     WHERE collection_id = $1
     ORDER BY sort_order ASC, added_at ASC`,
    [collectionId]
  );
  return result.rows.map((row) => row.id);
}

async function getCollectionPayload(userId, collectionId) {
  const collection = await getOwnedCollection(userId, collectionId);
  if (!collection) {
    return null;
  }
  const movies = await getCollectionMovies(collectionId);
  return { ...collection, movies };
}

router.get("/", async (req, res, next) => {
  try {
    await ensureCollectionsSchema();
    const result = await query(
      `SELECT
         c.id,
         c.name,
         c.created_at AS "createdAt",
         c.updated_at AS "updatedAt",
         (
           SELECT json_build_object(
             'movieId', m.id,
             'title', m.title,
             'posterUrl', m.poster_url
           )
           FROM user_collection_items ci2
           JOIN movies m ON m.id = ci2.movie_id
           WHERE ci2.collection_id = c.id
           ORDER BY ci2.sort_order ASC, ci2.added_at ASC
           LIMIT 1
         ) AS "coverMovie",
         (
           SELECT COUNT(*)::int
           FROM user_collection_items
           WHERE collection_id = c.id
         ) AS "movieCount"
       FROM user_collections c
       WHERE c.user_id = $1
       ORDER BY c.updated_at DESC, c.created_at DESC`,
      [req.user.id]
    );
    return res.json({ collections: result.rows });
  } catch (error) {
    return next(error);
  }
});

router.post("/", validate({ body: createCollectionBodySchema }), async (req, res, next) => {
  try {
    await ensureCollectionsSchema();
    const { name } = req.body;
    const result = await query(
      `INSERT INTO user_collections (user_id, name, created_at, updated_at)
       VALUES ($1, $2, NOW(), NOW())
       RETURNING id, name, created_at AS "createdAt", updated_at AS "updatedAt"`,
      [req.user.id, name]
    );
    req.log?.info("collections.create.success", { collectionId: result.rows[0].id });
    return res.status(201).json({ collection: result.rows[0] });
  } catch (error) {
    return next(error);
  }
});

router.patch("/:id", validate({ params: collectionIdParamsSchema, body: createCollectionBodySchema }), async (req, res, next) => {
  try {
    await ensureCollectionsSchema();
    const { id: collectionId } = req.params;
    const { name } = req.body;

    const result = await query(
      `UPDATE user_collections
       SET name = $3,
           updated_at = NOW()
       WHERE id = $1
         AND user_id = $2
       RETURNING id, name, created_at AS "createdAt", updated_at AS "updatedAt"`,
      [collectionId, req.user.id, name]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Collection not found" });
    }

    req.log?.info("collections.rename.success", { collectionId });
    return res.json({ collection: result.rows[0] });
  } catch (error) {
    return next(error);
  }
});

router.get("/:id", validate({ params: collectionIdParamsSchema }), async (req, res, next) => {
  try {
    await ensureCollectionsSchema();
    const { id: collectionId } = req.params;
    const payload = await getCollectionPayload(req.user.id, collectionId);
    if (!payload) {
      return res.status(404).json({ error: "Collection not found" });
    }

    return res.json({ collection: payload });
  } catch (error) {
    return next(error);
  }
});

router.delete("/:id", validate({ params: collectionIdParamsSchema }), async (req, res, next) => {
  try {
    await ensureCollectionsSchema();
    const { id: collectionId } = req.params;
    await query(`DELETE FROM user_collections WHERE id = $1 AND user_id = $2`, [collectionId, req.user.id]);
    req.log?.info("collections.delete.success", { collectionId });
    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
});

router.post("/:id/add", validate({ params: collectionIdParamsSchema, body: addMovieBodySchema }), async (req, res, next) => {
  try {
    await ensureCollectionsSchema();
    const { id: collectionId } = req.params;
    const { externalId, title, posterUrl, year } = req.body;

    const collection = await getOwnedCollection(req.user.id, collectionId);
    if (!collection) {
      return res.status(404).json({ error: "Collection not found" });
    }

    let movieId;
    if (externalId) {
      const yearResult = parseSafeYear(year);
      if (!yearResult.ok) {
        return res.status(400).json({ error: "Invalid year" });
      }
      movieId = await getOrCreateMovieByExternalId({
        externalId,
        title: String(title).trim(),
        posterUrl,
        year: yearResult.value
      });
    } else {
      const yearResult = parseSafeYear(year);
      if (!yearResult.ok) {
        return res.status(400).json({ error: "Invalid year" });
      }
      movieId = await getOrCreateManualMovie({
        title: String(title).trim(),
        year: yearResult.value,
        posterUrl
      });
    }

    await query(
      `INSERT INTO user_collection_items (collection_id, movie_id, sort_order, added_at)
       VALUES (
         $1,
         $2,
         COALESCE((SELECT MAX(sort_order) + 1 FROM user_collection_items WHERE collection_id = $1), 1),
         NOW()
       )
       ON CONFLICT (collection_id, movie_id) DO NOTHING`,
      [collectionId, movieId]
    );

    await normalizeCollectionOrder({ query }, collectionId);

    req.log?.info("collections.add_movie.success", { collectionId, movieId });
    return res.status(201).json({ ok: true });
  } catch (error) {
    return next(error);
  }
});

router.put("/:id/order", validate({ params: collectionIdParamsSchema, body: collectionOrderBodySchema }), async (req, res, next) => {
  const client = await pool.connect();
  try {
    await ensureCollectionsSchema();
    const { id: collectionId } = req.params;
    const { movieIds } = req.body;

    const collection = await getOwnedCollection(req.user.id, collectionId);
    if (!collection) {
      return res.status(404).json({ error: "Collection not found" });
    }

    const existingMovieIds = await getCollectionMovieIds(collectionId);
    if (existingMovieIds.length !== movieIds.length) {
      return res.status(400).json({ error: "movieIds must contain all collection movies" });
    }

    const existingSet = new Set(existingMovieIds);
    if (movieIds.some((movieId) => !existingSet.has(movieId))) {
      return res.status(400).json({ error: "movieIds must contain all collection movies" });
    }

    await client.query("BEGIN");
    for (let index = 0; index < movieIds.length; index += 1) {
      await client.query(
        `UPDATE user_collection_items
         SET sort_order = $3
         WHERE collection_id = $1
           AND movie_id = $2`,
        [collectionId, movieIds[index], index + 1]
      );
    }
    await normalizeCollectionOrder(client, collectionId);
    await client.query(
      `UPDATE user_collections
       SET updated_at = NOW()
       WHERE id = $1`,
      [collectionId]
    );
    await client.query("COMMIT");

    const payload = await getCollectionPayload(req.user.id, collectionId);
    req.log?.info("collections.reorder.success", { collectionId, count: movieIds.length });
    return res.json({ collection: payload });
  } catch (error) {
    await client.query("ROLLBACK");
    return next(error);
  } finally {
    client.release();
  }
});

router.delete("/:id/movies/:movieId", validate({ params: collectionMovieParamsSchema }), async (req, res, next) => {
  const client = await pool.connect();
  try {
    await ensureCollectionsSchema();
    const { id: collectionId, movieId } = req.params;

    const collection = await getOwnedCollection(req.user.id, collectionId);
    if (!collection) {
      return res.status(404).json({ error: "Collection not found" });
    }

    await client.query("BEGIN");
    await client.query(
      `DELETE FROM user_collection_items
       WHERE collection_id = $1
         AND movie_id = $2`,
      [collectionId, movieId]
    );
    await normalizeCollectionOrder(client, collectionId);
    await client.query(
      `UPDATE user_collections
       SET updated_at = NOW()
       WHERE id = $1`,
      [collectionId]
    );
    await client.query("COMMIT");

    req.log?.info("collections.remove_movie.success", { collectionId, movieId });
    return res.json({ ok: true });
  } catch (error) {
    await client.query("ROLLBACK");
    return next(error);
  } finally {
    client.release();
  }
});

export default router;
