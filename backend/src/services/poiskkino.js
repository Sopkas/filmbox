import { config } from "../config.js";

const POISKKINO_API_BASE = "https://api.poiskkino.dev/v1.4";

const SERIES_TYPES = new Set(["tv-series", "anime", "cartoon", "animated-series", "mini-series"]);
const searchCache = new Map();
let throttleChain = Promise.resolve();
let lastExternalCallAt = 0;

function mapMovie(item) {
  return {
    externalId: item.id,
    title: item.name || item.alternativeName || item.enName || "Untitled",
    year: Number.isInteger(item.year) ? item.year : null,
    posterUrl: item.poster?.previewUrl || item.poster?.url || null,
    type: SERIES_TYPES.has(item.type) ? "series" : "movie"
  };
}

function normalizeQueryKey(value) {
  return String(value || "").trim().toLowerCase();
}

function getCachedResult(queryKey) {
  const cached = searchCache.get(queryKey);
  if (!cached) {
    return null;
  }
  if (cached.expiresAt <= Date.now()) {
    searchCache.delete(queryKey);
    return null;
  }
  return cached;
}

function pruneCacheIfNeeded() {
  if (searchCache.size < config.poiskkinoCacheMaxEntries) {
    return;
  }
  const oldest = searchCache.keys().next().value;
  if (oldest) {
    searchCache.delete(oldest);
  }
}

function setCachedResult(queryKey, results) {
  pruneCacheIfNeeded();
  searchCache.set(queryKey, {
    results,
    expiresAt: Date.now() + config.poiskkinoCacheTtlMs
  });
}

function runWithThrottle(task) {
  const run = throttleChain.then(async () => {
    const now = Date.now();
    const waitMs = Math.max(0, config.poiskkinoThrottleMs - (now - lastExternalCallAt));
    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
    lastExternalCallAt = Date.now();
    return task(waitMs);
  });

  throttleChain = run.catch(() => undefined);
  return run;
}

export async function searchPoiskkinoMovies(queryString) {
  const queryKey = normalizeQueryKey(queryString);

  if (config.mockPoiskkino) {
    return {
      results: [
        {
          externalId: 101,
          title: `${queryString} (mock)`,
          year: 2020,
          posterUrl: null,
          type: "movie"
        }
      ],
      meta: {
        source: "mock",
        cacheHit: false,
        throttleDelayMs: 0
      }
    };
  }

  const cached = getCachedResult(queryKey);
  if (cached) {
    return {
      results: cached.results,
      meta: {
        source: "cache",
        cacheHit: true,
        throttleDelayMs: 0
      }
    };
  }

  return runWithThrottle(async (waitMs) => {
    const url = new URL(`${POISKKINO_API_BASE}/movie/search`);
    url.searchParams.set("query", queryString);
    url.searchParams.set("page", "1");
    url.searchParams.set("limit", "10");

    let response;
    try {
      response = await fetch(url, {
        headers: {
          "X-API-KEY": config.poiskkinoApiKey,
          Accept: "application/json"
        }
      });
    } catch (cause) {
      const stale = getCachedResult(queryKey);
      if (stale) {
        return {
          results: stale.results,
          meta: {
            source: "stale-cache",
            cacheHit: true,
            throttleDelayMs: waitMs
          }
        };
      }
      const err = new Error("PoiskKino is unavailable");
      err.statusCode = 502;
      err.cause = cause;
      throw err;
    }

    if (!response.ok) {
      const stale = getCachedResult(queryKey);
      if (stale) {
        return {
          results: stale.results,
          meta: {
            source: "stale-cache",
            cacheHit: true,
            throttleDelayMs: waitMs
          }
        };
      }
      const err = new Error("PoiskKino request failed");
      err.statusCode = 502;
      throw err;
    }

    const payload = await response.json();
    const results = (Array.isArray(payload.docs) ? payload.docs : [])
      .slice(0, 10)
      .map(mapMovie);
    setCachedResult(queryKey, results);

    return {
      results,
      meta: {
        source: "api",
        cacheHit: false,
        throttleDelayMs: waitMs
      }
    };
  });
}
