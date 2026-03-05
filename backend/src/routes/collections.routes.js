import { Router } from "express";
import { pool, query } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { searchPoiskkinoMovies } from "../services/poiskkino.js";

const router = Router();
router.use(requireAuth);

let collectionsSchemaReady = null;

async function ensureCollectionsSchema() {
    if (!collectionsSchemaReady) {
        collectionsSchemaReady = (async () => {
            await query(
                `CREATE TABLE IF NOT EXISTS user_collections (
           id SERIAL PRIMARY KEY,
           user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
           name VARCHAR(255) NOT NULL,
           created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
         )`
            );
            await query(
                `CREATE TABLE IF NOT EXISTS user_collection_items (
           collection_id INTEGER NOT NULL REFERENCES user_collections(id) ON DELETE CASCADE,
           movie_id INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
           added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
           PRIMARY KEY (collection_id, movie_id)
         )`
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
    if (existing.rowCount > 0) return existing.rows[0].id;

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
    if (existing.rowCount > 0) return existing.rows[0].id;

    try {
        const inserted = await query(
            `INSERT INTO movies (external_id, title, poster_url, year)
       VALUES (NULL, $1, $2, $3) RETURNING id`,
            [title, posterUrl || null, year ?? null]
        );
        if (inserted.rowCount > 0) return inserted.rows[0].id;
    } catch (error) {
        if (error.code !== "23505") throw error;
    }

    const fallback = await query(
        `SELECT id FROM movies
     WHERE external_id IS NULL AND LOWER(title) = LOWER($1) AND COALESCE(year, -1) = COALESCE($2, -1)`,
        [title, year ?? null]
    );
    return fallback.rows[0].id;
}

// GET /api/collections - get all collections for user
router.get("/", async (req, res, next) => {
    try {
        await ensureCollectionsSchema();
        const result = await query(
            `SELECT
         c.id,
         c.name,
         c.created_at AS "createdAt",
         (
           SELECT json_agg(
             json_build_object(
               'movieId', m.id,
               'title', m.title,
               'posterUrl', m.poster_url
             )
           )
           FROM (
             SELECT m2.* FROM user_collection_items ci2
             JOIN movies m2 ON m2.id = ci2.movie_id
             WHERE ci2.collection_id = c.id
             ORDER BY ci2.added_at DESC
             LIMIT 4
           ) m
         ) AS "previewMovies",
         (SELECT COUNT(*) FROM user_collection_items WHERE collection_id = c.id) AS "movieCount"
       FROM user_collections c
       WHERE c.user_id = $1
       ORDER BY c.created_at DESC`,
            [req.user.id]
        );
        return res.json({ collections: result.rows });
    } catch (error) {
        return next(error);
    }
});

// POST /api/collections - create a new collection
router.post("/", async (req, res, next) => {
    try {
        await ensureCollectionsSchema();
        const name = String(req.body.name || "").trim();
        if (!name) return res.status(400).json({ error: "Collection name is required" });

        const result = await query(
            `INSERT INTO user_collections (user_id, name, created_at)
       VALUES ($1, $2, NOW()) RETURNING id, name, created_at AS "createdAt"`,
            [req.user.id, name]
        );
        return res.status(201).json({ collection: result.rows[0] });
    } catch (error) {
        return next(error);
    }
});

// GET /api/collections/:id - get single collection elements
router.get("/:id", async (req, res, next) => {
    try {
        await ensureCollectionsSchema();
        const collId = Number(req.params.id);

        const collRes = await query(`SELECT * FROM user_collections WHERE id = $1 AND user_id = $2`, [collId, req.user.id]);
        if (collRes.rowCount === 0) return res.status(404).json({ error: "Collection not found" });

        const moviesRes = await query(
            `SELECT
         m.id AS "movieId",
         m.title,
         m.year,
         m.poster_url AS "posterUrl",
         m.external_id AS "externalId",
         ci.added_at AS "addedAt"
       FROM user_collection_items ci
       JOIN movies m ON m.id = ci.movie_id
       WHERE ci.collection_id = $1
       ORDER BY ci.added_at DESC`,
            [collId]
        );

        return res.json({
            collection: {
                id: collRes.rows[0].id,
                name: collRes.rows[0].name,
                createdAt: collRes.rows[0].created_at,
                movies: moviesRes.rows
            }
        });
    } catch (error) {
        return next(error);
    }
});

// DELETE /api/collections/:id
router.delete("/:id", async (req, res, next) => {
    try {
        await ensureCollectionsSchema();
        const collId = Number(req.params.id);
        await query(`DELETE FROM user_collections WHERE id = $1 AND user_id = $2`, [collId, req.user.id]);
        return res.json({ ok: true });
    } catch (error) {
        return next(error);
    }
});

// POST /api/collections/:id/add - Add movie to collection
router.post("/:id/add", async (req, res, next) => {
    try {
        await ensureCollectionsSchema();
        const collId = Number(req.params.id);
        const { externalId, title, posterUrl, year } = req.body;

        if (!title) return res.status(400).json({ error: "title is required" });

        const collCheck = await query(`SELECT id FROM user_collections WHERE id = $1 AND user_id = $2`, [collId, req.user.id]);
        if (collCheck.rowCount === 0) return res.status(404).json({ error: "Collection not found" });

        let movieId;
        if (externalId) {
            const safeExtId = Number(externalId);
            const yr = parseSafeYear(year);
            if (!yr.ok) return res.status(400).json({ error: "Invalid year" });
            movieId = await getOrCreateMovieByExternalId({
                externalId: safeExtId,
                title: String(title).trim(),
                posterUrl,
                year: yr.value
            });
        } else {
            const yr = parseSafeYear(year);
            if (!yr.ok) return res.status(400).json({ error: "Invalid year" });
            movieId = await getOrCreateManualMovie({
                title: String(title).trim(),
                year: yr.value,
                posterUrl
            });
        }

        await query(
            `INSERT INTO user_collection_items (collection_id, movie_id, added_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (collection_id, movie_id) DO NOTHING`,
            [collId, movieId]
        );

        return res.status(201).json({ ok: true });
    } catch (error) {
        return next(error);
    }
});

// DELETE /api/collections/:id/movies/:movieId
router.delete("/:id/movies/:movieId", async (req, res, next) => {
    try {
        await ensureCollectionsSchema();
        const collId = Number(req.params.id);
        const movieId = Number(req.params.movieId);

        const collCheck = await query(`SELECT id FROM user_collections WHERE id = $1 AND user_id = $2`, [collId, req.user.id]);
        if (collCheck.rowCount === 0) return res.status(404).json({ error: "Collection not found" });

        await query(`DELETE FROM user_collection_items WHERE collection_id = $1 AND movie_id = $2`, [collId, movieId]);
        return res.json({ ok: true });
    } catch (error) {
        return next(error);
    }
});

export default router;
