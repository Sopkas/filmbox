import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { getReviewByExternalId, getReviewByMovieId } from "../api";
import PageHeader from "../components/ui/PageHeader";
import StateBlock from "../components/ui/StateBlock";
import "./MovieDetailPage.css";

const TOKEN_KEY = "kinopulse_token";

function formatDate(value) {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleDateString();
}

function Stars({ value }) {
  const num = Number(value) || 0;
  const stars = [];
  for (let i = 1; i <= 5; i += 1) {
    stars.push(
      <span key={i} className={num >= i ? "movie-star movie-star-full" : "movie-star movie-star-empty"}>
        {num >= i ? "★" : "☆"}
      </span>
    );
  }
  return <span className="movie-stars">{stars}</span>;
}

export default function MovieDetailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const token = localStorage.getItem(TOKEN_KEY) || "";

  const movieIdParam = searchParams.get("movieId");
  const externalIdParam = searchParams.get("externalId");
  const movieId = movieIdParam ? Number(movieIdParam) : null;
  const externalId = externalIdParam ? Number(externalIdParam) : null;

  const initialMovie = location.state?.movie || null;
  const initialReview = location.state?.review || null;
  const fromPath = location.state?.fromPath || "";
  const fromLabel = location.state?.fromLabel || "Библиотека";

  const [movie, setMovie] = useState(initialMovie);
  const [review, setReview] = useState(initialReview);
  const [loading, setLoading] = useState(Boolean(token && (movieId || externalId)));
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token || (!movieId && !externalId)) {
      setLoading(false);
      return undefined;
    }

    let active = true;
    setLoading(true);
    setError("");

    const fetchReview = movieId
      ? getReviewByMovieId(movieId, token)
      : getReviewByExternalId(externalId, token);

    fetchReview
      .then((data) => {
        if (!active) {
          return;
        }
        setReview(data.review || null);
        if (!movie && data.review) {
          setMovie({
            movieId: data.review.movieId,
            externalId: data.review.externalId,
            title: data.review.title,
            year: data.review.year,
            posterUrl: data.review.posterUrl
          });
        }
      })
      .catch((err) => {
        if (!active) {
          return;
        }
        setError(err.message || "Не удалось загрузить детали фильма.");
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [token, movieId, externalId, movie]);

  const sourceLabel = useMemo(() => {
    if (movie?.externalId) {
      return "ПоискКино";
    }
    return "Ручной ввод";
  }, [movie]);

  function handleBack() {
    if (fromPath) {
      navigate(fromPath);
      return;
    }
    navigate(-1);
  }

  if (!movie) {
    return (
      <div className="movie-page">
        <main className="movie-container" id="main-content">
          <StateBlock
            variant="error"
            title="Фильм недоступен"
            message="Не удалось найти данные фильма для этого маршрута."
            actionLabel="Открыть трекер"
            onAction={() => navigate("/tracker")}
          />
          <Link to={fromPath || "/tracker"} className="movie-back-link">
            {`← ${fromLabel}`}
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="movie-page">
      <main className="movie-container" id="main-content">
        <PageHeader
          className="movie-page-header"
          breadcrumbs={[
            { label: fromLabel, to: fromPath || "/library" },
            { label: movie.title }
          ]}
          kicker="Фильм"
          title="Карточка фильма"
          subtitle={movie.title}
          actions={
            <button type="button" className="movie-back-btn" onClick={handleBack}>
              {`← ${fromLabel}`}
            </button>
          }
        />

        <section className="movie-layout">
          <div className="movie-poster-wrap">
            {movie.posterUrl ? (
              <img src={movie.posterUrl} alt={movie.title} className="movie-poster" loading="lazy" />
            ) : (
              <div className="movie-poster-empty">Нет постера</div>
            )}
          </div>

          <div className="movie-main">
            <h1>{movie.title}</h1>
            <ul className="movie-meta">
              <li>
                <span>Год</span>
                <strong>{movie.year || "-"}</strong>
              </li>
              <li>
                <span>Источник</span>
                <strong>{sourceLabel}</strong>
              </li>
              <li>
                <span>Внешний ID</span>
                <strong>{movie.externalId || "-"}</strong>
              </li>
              <li>
                <span>Локальный ID</span>
                <strong>{movie.movieId || "-"}</strong>
              </li>
            </ul>
          </div>
        </section>

        <section className="movie-review-panel" aria-live="polite">
          <h2>Контекст отзыва</h2>
          {loading ? <p>Загружаем контекст отзыва...</p> : null}
          {error ? <p className="movie-error">{error}</p> : null}
          {!loading && !error && !review ? (
            <p>
              У вас пока нет отзыва на этот фильм. <Link to="/tracker">Добавьте его в трекере</Link>.
            </p>
          ) : null}
          {review ? (
            <div className="movie-review-details">
              <div className="movie-rating-row">
                <Stars value={review.rating} />
                <span>{Number(review.rating).toFixed(1)} / 5</span>
                {review.topPosition ? <span className="movie-top-badge">{`Топ #${review.topPosition}`}</span> : null}
              </div>
              <p className="movie-comment">{review.comment || "Без комментария."}</p>
              <div className="movie-review-meta">
                <span>{`Создано: ${formatDate(review.createdAt)}`}</span>
                <span>{`Обновлено: ${formatDate(review.updatedAt)}`}</span>
              </div>
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}
