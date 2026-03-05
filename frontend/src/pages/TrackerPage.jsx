import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import "./TrackerPage.css";
import {
  addToAbandoned,
  addToWatchLater,
  getProfileReviews,
  removeFromAbandoned,
  removeFromWatchLater,
  saveManualReview,
  saveReview,
  saveTop10,
  searchMovies,
  signIn,
  signUp
} from "../api";

const TOKEN_KEY = "kinopulse_token";
const USER_KEY = "kinopulse_user";

function formatDate(value) {
  return new Date(value).toLocaleDateString();
}

function Stars({ value }) {
  const num = Number(value) || 0;
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    if (num >= i) {
      stars.push(<span key={i} className="star-icon star-full">★</span>);
    } else if (num >= i - 0.5) {
      stars.push(
        <span key={i} className="star-icon star-half">
          <span className="star-bg">☆</span>
          <span className="star-fg">★</span>
        </span>
      );
    } else {
      stars.push(<span key={i} className="star-icon star-empty">☆</span>);
    }
  }
  return <span className="stars">{stars}</span>;
}

function RatingPicker({ value, onChange }) {
  const [hoverValue, setHoverValue] = useState(0);
  const currentValue = Number(value) || 0;
  const previewValue = hoverValue || currentValue;

  function handleClick(starIndex, isLeftHalf) {
    const newValue = isLeftHalf ? starIndex - 0.5 : starIndex;
    onChange(newValue);
  }

  return (
    <div className="rating-picker" role="radiogroup" aria-label="Оценка фильма">
      {[1, 2, 3, 4, 5].map((star) => {
        const isFullActive = previewValue >= star;
        const isHalfActive = !isFullActive && previewValue >= star - 0.5;
        return (
          <span
            key={star}
            className={`rating-star-wrap${isFullActive ? " full" : isHalfActive ? " half" : ""}`}
          >
            <button
              type="button"
              className="rating-half-btn rating-half-left"
              onClick={() => handleClick(star, true)}
              onMouseEnter={() => setHoverValue(star - 0.5)}
              onMouseLeave={() => setHoverValue(0)}
              aria-label={`${star - 0.5} из 5`}
            />
            <button
              type="button"
              className="rating-half-btn rating-half-right"
              onClick={() => handleClick(star, false)}
              onMouseEnter={() => setHoverValue(star)}
              onMouseLeave={() => setHoverValue(0)}
              aria-label={`${star} из 5`}
            />
            <span className="rating-star-glyph" aria-hidden="true">★</span>
          </span>
        );
      })}
      <span className="rating-value">{`${currentValue} / 5`}</span>
    </div>
  );
}

/* ---- Ratings Timeline Chart ---- */

function RatingsTimeline({ rows }) {
  const svgRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);
  const [dims, setDims] = useState({ width: 600, height: 220 });

  useEffect(() => {
    function measure() {
      if (svgRef.current) {
        const rect = svgRef.current.parentElement.getBoundingClientRect();
        setDims({ width: Math.max(300, rect.width - 32), height: 220 });
      }
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const sorted = useMemo(() => {
    if (!rows || rows.length === 0) return [];
    return [...rows]
      .filter((r) => r.createdAt && r.rating)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  }, [rows]);

  if (sorted.length === 0) {
    return (
      <div className="timeline-empty">
        <p className="hint">Ещё нет данных для графика.</p>
      </div>
    );
  }

  const pad = { top: 28, right: 24, bottom: 38, left: 36 };
  const w = dims.width;
  const h = dims.height;
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;

  const minDate = new Date(sorted[0].createdAt).getTime();
  const maxDate = new Date(sorted[sorted.length - 1].createdAt).getTime();
  const dateRange = maxDate - minDate || 1;

  const points = sorted.map((row) => {
    const x = pad.left + ((new Date(row.createdAt).getTime() - minDate) / dateRange) * plotW;
    const y = pad.top + plotH - ((Number(row.rating) - 1) / 4) * plotH;
    return { x, y, row };
  });

  const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");

  const tickDates = [];
  const tickCount = Math.min(6, sorted.length);
  for (let i = 0; i < tickCount; i++) {
    const t = minDate + (dateRange * i) / (tickCount - 1 || 1);
    const x = pad.left + ((t - minDate) / dateRange) * plotW;
    const d = new Date(t);
    tickDates.push({ x, label: `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, "0")}` });
  }

  return (
    <div className="timeline-chart-wrap" ref={svgRef}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="timeline-svg">
        {/* grid lines */}
        {[1, 2, 3, 4, 5].map((r) => {
          const y = pad.top + plotH - ((r - 1) / 4) * plotH;
          return (
            <g key={r}>
              <line x1={pad.left} y1={y} x2={w - pad.right} y2={y} className="timeline-grid" />
              <text x={pad.left - 8} y={y + 4} className="timeline-axis-label" textAnchor="end">
                {r}
              </text>
            </g>
          );
        })}
        {/* x-axis ticks */}
        {tickDates.map((tick, i) => (
          <text key={i} x={tick.x} y={h - 6} className="timeline-axis-label" textAnchor="middle">
            {tick.label}
          </text>
        ))}
        {/* connection line */}
        <polyline points={polyline} className="timeline-line" />
        {/* area */}
        <polygon
          points={`${points[0].x},${pad.top + plotH} ${polyline} ${points[points.length - 1].x},${pad.top + plotH}`}
          className="timeline-area"
        />
        {/* dots */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={4.5}
            className="timeline-dot"
            onMouseEnter={(e) =>
              setTooltip({
                x: e.clientX,
                y: e.clientY,
                title: p.row.title,
                rating: p.row.rating,
                date: new Date(p.row.createdAt).toLocaleDateString()
              })
            }
            onMouseLeave={() => setTooltip(null)}
          />
        ))}
      </svg>
      {tooltip && (
        <div
          className="timeline-tooltip"
          style={{ left: tooltip.x + 12, top: tooltip.y - 40, position: "fixed" }}
        >
          <strong>{tooltip.title}</strong>
          <span>{`★ ${tooltip.rating}/5 — ${tooltip.date}`}</span>
        </div>
      )}
    </div>
  );
}

