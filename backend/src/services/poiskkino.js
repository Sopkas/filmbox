import { config } from "../config.js";

const POISKKINO_API_BASE = "https://api.poiskkino.dev/v1.4";

const SERIES_TYPES = new Set(["tv-series", "anime", "cartoon", "animated-series", "mini-series"]);

function mapMovie(item) {
  return {
    externalId: item.id,
    title: item.name || item.alternativeName || item.enName || "Untitled",
    year: Number.isInteger(item.year) ? item.year : null,
    posterUrl: item.poster?.previewUrl || item.poster?.url || null,
    type: SERIES_TYPES.has(item.type) ? "series" : "movie"
  };
}

export async function searchPoiskkinoMovies(queryString) {
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
    const err = new Error("PoiskKino is unavailable");
    err.statusCode = 502;
    err.cause = cause;
    throw err;
  }

  if (!response.ok) {
    const err = new Error("PoiskKino request failed");
    err.statusCode = 502;
    throw err;
  }

  const payload = await response.json();
  const results = Array.isArray(payload.docs) ? payload.docs : [];

  return results.slice(0, 10).map(mapMovie);
}

