CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(40) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS google_id VARCHAR(255);

CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_unique_idx
ON users (LOWER(username));

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique_idx
ON users (LOWER(email));

CREATE UNIQUE INDEX IF NOT EXISTS users_google_id_unique_idx
ON users (google_id)
WHERE google_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS movies (
  id SERIAL PRIMARY KEY,
  external_id INTEGER UNIQUE,
  title VARCHAR(255) NOT NULL,
  poster_url TEXT,
  year INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT movies_year_check CHECK (year IS NULL OR (year >= 1888 AND year <= 2100))
);

CREATE UNIQUE INDEX IF NOT EXISTS movies_manual_unique_idx
ON movies (LOWER(title), COALESCE(year, -1))
WHERE external_id IS NULL;

CREATE TABLE IF NOT EXISTS user_reviews (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  movie_id INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  rating NUMERIC(2,1) NOT NULL,
  comment TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, movie_id)
);

ALTER TABLE user_reviews
  ALTER COLUMN rating TYPE NUMERIC(2,1)
  USING rating::NUMERIC(2,1);

ALTER TABLE user_reviews
  DROP CONSTRAINT IF EXISTS user_reviews_rating_check;

ALTER TABLE user_reviews
  ADD CONSTRAINT user_reviews_rating_check
  CHECK (
    rating >= 0.5
    AND rating <= 5
    AND (rating * 2) = FLOOR(rating * 2)
  );

CREATE TABLE IF NOT EXISTS user_top10 (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  review_id INTEGER NOT NULL REFERENCES user_reviews(id) ON DELETE CASCADE,
  position SMALLINT NOT NULL CHECK (position BETWEEN 1 AND 10),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, review_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS user_top10_user_position_idx
ON user_top10 (user_id, position);

CREATE TABLE IF NOT EXISTS user_watch_later (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  movie_id INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, movie_id)
);

CREATE TABLE IF NOT EXISTS user_abandoned (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  movie_id INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, movie_id)
);

ALTER TABLE user_abandoned
  ADD COLUMN IF NOT EXISTS stopped_season SMALLINT;

ALTER TABLE user_abandoned
  ADD COLUMN IF NOT EXISTS stopped_episode SMALLINT;

CREATE TABLE IF NOT EXISTS user_collections (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE user_collections
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS user_collection_items (
  collection_id INTEGER NOT NULL REFERENCES user_collections(id) ON DELETE CASCADE,
  movie_id INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (collection_id, movie_id)
);

ALTER TABLE user_collection_items
  ADD COLUMN IF NOT EXISTS sort_order INTEGER;

ALTER TABLE user_collection_items
  ALTER COLUMN sort_order SET DEFAULT 0;

UPDATE user_collection_items
SET sort_order = 0
WHERE sort_order IS NULL;

WITH ranked AS (
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
  AND ci.sort_order <> ranked.next_order;

CREATE UNIQUE INDEX IF NOT EXISTS user_collection_items_collection_sort_idx
ON user_collection_items (collection_id, sort_order);