export default function TrackerPage() {
  const [authMode, setAuthMode] = useState("login");
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || "");
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  });
  const [authForm, setAuthForm] = useState({ username: "", email: "", password: "" });
  const [authError, setAuthError] = useState("");
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);

  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [manualMode, setManualMode] = useState(false);
  const [manualMovie, setManualMovie] = useState({ title: "", year: "", posterUrl: "" });
  const [reviewForm, setReviewForm] = useState({ rating: 3, comment: "" });
  const [reviewMessage, setReviewMessage] = useState("");

  const [profileRows, setProfileRows] = useState([]);
  const [top10, setTop10] = useState([]);
  const [watchLater, setWatchLater] = useState([]);
  const [abandoned, setAbandoned] = useState([]);
  const [top10Busy, setTop10Busy] = useState(false);
  const [top10Message, setTop10Message] = useState("");
  const [watchLaterBusy, setWatchLaterBusy] = useState(false);
  const [abandonedBusy, setAbandonedBusy] = useState(false);
  const [listsMessage, setListsMessage] = useState("");
  const [seriesModal, setSeriesModal] = useState(null);
  // seriesModal = { movie, stoppedSeason: "", stoppedEpisode: "" } | null

  /* ---- Inline search state for Watch Later ---- */
  const [wlSearch, setWlSearch] = useState("");
  const [wlResults, setWlResults] = useState([]);
  const [wlSearchBusy, setWlSearchBusy] = useState(false);

  /* ---- Inline search state for Abandoned ---- */
  const [abSearch, setAbSearch] = useState("");
  const [abResults, setAbResults] = useState([]);
  const [abSearchBusy, setAbSearchBusy] = useState(false);
  const [sortBy, setSortBy] = useState("createdAt");
  const [order, setOrder] = useState("desc");
  const [profileBusy, setProfileBusy] = useState(false);

  const selectedMovieLabel = useMemo(() => {
    if (!selectedMovie) {
      return "";
    }
    return `${selectedMovie.title}${selectedMovie.year ? ` (${selectedMovie.year})` : ""}`;
  }, [selectedMovie]);

  const trackerStats = useMemo(() => {
    const total = profileRows.length;
    const avg =
      total > 0
        ? (profileRows.reduce((acc, row) => acc + Number(row.rating || 0), 0) / total).toFixed(1)
        : "0.0";
    const notes = profileRows.filter((row) => String(row.comment || "").trim().length > 0).length;

    return { total, avg, notes };
  }, [profileRows]);

  const top10PositionByReviewId = useMemo(() => {
    const map = new Map();
    top10.forEach((row, index) => {
      map.set(row.id, Number(row.topPosition || index + 1));
    });
    return map;
  }, [top10]);

  const watchLaterMovieIds = useMemo(
    () => new Set(watchLater.map((row) => row.movieId)),
    [watchLater]
  );
  const abandonedMovieIds = useMemo(
    () => new Set(abandoned.map((row) => row.movieId)),
    [abandoned]
  );

  useEffect(() => {
    if (!token) {
      setProfileRows([]);
      setTop10([]);
      setWatchLater([]);
      setAbandoned([]);
      return;
    }

    let active = true;
    setProfileBusy(true);

    getProfileReviews({ sortBy, order, limit: 50 }, token)
      .then((data) => {
        if (!active) {
          return;
        }
        setProfileRows(data.items || []);
        setTop10(data.top10 || []);
        setWatchLater(data.watchLater || []);
        setAbandoned(data.abandoned || []);
        setListsMessage("");
      })
      .catch((error) => {
        if (!active) {
          return;
        }
        setReviewMessage(error.message);
      })
      .finally(() => {
        if (active) {
          setProfileBusy(false);
        }
      });

    return () => {
      active = false;
    };
  }, [token, sortBy, order]);

  useEffect(() => {
    if (!search.trim() || search.trim().length < 2 || manualMode || !token) {
      setSearchResults([]);
      return;
    }

    let active = true;
    const timer = setTimeout(() => {
      setSearchBusy(true);
      searchMovies(search.trim())
        .then((data) => {
          if (active) {
            setSearchResults(data.results || []);
          }
        })
        .catch(() => {
          if (active) {
            setSearchResults([]);
          }
        })
        .finally(() => {
          if (active) {
            setSearchBusy(false);
          }
        });
    }, 350);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [search, manualMode, token]);

  /* ---- Watch Later inline search ---- */
  useEffect(() => {
    if (!wlSearch.trim() || wlSearch.trim().length < 2 || !token) {
      setWlResults([]);
      return;
    }
    let active = true;
    const timer = setTimeout(() => {
      setWlSearchBusy(true);
      searchMovies(wlSearch.trim())
        .then((data) => { if (active) setWlResults(data.results || []); })
        .catch(() => { if (active) setWlResults([]); })
        .finally(() => { if (active) setWlSearchBusy(false); });
    }, 350);
    return () => { active = false; clearTimeout(timer); };
  }, [wlSearch, token]);

  /* ---- Abandoned inline search ---- */
  useEffect(() => {
    if (!abSearch.trim() || abSearch.trim().length < 2 || !token) {
      setAbResults([]);
      return;
    }
    let active = true;
    const timer = setTimeout(() => {
      setAbSearchBusy(true);
      searchMovies(abSearch.trim())
        .then((data) => { if (active) setAbResults(data.results || []); })
        .catch(() => { if (active) setAbResults([]); })
        .finally(() => { if (active) setAbSearchBusy(false); });
    }, 350);
    return () => { active = false; clearTimeout(timer); };
  }, [abSearch, token]);

  async function handleAuthSubmit(event) {
    event.preventDefault();
    setAuthError("");
    setIsSubmittingAuth(true);
    try {
      const action = authMode === "signup" ? signUp : signIn;
      const payload =
        authMode === "signup"
          ? authForm
          : { email: authForm.email, password: authForm.password };
      const data = await action(payload);
      setToken(data.token);
      setUser(data.user);
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      setAuthForm({ username: "", email: "", password: "" });
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setIsSubmittingAuth(false);
    }
  }

  function logout() {
    setToken("");
    setUser(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setSearch("");
    setSearchResults([]);
    setSelectedMovie(null);
    setManualMode(false);
    setWatchLater([]);
    setAbandoned([]);
    setTop10Message("");
    setListsMessage("");
  }

  async function handleSaveReview(event) {
    event.preventDefault();
    if (!token) {
      return;
    }

    try {
      if (manualMode) {
        await saveManualReview(
          {
            ...manualMovie,
            year: manualMovie.year ? Number(manualMovie.year) : null,
            rating: Number(reviewForm.rating),
            comment: reviewForm.comment
          },
          token
        );
      } else {
        if (!selectedMovie) {
          setReviewMessage(
            "Выберите фильм из выпадающего списка или включите ручной режим."
          );
          return;
        }
        await saveReview(
          {
            externalId: selectedMovie.externalId,
            title: selectedMovie.title,
            posterUrl: selectedMovie.posterUrl,
            year: selectedMovie.year,
            rating: Number(reviewForm.rating),
            comment: reviewForm.comment
          },
          token
        );
      }

      setReviewMessage("Сохранено.");
      setReviewForm({ rating: 5, comment: "" });
      if (!manualMode) {
        setSelectedMovie(null);
      }
      const fresh = await getProfileReviews({ sortBy, order, limit: 50 }, token);
      setProfileRows(fresh.items || []);
      setTop10(fresh.top10 || []);
      setWatchLater(fresh.watchLater || []);
      setAbandoned(fresh.abandoned || []);
    } catch (error) {
      setReviewMessage(error.message);
    }
  }

  function onSort(nextSortBy) {
    if (nextSortBy === sortBy) {
      setOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(nextSortBy);
      setOrder("desc");
    }
  }

  async function persistTop10(nextReviewIds) {
    if (!token) {
      return;
    }

    setTop10Busy(true);
    setTop10Message("");

    try {
      const data = await saveTop10(nextReviewIds, token);
      const nextTop = data.top10 || [];
      setTop10(nextTop);

      const positionMap = new Map(nextTop.map((row, index) => [row.id, Number(row.topPosition || index + 1)]));
      setProfileRows((prev) =>
        prev.map((row) => ({
          ...row,
          topPosition: positionMap.get(row.id) || null
        }))
      );
    } catch (error) {
      setTop10Message(error.message);
    } finally {
      setTop10Busy(false);
    }
  }

  function onToggleTop10(row) {
    const existingIndex = top10.findIndex((item) => item.id === row.id);
    if (existingIndex >= 0) {
      const nextIds = top10
        .filter((item) => item.id !== row.id)
        .map((item) => item.id);
      void persistTop10(nextIds);
      return;
    }

    if (top10.length >= 10) {
      setTop10Message("В Top-10 можно добавить только 10 фильмов.");
      return;
    }

    const nextIds = [...top10.map((item) => item.id), row.id];
    void persistTop10(nextIds);
  }

  function onMoveTop10(reviewId, direction) {
    const currentIndex = top10.findIndex((item) => item.id === reviewId);
    if (currentIndex < 0) {
      return;
    }
    const nextIndex = currentIndex + direction;
    if (nextIndex < 0 || nextIndex >= top10.length) {
      return;
    }

    const nextTop = [...top10];
    [nextTop[currentIndex], nextTop[nextIndex]] = [nextTop[nextIndex], nextTop[currentIndex]];
    void persistTop10(nextTop.map((item) => item.id));
  }

  function onRemoveFromTop10(reviewId) {
    const nextIds = top10
      .filter((item) => item.id !== reviewId)
      .map((item) => item.id);
    void persistTop10(nextIds);
  }

  /* ---- Watch Later (movie-based) ---- */

  async function onAddToWatchLater(movie) {
    if (!token) {
      return;
    }
    setWatchLaterBusy(true);
    setListsMessage("");
    try {
      const data = await addToWatchLater(
        {
          externalId: movie.externalId,
          title: movie.title,
          posterUrl: movie.posterUrl,
          year: movie.year
        },
        token
      );
      setWatchLater(data.watchLater || []);
    } catch (error) {
      setListsMessage(error.message);
    } finally {
      setWatchLaterBusy(false);
    }
  }

  async function onRemoveFromWatchLater(movieId) {
    if (!token) {
      return;
    }
    setWatchLaterBusy(true);
    setListsMessage("");
    try {
      const data = await removeFromWatchLater(movieId, token);
      setWatchLater(data.watchLater || []);
    } catch (error) {
      setListsMessage(error.message);
    } finally {
      setWatchLaterBusy(false);
    }
  }

  /* ---- Abandoned (movie-based) ---- */

  async function addAbandonedWithProgress(movie, stoppedSeason, stoppedEpisode) {
    if (!token) return;
    setAbandonedBusy(true);
    setListsMessage("");
    try {
      const data = await addToAbandoned(
        {
          externalId: movie.externalId,
          title: movie.title,
          posterUrl: movie.posterUrl,
          year: movie.year,
          stoppedSeason: stoppedSeason ? Number(stoppedSeason) : null,
          stoppedEpisode: stoppedEpisode ? Number(stoppedEpisode) : null
        },
        token
      );
      setAbandoned(data.abandoned || []);
    } catch (error) {
      setListsMessage(error.message);
    } finally {
      setAbandonedBusy(false);
    }
  }

  async function onAddToAbandoned(movie) {
    if (!token) return;
    if (movie.type === "series") {
      setSeriesModal({ movie, stoppedSeason: "", stoppedEpisode: "" });
    } else {
      await addAbandonedWithProgress(movie, null, null);
    }
  }

  async function onConfirmSeriesModal() {
    if (!seriesModal) return;
    const { movie, stoppedSeason, stoppedEpisode } = seriesModal;
    setSeriesModal(null);
    await addAbandonedWithProgress(movie, stoppedSeason, stoppedEpisode);
  }

  function onSkipSeriesModal() {
    if (!seriesModal) return;
    const { movie } = seriesModal;
    setSeriesModal(null);
    void addAbandonedWithProgress(movie, null, null);
  }

  async function onRemoveFromAbandoned(movieId) {
    if (!token) {
      return;
    }
    setAbandonedBusy(true);
    setListsMessage("");
    try {
      const data = await removeFromAbandoned(movieId, token);
      setAbandoned(data.abandoned || []);
    } catch (error) {
      setListsMessage(error.message);
    } finally {
      setAbandonedBusy(false);
    }
  }

  /** Check if a search-result movie is already in a list by externalId */
  function isMovieInWatchLater(movie) {
    return watchLater.some((row) => row.externalId === movie.externalId);
  }

  function isMovieInAbandoned(movie) {
    return abandoned.some((row) => row.externalId === movie.externalId);
  }

  return (
    <div className={token ? "page tracker-main-mode" : "page tracker-auth-mode"}>
      {token ? <div className="tracker-main-aura" /> : <div className="tracker-auth-aura" />}

      {/* ---- Series Progress Modal ---- */}
      {seriesModal ? (
        <div className="series-modal-overlay" onClick={onSkipSeriesModal}>
          <div className="series-modal" onClick={(e) => e.stopPropagation()}>
            <p className="series-modal-kicker">{"📺 Это сериал!"}</p>
            <h3 className="series-modal-title">{seriesModal.movie.title}</h3>
            <p className="series-modal-sub">{"На чём остановился? (необязательно)"}</p>
            <div className="series-modal-fields">
              <label>
                {"Сезон"}
                <input
                  type="number"
                  min="1"
                  placeholder="1"
                  value={seriesModal.stoppedSeason}
                  onChange={(e) =>
                    setSeriesModal((v) => ({ ...v, stoppedSeason: e.target.value }))
                  }
                />
              </label>
              <label>
                {"Серия"}
                <input
                  type="number"
                  min="1"
                  placeholder="1"
                  value={seriesModal.stoppedEpisode}
                  onChange={(e) =>
                    setSeriesModal((v) => ({ ...v, stoppedEpisode: e.target.value }))
                  }
                />
              </label>
            </div>
            <div className="series-modal-actions">
              <button
                type="button"
                className="series-modal-btn-confirm"
                onClick={onConfirmSeriesModal}
                disabled={abandonedBusy}
              >
                {"Добавить"}
              </button>
              <button
                type="button"
                className="series-modal-btn-skip"
                onClick={onSkipSeriesModal}
                disabled={abandonedBusy}
              >
                {"Пропустить"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <main className="container">
        <header className={token ? "hero tracker-main-hero" : "hero tracker-auth-hero"}>
          {token ? (
            <>
              <h1>{"Рабочая зона KinoPulse"}</h1>
              <p>
                {
                  "Ищите фильмы, ставьте оценки, пишите комментарии и ведите Top-10, «Посмотреть позже» и «Заброшено» в одном потоке."
                }
              </p>
            </>
          ) : (
            <h1>
              {"Вход в "} <em>KinoPulse</em>
              <span className="tracker-auth-dot">.</span>
            </h1>
          )}
          {token ? null : (
            <p>
              {"Создайте аккаунт или войдите, чтобы хранить оценки и комментарии в личном профиле."}
            </p>
          )}
          {token ? null : (
            <p>
              <Link to="/">На главную</Link>
            </p>
          )}
        </header>

        {!token ? (
          <section className="panel auth-panel tracker-auth-panel">
            <div className="mode-switch">
              <button
                type="button"
                className={authMode === "login" ? "active" : ""}
                onClick={() => setAuthMode("login")}
              >{"Вход"}</button>
              <button
                type="button"
                className={authMode === "signup" ? "active" : ""}
                onClick={() => setAuthMode("signup")}
              >{"Регистрация"}</button>
            </div>

            <form onSubmit={handleAuthSubmit} className="stack">
              {authMode === "signup" ? (
                <label>
                  {"Имя пользователя"}
                  <input
                    value={authForm.username}
                    onChange={(e) => setAuthForm((v) => ({ ...v, username: e.target.value }))}
                    required
                  />
                </label>
              ) : null}

              <label>
                {"Email"}
                <input
                  type="email"
                  value={authForm.email}
                  onChange={(e) => setAuthForm((v) => ({ ...v, email: e.target.value }))}
                  required
                />
              </label>

              <label>
                {"Пароль"}
                <input
                  type="password"
                  value={authForm.password}
                  onChange={(e) => setAuthForm((v) => ({ ...v, password: e.target.value }))}
                  required
                />
              </label>

              <button type="submit" disabled={isSubmittingAuth}>
                {isSubmittingAuth
                  ? "Подождите..."
                  : authMode === "signup"
                    ? "Создать аккаунт"
                    : "Войти"}
              </button>
            </form>

            {authError ? <p className="error">{authError}</p> : null}
          </section>
        ) : (
          <>
            <section className="panel tracker-main-head">
              <div className="tracker-main-head-copy">
                <p className="tracker-main-kicker">{"Профиль"}</p>
                <h2>
                  {"Добро пожаловать, "}
                  {user?.username}
                </h2>
                <p className="tracker-main-email">{user?.email}</p>
              </div>
              <div className="tracker-main-head-actions">
                <Link to="/collections" className="tracker-link-minimal">
                  {"Подборки"}
                </Link>
                <Link to="/library" className="tracker-link-minimal">
                  {"Библиотека"}
                </Link>
                <Link to="/" className="tracker-link-minimal">
                  {"На главную"}
                </Link>
                <button type="button" className="tracker-logout-btn" onClick={logout}>
                  {"Выйти"}
                </button>
              </div>
            </section>

            <section className="panel tracker-stat-rail">
              <div className="tracker-stat-item">
                <span className="tracker-stat-label">{"фильмов в логе"}</span>
                <strong className="tracker-stat-value">{trackerStats.total}</strong>
              </div>
              <div className="tracker-stat-item">
                <span className="tracker-stat-label">{"средняя оценка"}</span>
                <strong className="tracker-stat-value">{trackerStats.avg}</strong>
              </div>
              <div className="tracker-stat-item">
                <span className="tracker-stat-label">{"заметок"}</span>
                <strong className="tracker-stat-value">{trackerStats.notes}</strong>
              </div>
            </section>

            {/* ---- Ratings Timeline Chart ---- */}
            <section className="panel tracker-timeline-panel">
              <div className="panel-head">
                <h3>{"Шкала оценок"}</h3>
                <p>{`${profileRows.length} оценок`}</p>
              </div>
              <RatingsTimeline rows={profileRows} />
            </section>

            <div className="tracker-workspace">
              <section className="panel tracker-editor-panel">
                <div className="panel-head">
                  <h3>{"Добавить или обновить отзыв"}</h3>
                  <label className="inline">
                    <input
                      type="checkbox"
                      checked={manualMode}
                      onChange={(e) => {
                        setManualMode(e.target.checked);
                        setSelectedMovie(null);
                        setSearchResults([]);
                      }}
                    />
                    {"Ручной режим"}
                  </label>
                </div>

                {!manualMode ? (
                  <div className="search-box">
                    <label>
                      {"Умный поиск"}
                      <input
                        placeholder="Введите название фильма..."
                        value={search}
                        onChange={(e) => {
                          setSearch(e.target.value);
                          setSelectedMovie(null);
                        }}
                      />
                    </label>
                    {searchBusy ? <p className="hint">{"Ищем..."}</p> : null}
                    {searchResults.length > 0 ? (
                      <ul className="dropdown">
                        {searchResults.map((movie) => (
                          <li key={movie.externalId} className="search-result-item">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedMovie(movie);
                                setSearch(`${movie.title}${movie.year ? ` (${movie.year})` : ""}`);
                                setSearchResults([]);
                              }}
                            >
                              <div className="movie-meta">
                                {movie.posterUrl ? (
                                  <img src={movie.posterUrl} alt={movie.title} loading="lazy" />
                                ) : (
                                  <div className="poster-empty">{"Без постера"}</div>
                                )}
                                <div>
                                  <strong>{movie.title}</strong>
                                  <span>{movie.year || "н/д"}</span>
                                </div>
                              </div>
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {selectedMovie ? (
                      <p className="selected">
                        {"Выбрано: "}
                        {selectedMovieLabel}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <div className="manual-grid">
                    <label>
                      {"Название"}
                      <input
                        value={manualMovie.title}
                        onChange={(e) => setManualMovie((v) => ({ ...v, title: e.target.value }))}
                        required={manualMode}
                      />
                    </label>
                    <label>
                      {"Год"}
                      <input
                        value={manualMovie.year}
                        onChange={(e) => setManualMovie((v) => ({ ...v, year: e.target.value }))}
                        placeholder="2014"
                      />
                    </label>
                    <label>
                      {"URL постера"}
                      <input
                        value={manualMovie.posterUrl}
                        onChange={(e) => setManualMovie((v) => ({ ...v, posterUrl: e.target.value }))}
                        placeholder="https://..."
                      />
                    </label>
                  </div>
                )}

                <form className="review-form" onSubmit={handleSaveReview}>
                  <label className="rating-field">
                    {"Оценка"}
                    <RatingPicker
                      value={reviewForm.rating}
                      onChange={(rating) => setReviewForm((v) => ({ ...v, rating }))}
                    />
                  </label>

                  <label>
                    {"Комментарий"}
                    <textarea
                      value={reviewForm.comment}
                      onChange={(e) => setReviewForm((v) => ({ ...v, comment: e.target.value }))}
                      placeholder="Ваше впечатление..."
                    />
                  </label>

                  <button type="submit">{"Сохранить отзыв"}</button>
                </form>
                {reviewMessage ? <p className="hint">{reviewMessage}</p> : null}
              </section>

              <div className="tracker-side-stack">
                <section className="panel tracker-top-panel">
                  <div className="panel-head">
                    <h3>{"Личный Top-10"}</h3>
                    <p>
                      {top10Busy
                        ? "Сохранение..."
                        : `${top10.length} фильмов`}
                    </p>
                  </div>
                  <p className="hint">{"Собирайте список вручную из таблицы профиля ниже."}</p>
                  {top10.length === 0 ? (
                    <p className="hint">{"Пока пусто. Добавьте фильмы кнопкой «В Top-10» в таблице."}</p>
                  ) : (
                    <ol className="top-list">
                      {top10.map((row, index) => (
                        <li key={row.id}>
                          <div className="top-row-main">
                            <span className="top-row-position">{`#${index + 1}`}</span>
                            <div className="top-row-copy">
                              <div>
                                <strong>{row.title}</strong> {row.year ? `(${row.year})` : ""}
                              </div>
                              <Stars value={row.rating} />
                            </div>
                          </div>
                          <div className="top-row-actions">
                            <button
                              type="button"
                              className="top-mini-btn"
                              onClick={() => onMoveTop10(row.id, -1)}
                              disabled={top10Busy || index === 0}
                              aria-label="Поднять выше"
                            >
                              {"↑"}
                            </button>
                            <button
                              type="button"
                              className="top-mini-btn"
                              onClick={() => onMoveTop10(row.id, 1)}
                              disabled={top10Busy || index === top10.length - 1}
                              aria-label="Опустить ниже"
                            >
                              {"↓"}
                            </button>
                            <button
                              type="button"
                              className="top-mini-btn top-mini-btn-danger"
                              onClick={() => onRemoveFromTop10(row.id)}
                              disabled={top10Busy}
                            >
                              {"Убрать"}
                            </button>
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}
                  {top10Message ? <p className="hint">{top10Message}</p> : null}
                </section>

                <section className="panel tracker-watch-later-panel">
                  <div className="panel-head">
                    <h3>{"Посмотреть позже"}</h3>
                    <p>{watchLaterBusy ? "Сохранение..." : `${watchLater.length} фильмов`}</p>
                  </div>
                  <div className="list-search-box">
                    <input
                      className="list-search-input"
                      placeholder="Найти фильм..."
                      value={wlSearch}
                      onChange={(e) => setWlSearch(e.target.value)}
                    />
                    {wlSearchBusy ? <p className="hint">{"Ищем..."}</p> : null}
                    {wlResults.length > 0 ? (
                      <ul className="dropdown list-search-dropdown">
                        {wlResults.map((movie) => (
                          <li key={movie.externalId} className="search-result-item">
                            <button
                              type="button"
                              onClick={() => {
                                void onAddToWatchLater(movie);
                                setWlSearch("");
                                setWlResults([]);
                              }}
                            >
                              <div className="movie-meta">
                                {movie.posterUrl ? (
                                  <img src={movie.posterUrl} alt={movie.title} loading="lazy" />
                                ) : (
                                  <div className="poster-empty">{"Без постера"}</div>
                                )}
                                <div>
                                  <strong>{movie.title}</strong>
                                  <span>{movie.year || "н/д"}</span>
                                </div>
                              </div>
                            </button>
                            <div className="search-result-actions">
                              <button
                                type="button"
                                className="search-action-btn search-action-watch"
                                onClick={() => {
                                  void onAddToWatchLater(movie);
                                  setWlSearch("");
                                  setWlResults([]);
                                }}
                                disabled={watchLaterBusy}
                              >
                                {"Добавить"}
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                  {watchLater.length === 0 ? (
                    <p className="hint">{"Пока пусто. Используйте поиск выше, чтобы добавить фильмы."}</p>
                  ) : (
                    <ul className="queue-list">
                      {watchLater.map((row) => (
                        <li key={row.movieId}>
                          <div className="queue-list-copy">
                            <strong>{row.title}</strong> {row.year ? `(${row.year})` : ""}
                          </div>
                          <button
                            type="button"
                            className="queue-remove-btn"
                            onClick={() => onRemoveFromWatchLater(row.movieId)}
                            disabled={watchLaterBusy}
                          >
                            {"Убрать"}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="panel tracker-abandoned-panel">
                  <div className="panel-head">
                    <h3>{"Заброшено"}</h3>
                    <p>{abandonedBusy ? "Сохранение..." : `${abandoned.length} фильмов`}</p>
                  </div>
                  <div className="list-search-box">
                    <input
                      className="list-search-input"
                      placeholder="Найти фильм..."
                      value={abSearch}
                      onChange={(e) => setAbSearch(e.target.value)}
                    />
                    {abSearchBusy ? <p className="hint">{"Ищем..."}</p> : null}
                    {abResults.length > 0 ? (
                      <ul className="dropdown list-search-dropdown">
                        {abResults.map((movie) => (
                          <li key={movie.externalId} className="search-result-item">
                            <button
                              type="button"
                              onClick={() => {
                                void onAddToAbandoned(movie);
                                setAbSearch("");
                                setAbResults([]);
                              }}
                            >
                              <div className="movie-meta">
                                {movie.posterUrl ? (
                                  <img src={movie.posterUrl} alt={movie.title} loading="lazy" />
                                ) : (
                                  <div className="poster-empty">{"Без постера"}</div>
                                )}
                                <div>
                                  <strong>{movie.title}</strong>
                                  <span>{movie.year || "н/д"}</span>
                                </div>
                              </div>
                            </button>
                            <div className="search-result-actions">
                              <button
                                type="button"
                                className="search-action-btn search-action-drop"
                                onClick={() => {
                                  void onAddToAbandoned(movie);
                                  setAbSearch("");
                                  setAbResults([]);
                                }}
                                disabled={abandonedBusy}
                              >
                                {"Добавить"}
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                  {abandoned.length === 0 ? (
                    <p className="hint">{"Пока пусто. Используйте поиск выше, чтобы добавить фильмы."}</p>
                  ) : (
                    <ul className="queue-list">
                      {abandoned.map((row) => (
                        <li key={row.movieId}>
                          <div className="queue-list-copy">
                            <strong>{row.title}</strong> {row.year ? `(${row.year})` : ""}
                            {(row.stoppedSeason || row.stoppedEpisode) ? (
                              <span className="abandoned-progress">
                                {row.stoppedSeason ? `Сезон ${row.stoppedSeason}` : ""}
                                {row.stoppedSeason && row.stoppedEpisode ? ", " : ""}
                                {row.stoppedEpisode ? `серия ${row.stoppedEpisode}` : ""}
                              </span>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            className="queue-remove-btn"
                            onClick={() => onRemoveFromAbandoned(row.movieId)}
                            disabled={abandonedBusy}
                          >
                            {"Убрать"}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
                {listsMessage ? <p className="hint">{listsMessage}</p> : null}
              </div>
            </div>

            <section className="panel tracker-table-panel">
              <div className="panel-head">
                <h3>{"Таблица профиля"}</h3>
                <p>
                  {profileBusy
                    ? "Загрузка..."
                    : `${profileRows.length} фильмов`}
                </p>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>
                        <button type="button" onClick={() => onSort("title")}>
                          {"Название"}
                        </button>
                      </th>
                      <th>
                        <button type="button" onClick={() => onSort("rating")}>
                          {"Оценка"}
                        </button>
                      </th>
                      <th>
                        <button type="button" onClick={() => onSort("createdAt")}>
                          {"Дата"}
                        </button>
                      </th>
                      <th>{"Комментарий"}</th>
                      <th>{"Top-10"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profileRows.map((row) => {
                      const topPosition = top10PositionByReviewId.get(row.id) || null;
                      return (
                        <tr key={row.id}>
                          <td>{row.title}</td>
                          <td>
                            <Stars value={row.rating} />
                          </td>
                          <td>{formatDate(row.createdAt)}</td>
                          <td>{row.comment || "-"}</td>
                          <td className="table-top-cell">
                            <button
                              type="button"
                              className={`top-toggle-btn${topPosition ? " active" : ""}`}
                              onClick={() => onToggleTop10(row)}
                              disabled={top10Busy}
                            >
                              {topPosition ? `В топе #${topPosition}` : "В Top-10"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
