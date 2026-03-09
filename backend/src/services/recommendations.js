import { generatePolzaRecommendationText } from "./polza.js";
import { searchPoiskkinoMovies } from "./poiskkino.js";

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeForCompare(value) {
  return normalizeText(value).toLowerCase();
}

const GENRE_RU_MAP = new Map([
  ["action", "Боевик"],
  ["adventure", "Приключения"],
  ["animation", "Мультфильм"],
  ["anime", "Аниме"],
  ["biography", "Биография"],
  ["comedy", "Комедия"],
  ["crime", "Криминал"],
  ["documentary", "Документальный"],
  ["drama", "Драма"],
  ["family", "Семейный"],
  ["fantasy", "Фэнтези"],
  ["film-noir", "Нуар"],
  ["history", "Исторический"],
  ["historical", "Исторический"],
  ["horror", "Ужасы"],
  ["melodrama", "Мелодрама"],
  ["music", "Музыкальный"],
  ["musical", "Мюзикл"],
  ["mystery", "Детектив"],
  ["romance", "Романтика"],
  ["sci-fi", "Фантастика"],
  ["science fiction", "Фантастика"],
  ["sport", "Спорт"],
  ["thriller", "Триллер"],
  ["war", "Военный"],
  ["western", "Вестерн"]
]);

function containsCyrillic(value) {
  return /[А-Яа-яЁё]/.test(String(value || ""));
}

function localizeGenre(genre) {
  const text = normalizeText(genre);
  if (!text) {
    return "";
  }
  const mapped = GENRE_RU_MAP.get(normalizeForCompare(text));
  return mapped || text;
}

function parseJsonObject(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) {
    throw new Error("Пустой ответ от ИИ.");
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    // Continue with bracket extraction fallback.
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) {
    throw new Error("ИИ вернул ответ в неверном формате.");
  }

  const candidate = trimmed.slice(firstBrace, lastBrace + 1);
  return JSON.parse(candidate);
}

function normalizeGenres(value) {
  let list = [];
  if (Array.isArray(value)) {
    list = value;
  } else if (typeof value === "string") {
    list = value.split(",");
  }

  const localized = list.map((genre) => localizeGenre(genre)).filter(Boolean);
  const unique = [];
  const seen = new Set();
  for (const genre of localized) {
    const key = normalizeForCompare(genre);
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(genre);
    }
  }
  return unique.slice(0, 6);
}

function normalizeYear(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 1888 || numeric > 2100) {
    return null;
  }

  return numeric;
}

function normalizeRecommendation(raw) {
  const title = normalizeText(raw?.title);
  if (!title) {
    throw new Error("ИИ не вернул название фильма.");
  }

  const overviewShort = normalizeText(raw?.overviewShort || raw?.overview || raw?.description);
  if (!overviewShort) {
    throw new Error("ИИ не вернул описание фильма.");
  }

  return {
    title,
    year: normalizeYear(raw?.year),
    country: normalizeText(raw?.country) || null,
    genres: normalizeGenres(raw?.genres),
    overviewShort: overviewShort.slice(0, 800)
  };
}

function buildPrompt(input) {
  const filters = [];
  if (input.genres.length > 0) {
    filters.push(`Жанры: ${input.genres.join(", ")}`);
  }
  if (input.yearFrom !== null) {
    filters.push(`Год выпуска от: ${input.yearFrom}`);
  }
  if (input.country) {
    filters.push(`Страна производства: ${input.country}`);
  }
  if (input.vibePrompt) {
    filters.push(`Запрос по настроению: ${input.vibePrompt}`);
  }
  if (filters.length === 0) {
    filters.push("Подбери универсальный фильм с широким потенциалом понравиться пользователю.");
  }

  const excludeLines = [];
  if (input.excludeTitles.length > 0) {
    excludeLines.push(`Исключить названия: ${input.excludeTitles.join(", ")}`);
  }
  if (input.excludeExternalIds.length > 0) {
    excludeLines.push(`Исключить внешние ID: ${input.excludeExternalIds.join(", ")}`);
  }

  return [
    "Подбери ровно один фильм.",
    ...filters,
    ...excludeLines,
    "Верни только JSON-объект и ничего кроме JSON.",
    "Ключи строго такие:",
    "{\"title\": string, \"year\": number|null, \"country\": string|null, \"genres\": string[], \"overviewShort\": string}",
    "Все текстовые поля (`title`, `country`, `genres`, `overviewShort`) должны быть на русском языке.",
    "Если есть русское название фильма, используй его в `title`.",
    "`overviewShort` — 2-4 коротких предложения без спойлеров."
  ].join("\n");
}

