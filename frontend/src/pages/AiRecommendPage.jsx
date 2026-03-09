import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { addToWatchLater, recommendMovieWithAi } from "../api";
import PageHeader from "../components/ui/PageHeader";
import SectionCard from "../components/ui/SectionCard";
import StateBlock from "../components/ui/StateBlock";
import "./AiRecommendPage.css";

const TOKEN_KEY = "kinopulse_token";

const GENRE_OPTIONS = [
  { value: "crime", label: "Криминал" },
  { value: "drama", label: "Драма" },
  { value: "thriller", label: "Триллер" },
  { value: "action", label: "Боевик" },
  { value: "comedy", label: "Комедия" },
  { value: "sci-fi", label: "Фантастика" },
  { value: "adventure", label: "Приключения" },
  { value: "mystery", label: "Детектив" },
  { value: "romance", label: "Романтика" },
  { value: "historical", label: "Исторический" }
];

const GENRE_LABELS = GENRE_OPTIONS.reduce((acc, item) => {
  acc[item.value] = item.label;
  return acc;
}, {});

function uniqueAppend(list, value) {
  if (!value) {
    return list;
  }
  if (list.includes(value)) {
    return list;
  }
  return [...list, value];
}

function formatGenre(genre) {
  const key = String(genre || "").trim().toLowerCase();
  return GENRE_LABELS[key] || genre;
}

function localizeRecommendationError(message) {
  const normalized = String(message || "").trim();
  if (!normalized) {
    return "Не удалось сгенерировать рекомендацию.";
  }

  const lowered = normalized.toLowerCase();
  if (lowered.includes("failed to generate recommendation")) {
    return "Не удалось сгенерировать рекомендацию.";
  }
  if (lowered.includes("request failed")) {
    return "Ошибка запроса. Попробуйте снова.";
  }
  return normalized;
}

