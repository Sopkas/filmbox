const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";

async function request(path, options = {}, token) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Request failed");
  }

  return payload;
}

export function signUp(credentials) {
  return request("/auth/signup", {
    method: "POST",
    body: JSON.stringify(credentials)
  });
}

export function signIn(credentials) {
  return request("/auth/login", {
    method: "POST",
    body: JSON.stringify(credentials)
  });
}

export function searchMovies(query) {
  const params = new URLSearchParams({ q: query });
  return request(`/movies/search?${params.toString()}`);
}

export function saveReview(moviePayload, token) {
  return request(
    "/reviews",
    {
      method: "POST",
      body: JSON.stringify(moviePayload)
    },
    token
  );
}

export function saveManualReview(payload, token) {
  return request(
    "/reviews/manual",
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    token
  );
}

export function getProfileReviews(params, token) {
  const query = new URLSearchParams(params);
  return request(`/reviews/me?${query.toString()}`, {}, token);
}

export function saveTop10(orderedReviewIds, token) {
  return request(
    "/reviews/me/top10",
    {
      method: "PUT",
      body: JSON.stringify({ orderedReviewIds })
    },
    token
  );
}

/* ---- Watch Later (movie-based) ---- */

export function addToWatchLater(movie, token) {
  return request(
    "/reviews/me/watch-later/add",
    {
      method: "POST",
      body: JSON.stringify(movie)
    },
    token
  );
}

export function saveWatchLater(movieIds, token) {
  return request(
    "/reviews/me/watch-later",
    {
      method: "PUT",
      body: JSON.stringify({ movieIds })
    },
    token
  );
}

export function removeFromWatchLater(movieId, token) {
  return request(
    `/reviews/me/watch-later/${movieId}`,
    { method: "DELETE" },
    token
  );
}

/* ---- Abandoned (movie-based) ---- */

export function addToAbandoned(movie, token) {
  return request(
    "/reviews/me/abandoned/add",
    {
      method: "POST",
      body: JSON.stringify(movie)
    },
    token
  );
}

export function saveAbandoned(movieIds, token) {
  return request(
    "/reviews/me/abandoned",
    {
      method: "PUT",
      body: JSON.stringify({ movieIds })
    },
    token
  );
}

export function removeFromAbandoned(movieId, token) {
  return request(
    `/reviews/me/abandoned/${movieId}`,
    { method: "DELETE" },
    token
  );
}

/* ---- Custom Collections ---- */

export function getCollections(token) {
  return request("/collections", {}, token);
}

export function createCollection(name, token) {
  return request(
    "/collections",
    {
      method: "POST",
      body: JSON.stringify({ name })
    },
    token
  );
}

export function getCollection(id, token) {
  return request(`/collections/${id}`, {}, token);
}

export function deleteCollection(id, token) {
  return request(`/collections/${id}`, { method: "DELETE" }, token);
}

export function addMovieToCollection(collectionId, movie, token) {
  return request(
    `/collections/${collectionId}/add`,
    {
      method: "POST",
      body: JSON.stringify(movie)
    },
    token
  );
}

export function removeMovieFromCollection(collectionId, movieId, token) {
  return request(
    `/collections/${collectionId}/movies/${movieId}`,
    { method: "DELETE" },
    token
  );
}
