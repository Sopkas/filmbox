import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test, { after, before, beforeEach } from "node:test";
import { fileURLToPath } from "node:url";
import request from "supertest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:55432/kinopulse";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test_secret";
process.env.POISKKINO_API_KEY = process.env.POISKKINO_API_KEY || "test_poiskkino_key";
process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "test_google_client_id.apps.googleusercontent.com";
process.env.CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";
process.env.MOCK_POISKKINO = "true";
process.env.MOCK_GOOGLE = "true";

const { createApp } = await import("../../src/app.js");
const { pool, query } = await import("../../src/db.js");

const app = createApp();

async function initSchema() {
  const schemaPath = path.join(__dirname, "../../sql/schema.sql");
  const schemaSql = await fs.readFile(schemaPath, "utf8");
  await query(schemaSql);
}

async function cleanDb() {
  await query(`
    TRUNCATE TABLE
      user_collection_items,
      user_collections,
      user_top10,
      user_watch_later,
      user_abandoned,
      user_reviews,
      movies,
      users
    RESTART IDENTITY CASCADE
  `);
}

async function createAuthUser() {
  const payload = {
    username: `user_${Date.now()}`,
    email: `user_${Date.now()}@test.dev`,
    password: "password123"
  };

  const response = await request(app).post("/api/auth/signup").send(payload);
  assert.equal(response.status, 201);

  return {
    token: response.body.token,
    user: response.body.user,
    credentials: payload
  };
}

before(async () => {
  await initSchema();
});

beforeEach(async () => {
  await cleanDb();
});

after(async () => {
  await pool.end();
});

test("signup/login: positive and negative", async () => {
  const credentials = {
    username: "alice",
    email: "alice@example.com",
    password: "password123"
  };

  const signup = await request(app).post("/api/auth/signup").send(credentials);
  assert.equal(signup.status, 201);
  assert.ok(signup.body.token);
  assert.equal(signup.body.user.email, credentials.email);
  assert.ok(Array.isArray(signup.headers["set-cookie"]));

  const login = await request(app)
    .post("/api/auth/login")
    .send({ email: credentials.email, password: credentials.password });
  assert.equal(login.status, 200);
  assert.ok(login.body.token);
  assert.ok(Array.isArray(login.headers["set-cookie"]));

  const loginFail = await request(app)
    .post("/api/auth/login")
    .send({ email: credentials.email, password: "wrong-pass" });
  assert.equal(loginFail.status, 401);

  const duplicateEmail = await request(app).post("/api/auth/signup").send({
    username: "alice_2",
    email: "alice@example.com",
    password: "password123"
  });
  assert.equal(duplicateEmail.status, 409);
  assert.equal(duplicateEmail.body.error, "email already exists");

  const duplicateEmailCaseInsensitive = await request(app).post("/api/auth/signup").send({
    username: "alice_3",
    email: "ALICE@EXAMPLE.COM",
    password: "password123"
  });
  assert.equal(duplicateEmailCaseInsensitive.status, 409);
  assert.equal(duplicateEmailCaseInsensitive.body.error, "email already exists");

  const duplicateUsername = await request(app).post("/api/auth/signup").send({
    username: "alice",
    email: "alice_4@example.com",
    password: "password123"
  });
  assert.equal(duplicateUsername.status, 409);
  assert.equal(duplicateUsername.body.error, "username already exists");

  const duplicateUsernameCaseInsensitive = await request(app).post("/api/auth/signup").send({
    username: "ALICE",
    email: "alice_5@example.com",
    password: "password123"
  });
  assert.equal(duplicateUsernameCaseInsensitive.status, 409);
  assert.equal(duplicateUsernameCaseInsensitive.body.error, "username already exists");
});

test("cookie auth and logout: positive and negative", async () => {
  const agent = request.agent(app);

  const signup = await agent.post("/api/auth/signup").send({
    username: "cookie_user",
    email: "cookie_user@example.com",
    password: "password123"
  });
  assert.equal(signup.status, 201);

  const profileByCookie = await agent.get("/api/reviews/me");
  assert.equal(profileByCookie.status, 200);

  const logout = await agent.post("/api/auth/logout").send({});
  assert.equal(logout.status, 200);
  assert.equal(logout.body.ok, true);

  const profileAfterLogout = await agent.get("/api/reviews/me");
  assert.equal(profileAfterLogout.status, 401);
});

test("google auth: signup/login and invalid token", async () => {
  const first = await request(app)
    .post("/api/auth/google")
    .send({ idToken: "mock-google:g-sub-1|google_user@example.com|Google User" });
  assert.equal(first.status, 200);
  assert.ok(first.body.token);
  assert.equal(first.body.user.email, "google_user@example.com");

  const second = await request(app)
    .post("/api/auth/google")
    .send({ idToken: "mock-google:g-sub-1|google_user@example.com|Google User" });
  assert.equal(second.status, 200);
  assert.equal(second.body.user.id, first.body.user.id);

  const classic = await request(app)
    .post("/api/auth/signup")
    .send({ username: "classic_user", email: "legacy@example.com", password: "password123" });
  assert.equal(classic.status, 201);

  const linked = await request(app)
    .post("/api/auth/google")
    .send({ idToken: "mock-google:g-sub-2|legacy@example.com|Legacy User" });
  assert.equal(linked.status, 200);
  assert.equal(linked.body.user.id, classic.body.user.id);

  const conflict = await request(app)
    .post("/api/auth/google")
    .send({ idToken: "mock-google:g-sub-3|legacy@example.com|Legacy User" });
  assert.equal(conflict.status, 409);

  const invalid = await request(app)
    .post("/api/auth/google")
    .send({ idToken: "invalid_token" });
  assert.equal(invalid.status, 401);
  assert.equal(invalid.body.error, "Invalid Google token");
});

