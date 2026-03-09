import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { deleteReview, getProfileReviews, updateReview } from "../api";
import PageHeader from "../components/ui/PageHeader";
import StateBlock from "../components/ui/StateBlock";
import "./LibraryPage.css";

const TOKEN_KEY = "kinopulse_token";
const USER_KEY = "kinopulse_user";
const PAGE_SIZE = 24;

function Stars({ value }) {
  const num = Number(value) || 0;
  const stars = [];
  for (let i = 1; i <= 5; i += 1) {
    if (num >= i) {
      stars.push(
        <span key={i} className="lib-star-icon lib-star-full">
          {"\u2605"}
        </span>
      );
    } else if (num >= i - 0.5) {
      stars.push(
        <span key={i} className="lib-star-icon lib-star-half">
          <span className="lib-star-bg">{"\u2606"}</span>
          <span className="lib-star-fg">{"\u2605"}</span>
        </span>
      );
    } else {
      stars.push(
        <span key={i} className="lib-star-icon lib-star-empty">
          {"\u2606"}
        </span>
      );
    }
  }
  return <span className="lib-stars">{stars}</span>;
}

export default function LibraryPage() {
  const navigate = useNavigate();
  const [token] = useState(() => localStorage.getItem(TOKEN_KEY) || "");
  const [user] = useState(() => {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  });

  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [filterText, setFilterText] = useState("");
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [total, setTotal] = useState(0);

  const [editingReview, setEditingReview] = useState(null);
  const [editForm, setEditForm] = useState({ rating: 5, comment: "" });
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState("");

  const fetchLibrary = useCallback(
    async ({ nextPage = 1, append = false } = {}) => {
      if (!token) {
        return;
      }

      if (!append) {
        setLoading(true);
        setLoadError("");
      }

      try {
        const data = await getProfileReviews(
          { sortBy: "createdAt", order: "desc", limit: PAGE_SIZE, page: nextPage },
          token
        );
        const nextItems = data.items || [];

        setMovies((prev) => {
          if (!append) {
            return nextItems;
          }

          const seen = new Set(prev.map((row) => row.id));
          const merged = [...prev];
          for (const row of nextItems) {
            if (!seen.has(row.id)) {
              merged.push(row);
            }
          }
          return merged;
        });

        const pagination = data.pagination || {};
        setPage(Number(pagination.page || nextPage));
        setHasNext(Boolean(pagination.hasNext));
        setTotal(Number(pagination.total || 0));
      } catch (error) {
        if (!append) {
          setMovies([]);
          setLoadError(error.message || "Не удалось загрузить библиотеку. Попробуйте снова.");
        }
      } finally {
        if (!append) {
          setLoading(false);
        }
        setLoadingMore(false);
      }
    },
    [token]
  );

  useEffect(() => {
    if (!token) {
      navigate("/tracker");
      return;
    }
    void fetchLibrary({ nextPage: 1, append: false });
  }, [token, navigate, fetchLibrary]);

  const filtered = filterText.trim()
    ? movies.filter((movie) => movie.title.toLowerCase().includes(filterText.toLowerCase()))
    : movies;

  function openEditReview(row) {
    setEditingReview(row);
    setEditForm({
      rating: Number(row.rating) || 5,
      comment: row.comment || ""
    });
    setEditError("");
  }

  function closeEditReview() {
    setEditingReview(null);
    setEditError("");
    setEditBusy(false);
  }

  async function handleUpdateReview(event) {
    event.preventDefault();
    if (!editingReview) {
      return;
    }

    setEditBusy(true);
    setEditError("");
    try {
      const data = await updateReview(
        editingReview.id,
        { rating: Number(editForm.rating), comment: editForm.comment },
        token
      );
      const nextReview = data.review;
      setMovies((prev) =>
        prev.map((row) =>
          row.id === editingReview.id
            ? {
                ...row,
                rating: nextReview.rating,
                comment: nextReview.comment,
                updatedAt: nextReview.updatedAt
              }
            : row
        )
      );
      closeEditReview();
    } catch (error) {
      setEditError(error.message || "Не удалось обновить отзыв.");
      setEditBusy(false);
    }
  }

  async function handleDeleteReview(row) {
    if (!window.confirm("Удалить этот отзыв?")) {
      return;
    }

    try {
      await deleteReview(row.id, token);
      setMovies((prev) => prev.filter((item) => item.id !== row.id));
      setTotal((prev) => Math.max(0, prev - 1));
    } catch (error) {
      setLoadError(error.message || "Не удалось удалить отзыв.");
    }
  }

  function handleLoadMore() {
    if (!hasNext || loadingMore) {
      return;
    }
    setLoadingMore(true);
    void fetchLibrary({ nextPage: page + 1, append: true });
  }

  return (
    <div className="lib-page">
      <div className="lib-aura" />

      {editingReview ? (
        <div className="lib-edit-overlay" onClick={closeEditReview}>
          <div className="lib-edit-modal" onClick={(event) => event.stopPropagation()}>
            <h2>Редактирование отзыва</h2>
            <p className="lib-edit-title">{editingReview.title}</p>
            <form className="stack" onSubmit={handleUpdateReview}>
              <label>
                Оценка
                <input
                  type="number"
                  min="0.5"
                  max="5"
                  step="0.5"
                  value={editForm.rating}
                  onChange={(event) =>
                    setEditForm((prev) => ({ ...prev, rating: event.target.value }))
                  }
                  required
                />
              </label>
              <label>
                Комментарий
                <textarea
                  value={editForm.comment}
                  onChange={(event) =>
                    setEditForm((prev) => ({ ...prev, comment: event.target.value }))
                  }
                />
              </label>
              {editError ? <p className="lib-edit-error">{editError}</p> : null}
              <div className="lib-edit-actions">
                <button type="submit" disabled={editBusy}>
                  {editBusy ? "Сохраняем..." : "Сохранить"}
                </button>
                <button type="button" className="lib-edit-cancel" onClick={closeEditReview}>
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <main className="lib-container" id="main-content">
        <PageHeader
          className="lib-header"
          kicker="Библиотека"
          title={
            <>
              Просмотренные фильмы
              <span className="lib-dot">.</span>
            </>
          }
          subtitle={
            user
              ? `${user.username} - ${total || movies.length} фильмов в коллекции`
              : "Все ваши сохранённые отзывы в одном месте."
          }
        />

        <div className="lib-filter-bar">
          <input
            className="lib-filter-input"
            placeholder="Фильтр по названию..."
            value={filterText}
            onChange={(event) => setFilterText(event.target.value)}
            aria-label="Фильтр библиотеки по названию"
          />
          <span className="lib-filter-count">{`${filtered.length} из ${movies.length}`}</span>
        </div>

        {loading ? (
          <StateBlock variant="loading" title="Загрузка библиотеки..." />
        ) : loadError ? (
          <StateBlock
            variant="error"
            title="Библиотека недоступна"
            message={loadError}
            actionLabel="Повторить"
            onAction={() => void fetchLibrary({ nextPage: 1, append: false })}
          />
        ) : filtered.length === 0 ? (
          <StateBlock
            variant="empty"
            title={movies.length > 0 ? "Ничего не найдено" : "Фильмов пока нет"}
            message={movies.length > 0 ? "Попробуйте другое значение фильтра." : "Добавьте фильмы в трекере, и они появятся здесь."}
          />
        ) : (
          <>
            <div className="lib-grid">
              {filtered.map((movie) => (
                <div key={movie.id} className="lib-card">
                  <div className="lib-card-poster-wrap">
                    {movie.posterUrl ? (
                      <img src={movie.posterUrl} alt={movie.title} className="lib-card-poster" loading="lazy" />
                    ) : (
                      <div className="lib-card-poster lib-card-no-poster">Нет постера</div>
                    )}
                    <div className="lib-card-overlay">
                      {movie.comment ? (
                        <p className="lib-card-comment">{movie.comment}</p>
                      ) : (
                        <p className="lib-card-comment lib-card-comment-empty">Без комментария</p>
                      )}
                    </div>
                  </div>
                  <div className="lib-card-body">
                    <strong className="lib-card-title">{movie.title}</strong>
                    <div className="lib-card-meta">
                      <span className="lib-card-year">{movie.year || "-"}</span>
                      <Stars value={movie.rating} />
                    </div>
                    <div className="lib-card-actions">
                      <Link
                        className="lib-card-link-btn"
                        to={`/movie?movieId=${movie.movieId}${
                          movie.externalId ? `&externalId=${movie.externalId}` : ""
                        }`}
                        state={{ movie, review: movie, fromPath: "/library", fromLabel: "Библиотека" }}
                      >
                        Подробнее
                      </Link>
                      <button
                        type="button"
                        className="lib-card-mini-btn"
                        onClick={() => openEditReview(movie)}
                      >
                        Изменить
                      </button>
                      <button
                        type="button"
                        className="lib-card-mini-btn lib-card-mini-btn-danger"
                        onClick={() => void handleDeleteReview(movie)}
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {!filterText.trim() && hasNext ? (
              <div className="lib-load-more-wrap">
                <button
                  type="button"
                  className="lib-load-more-btn"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                >
                  {loadingMore ? "Загрузка..." : "Показать ещё"}
                </button>
              </div>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}