function normalizeInput(input = {}) {
  const genres = Array.isArray(input.genres)
    ? [...new Set(input.genres.map((genre) => normalizeText(genre)).filter(Boolean))].slice(0, 5)
    : [];
  const yearFrom = normalizeYear(input.yearFrom);
  const country = normalizeText(input.country) || null;
  const vibePrompt = normalizeText(input.vibePrompt);
  const excludeTitles = Array.isArray(input.excludeTitles)
    ? [...new Set(input.excludeTitles.map((title) => normalizeText(title)).filter(Boolean))].slice(0, 50)
    : [];
  const excludeExternalIds = Array.isArray(input.excludeExternalIds)
    ? [...new Set(input.excludeExternalIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))].slice(0, 50)
    : [];

  return {
    genres,
    yearFrom,
    country,
    vibePrompt,
    excludeTitles,
    excludeExternalIds
  };
}

function isExcludedByTitle(title, excludedTitleSet) {
  return excludedTitleSet.has(normalizeForCompare(title));
}

function isExcludedByExternalId(externalId, excludedExternalIdSet) {
  return Number.isInteger(externalId) && excludedExternalIdSet.has(externalId);
}

function pickBestCandidate(results, preferredYear, excludedTitleSet, excludedExternalIdSet) {
  const available = results.filter(
    (item) =>
      !isExcludedByTitle(item.title, excludedTitleSet)
      && !isExcludedByExternalId(item.externalId, excludedExternalIdSet)
  );

  if (available.length === 0) {
    return null;
  }

  if (preferredYear !== null) {
    const exactYear = available.find((item) => item.year === preferredYear);
    if (exactYear) {
      return exactYear;
    }
  }

  return available[0];
}

async function enrichWithPoiskkino(recommendation, excludedTitleSet, excludedExternalIdSet) {
  let bestMatch = null;
  try {
    const query = `${recommendation.title}${recommendation.year ? ` ${recommendation.year}` : ""}`.trim();
    const { results } = await searchPoiskkinoMovies(query);
    bestMatch = pickBestCandidate(results || [], recommendation.year, excludedTitleSet, excludedExternalIdSet);
  } catch {
    // Enrichment is optional; recommendation can still be returned.
  }

  return {
    title: bestMatch?.title || recommendation.title,
    year: recommendation.year ?? bestMatch?.year ?? null,
    country: recommendation.country || null,
    genres: recommendation.genres,
    overviewShort: recommendation.overviewShort,
    posterUrl: bestMatch?.posterUrl || null,
    externalId: bestMatch?.externalId || null
  };
}

export async function recommendMovieWithAi(rawInput) {
  const input = normalizeInput(rawInput);
  const excludedTitleSet = new Set(input.excludeTitles.map((title) => normalizeForCompare(title)));
  const excludedExternalIdSet = new Set(input.excludeExternalIds);

  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const userPrompt = buildPrompt(input);
      const ai = await generatePolzaRecommendationText({ userPrompt });
      const parsed = parseJsonObject(ai.text);
      const normalized = normalizeRecommendation(parsed);
      const enriched = await enrichWithPoiskkino(normalized, excludedTitleSet, excludedExternalIdSet);

      if (isExcludedByTitle(enriched.title, excludedTitleSet) || isExcludedByExternalId(enriched.externalId, excludedExternalIdSet)) {
        excludedTitleSet.add(normalizeForCompare(enriched.title));
        if (Number.isInteger(enriched.externalId)) {
          excludedExternalIdSet.add(enriched.externalId);
        }
        continue;
      }

      if (!containsCyrillic(enriched.title)) {
        throw new Error("ИИ вернул название фильма не на русском языке.");
      }
      if (!containsCyrillic(enriched.overviewShort)) {
        throw new Error("ИИ вернул описание фильма не на русском языке.");
      }

      return {
        recommendation: enriched,
        meta: {
          provider: "polza",
          model: ai.model,
          enrichedBy: "poiskkino"
        }
      };
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) {
    const err = new Error(lastError.message || "Не удалось сгенерировать рекомендацию.");
    err.statusCode = lastError.statusCode || 502;
    err.cause = lastError;
    throw err;
  }

  const err = new Error("Не удалось сгенерировать рекомендацию.");
  err.statusCode = 502;
  throw err;
}