test("movies search: positive and invalid query", async () => {
  const ok = await request(app).get("/api/movies/search").query({ q: "interstellar" });
  assert.equal(ok.status, 200);
  assert.ok(Array.isArray(ok.body.results));
  assert.equal(ok.body.results.length, 1);

  const bad = await request(app).get("/api/movies/search").query({ q: "a" });
  assert.equal(bad.status, 400);
  assert.equal(bad.body.error, "Validation error");
});

test("reviews manual + top10: positive and negative", async () => {
  const { token } = await createAuthUser();

  const create = await request(app)
    .post("/api/reviews/manual")
    .set("Authorization", `Bearer ${token}`)
    .send({ title: "Interstellar", year: 2014, rating: 4.5, comment: "great" });
  assert.equal(create.status, 201);

  const invalidRating = await request(app)
    .post("/api/reviews/manual")
    .set("Authorization", `Bearer ${token}`)
    .send({ title: "Bad rating", year: 2014, rating: 4.3 });
  assert.equal(invalidRating.status, 400);

  const profile = await request(app)
    .get("/api/reviews/me")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(profile.status, 200);
  assert.equal(profile.body.items.length, 1);

  const reviewId = profile.body.items[0].id;
  const top10 = await request(app)
    .put("/api/reviews/me/top10")
    .set("Authorization", `Bearer ${token}`)
    .send({ orderedReviewIds: [reviewId] });
  assert.equal(top10.status, 200);
  assert.equal(top10.body.top10.length, 1);

  const invalidTop10 = await request(app)
    .put("/api/reviews/me/top10")
    .set("Authorization", `Bearer ${token}`)
    .send({ orderedReviewIds: [reviewId, reviewId] });
  assert.equal(invalidTop10.status, 400);
});

test("watch later and abandoned: positive and negative", async () => {
  const { token } = await createAuthUser();

  const watchLater = await request(app)
    .post("/api/reviews/me/watch-later/add")
    .set("Authorization", `Bearer ${token}`)
    .send({ title: "Dune", year: 2021, externalId: 2001 });
  assert.equal(watchLater.status, 200);
  assert.equal(watchLater.body.watchLater.length, 1);

  const watchLaterInvalid = await request(app)
    .post("/api/reviews/me/watch-later/add")
    .set("Authorization", `Bearer ${token}`)
    .send({});
  assert.equal(watchLaterInvalid.status, 400);

  const abandoned = await request(app)
    .post("/api/reviews/me/abandoned/add")
    .set("Authorization", `Bearer ${token}`)
    .send({ title: "Some Series", externalId: 3001, stoppedSeason: 2, stoppedEpisode: 4 });
  assert.equal(abandoned.status, 200);
  assert.equal(abandoned.body.abandoned.length, 1);

  const abandonedInvalid = await request(app)
    .post("/api/reviews/me/abandoned/add")
    .set("Authorization", `Bearer ${token}`)
    .send({ title: "Series", externalId: 3002, stoppedSeason: 0 });
  assert.equal(abandonedInvalid.status, 400);
});

test("watch later rejects token for deleted user", async () => {
  const { token, user } = await createAuthUser();

  await query("DELETE FROM users WHERE id = $1", [user.id]);

  const response = await request(app)
    .post("/api/reviews/me/watch-later/add")
    .set("Authorization", `Bearer ${token}`)
    .send({ title: "Dune", year: 2021, externalId: 2001 });

  assert.equal(response.status, 401);
  assert.equal(response.body.error, "Invalid token");
});

test("collections flow: positive and negative", async () => {
  const { token } = await createAuthUser();

  const createCollection = await request(app)
    .post("/api/collections")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Sci-fi" });
  assert.equal(createCollection.status, 201);

  const collectionId = createCollection.body.collection.id;

  const list = await request(app)
    .get("/api/collections")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(list.status, 200);
  assert.equal(list.body.collections.length, 1);

  const addMovie = await request(app)
    .post(`/api/collections/${collectionId}/add`)
    .set("Authorization", `Bearer ${token}`)
    .send({ title: "Blade Runner", externalId: 4001, year: 1982 });
  assert.equal(addMovie.status, 201);

  const details = await request(app)
    .get(`/api/collections/${collectionId}`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(details.status, 200);
  assert.equal(details.body.collection.movies.length, 1);

  const movieId = details.body.collection.movies[0].movieId;
  const removeMovie = await request(app)
    .delete(`/api/collections/${collectionId}/movies/${movieId}`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(removeMovie.status, 200);

  const deleteCollection = await request(app)
    .delete(`/api/collections/${collectionId}`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(deleteCollection.status, 200);

  const invalidId = await request(app)
    .get("/api/collections/not-a-number")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(invalidId.status, 400);
});