export default function AiRecommendPage() {
  const navigate = useNavigate();
  const [token] = useState(() => localStorage.getItem(TOKEN_KEY) || "");

  const [genres, setGenres] = useState(["crime", "drama"]);
  const [yearFrom, setYearFrom] = useState("");
  const [country, setCountry] = useState("");
  const [vibePrompt, setVibePrompt] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [recommendation, setRecommendation] = useState(null);

  const [sessionExcludedTitles, setSessionExcludedTitles] = useState([]);
  const [sessionExcludedExternalIds, setSessionExcludedExternalIds] = useState([]);

  const [watchLaterBusy, setWatchLaterBusy] = useState(false);
  const [watchLaterNotice, setWatchLaterNotice] = useState({ type: "", message: "" });

  useEffect(() => {
    if (!token) {
      navigate("/tracker");
    }
  }, [token, navigate]);

  const hasFilters = useMemo(
    () => genres.length > 0 || yearFrom.trim() || country.trim() || vibePrompt.trim(),
    [genres, yearFrom, country, vibePrompt]
  );

  function toggleGenre(genre) {
    setGenres((prev) => {
      if (prev.includes(genre)) {
        return prev.filter((item) => item !== genre);
      }
      if (prev.length >= 5) {
        return prev;
      }
      return [...prev, genre];
    });
  }

  function makePayload(excludeTitles = [], excludeExternalIds = []) {
    return {
      genres,
      yearFrom: yearFrom.trim() ? Number(yearFrom) : null,
      country: country.trim(),
      vibePrompt: vibePrompt.trim(),
      excludeTitles,
      excludeExternalIds
    };
  }

  async function requestRecommendation(excludeTitles = [], excludeExternalIds = []) {
    setLoading(true);
    setError("");
    try {
      const payload = makePayload(excludeTitles, excludeExternalIds);
      const data = await recommendMovieWithAi(payload, token);
      const nextRecommendation = data.recommendation || null;
      setRecommendation(nextRecommendation);
      setWatchLaterNotice({ type: "", message: "" });

      if (nextRecommendation) {
        setSessionExcludedTitles((prev) => uniqueAppend(prev, nextRecommendation.title));
        if (Number.isInteger(nextRecommendation.externalId)) {
          setSessionExcludedExternalIds((prev) => uniqueAppend(prev, nextRecommendation.externalId));
        }
      }
    } catch (err) {
      setError(localizeRecommendationError(err.message));
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate(event) {
    event.preventDefault();
    setSessionExcludedTitles([]);
    setSessionExcludedExternalIds([]);
    await requestRecommendation([], []);
  }

  async function handleRegenerate() {
    await requestRecommendation(sessionExcludedTitles, sessionExcludedExternalIds);
  }

  async function handleAddToWatchLater() {
    if (!recommendation) {
      return;
    }
    if (!Number.isInteger(recommendation.externalId)) {
      setWatchLaterNotice({
        type: "error",
        message: "Не удалось добавить фильм: отсутствует внешний ID." 
      });
      return;
    }

    setWatchLaterBusy(true);
    setWatchLaterNotice({ type: "", message: "" });

    try {
      await addToWatchLater(
        {
          externalId: recommendation.externalId,
          title: recommendation.title,
          posterUrl: recommendation.posterUrl,
          year: recommendation.year
        },
        token
      );
      setWatchLaterNotice({ type: "success", message: "Добавлено в «Посмотреть позже»." });
    } catch (err) {
      setWatchLaterNotice({
        type: "error",
        message: err.message || "Не удалось добавить в список «Посмотреть позже»."
      });
    } finally {
      setWatchLaterBusy(false);
    }
  }

  return (
    <div className="ai-page">
      <div className="ai-aura" />
      <main className="ai-container" id="main-content">
        <PageHeader
          className="ai-header"
          kicker="ИИ-подбор"
          title={
            <>
              Подберём фильм под ваше настроение
              <span className="ai-dot">.</span>
            </>
          }
          subtitle="Выберите фильтры, опишите настроение и получите один персональный вариант."
        />

        <SectionCard
          className="ai-form-card"
          title="Ваши предпочтения"
          description="Выберите до 5 жанров, при желании укажите год и страну, затем добавьте описание настроения."
        >
          <form className="ai-form" onSubmit={handleGenerate}>
            <div className="ai-field">
              <span className="ai-field-label">{`Жанры (${genres.length}/5)`}</span>
              <div className="ai-genre-grid">
                {GENRE_OPTIONS.map((genre) => (
                  <button
                    key={genre.value}
                    type="button"
                    className={`ai-genre-chip${genres.includes(genre.value) ? " is-active" : ""}`}
                    onClick={() => toggleGenre(genre.value)}
                  >
                    {genre.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="ai-field-row">
              <label className="ai-field">
                <span className="ai-field-label">Год от</span>
                <input
                  type="number"
                  min="1888"
                  max={new Date().getFullYear() + 1}
                  placeholder="2010"
                  value={yearFrom}
                  onChange={(event) => setYearFrom(event.target.value)}
                />
              </label>
              <label className="ai-field">
                <span className="ai-field-label">Страна</span>
                <input
                  type="text"
                  maxLength={80}
                  placeholder="Великобритания"
                  value={country}
                  onChange={(event) => setCountry(event.target.value)}
                />
              </label>
            </div>

            <label className="ai-field">
              <span className="ai-field-label">Пожелание</span>
              <textarea
                maxLength={400}
                placeholder="Хочется что-то в стиле «Острых козырьков»."
                value={vibePrompt}
                onChange={(event) => setVibePrompt(event.target.value)}
              />
            </label>

            <div className="ai-actions">
              <button type="submit" disabled={loading || !hasFilters}>
                {loading ? "Подбираем..." : "Подобрать фильм"}
              </button>
              <button
                type="button"
                className="ghost"
                disabled={loading || !recommendation}
                onClick={() => void handleRegenerate()}
              >
                Перегенерировать
              </button>
            </div>
          </form>
        </SectionCard>

        {loading ? (
          <StateBlock variant="loading" title="Генерируем рекомендацию..." message="Подождите несколько секунд." />
        ) : null}

        {!loading && error ? (
          <StateBlock
            variant="error"
            title="Не удалось получить рекомендацию"
            message={error}
            actionLabel="Попробовать снова"
            onAction={() => void handleRegenerate()}
          />
        ) : null}

        {!loading && !error && recommendation ? (
          <SectionCard className="ai-result-card" title="Рекомендация от ИИ">
            <div className="ai-result-layout">
              <div className="ai-poster-wrap">
                {recommendation.posterUrl ? (
                  <img src={recommendation.posterUrl} alt={recommendation.title} loading="lazy" className="ai-poster" />
                ) : (
                  <div className="ai-poster ai-no-poster">Нет постера</div>
                )}
              </div>
              <div className="ai-result-copy">
                <h2>{recommendation.title}</h2>
                <ul className="ai-meta-list">
                  <li>
                    <span>Год</span>
                    <strong>{recommendation.year || "-"}</strong>
                  </li>
                  <li>
                    <span>Страна</span>
                    <strong>{recommendation.country || "-"}</strong>
                  </li>
                  <li>
                    <span>Жанры</span>
                    <strong>
                      {Array.isArray(recommendation.genres) && recommendation.genres.length > 0
                        ? recommendation.genres.map((genre) => formatGenre(genre)).join(", ")
                        : "-"}
                    </strong>
                  </li>
                </ul>
                <p className="ai-overview">{recommendation.overviewShort || "Описание отсутствует."}</p>

                <div className="ai-result-actions">
                  <button
                    type="button"
                    className="ai-watch-later-btn"
                    disabled={watchLaterBusy || !Number.isInteger(recommendation.externalId)}
                    onClick={() => void handleAddToWatchLater()}
                  >
                    {watchLaterBusy ? "Добавляем..." : "Добавить в «Посмотреть позже»"}
                  </button>
                  {watchLaterNotice.message ? (
                    <p className={`ai-inline-status${watchLaterNotice.type === "success" ? " is-success" : " is-error"}`}>
                      {watchLaterNotice.message}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </SectionCard>
        ) : null}

        {!loading && !error && !recommendation ? (
          <StateBlock
            variant="empty"
            title="Рекомендации пока нет"
            message="Заполните хотя бы один параметр и нажмите «Подобрать фильм»."
          />
        ) : null}
      </main>
    </div>
  );
}