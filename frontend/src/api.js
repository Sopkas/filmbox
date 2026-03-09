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
    headers,
    credentials: "include"
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith("/auth/")) {
      localStorage.removeItem("kinopulse_token");
      localStorage.removeItem("kinopulse_user");
      throw new Error("Сессия истекла. Войдите снова.");
    }
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

export function signInWithGoogle(idToken) {
  return request("/auth/google", {
    method: "POST",
    body: JSON.stringify({ idToken })
  });
}

export function signOut(token) {
  return request(
    "/auth/logout",
    {
      method: "POST"
    },
    token
  );
}

export function searchMovies(query) {
  const params = new URLSearchParams({ q: query });
  return request(`/movies/search?${params.toString()}`);
}

export function recommendMovieWithAi(payload, token) {
  return request(
    "/recommendations/movie",
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    token
  );
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

export function getReviewByMovieId(movieId, token) {
  return request(`/reviews/me/movie/${movieId}`, {}, token);
}

export function getReviewByExternalId(externalId, token) {
  return request(`/reviews/me/external/${externalId}`, {}, token);
}

export function updateReview(reviewId, payload, token) {
  return request(
    `/reviews/${reviewId}`,
    {
      method: "PUT",
      body: JSON.stringify(payload)
    },
    token
  );
}

export function deleteReview(reviewId, token) {
  return request(
    `/reviews/${reviewId}`,
    { method: "DELETE" },
    token
  );
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

export function updateCollectionName(id, name, token) {
  return request(
    `/collections/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify({ name })
    },
    token
  );
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

export function reorderCollectionMovies(collectionId, movieIds, token) {
  return request(
    `/collections/${collectionId}/order`,
    {
      method: "PUT",
      body: JSON.stringify({ movieIds })
    },
    token
  );
}
