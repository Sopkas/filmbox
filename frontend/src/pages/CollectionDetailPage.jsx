import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  addMovieToCollection,
  deleteCollection,
  getCollection,
  removeMovieFromCollection,
  reorderCollectionMovies,
  searchMovies,
  updateCollectionName
} from "../api";
import TrashIcon from "../components/TrashIcon";
import PageHeader from "../components/ui/PageHeader";
import SectionCard from "../components/ui/SectionCard";
import StateBlock from "../components/ui/StateBlock";
import "./CollectionDetailPage.css";

const TOKEN_KEY = "kinopulse_token";
const USER_KEY = "kinopulse_user";

function formatMovieCount(value) {
  const count = Number(value) || 0;
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) {
    return `${count} фильм`;
  }
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${count} фильма`;
  }
  return `${count} фильмов`;
}

export default function CollectionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [token] = useState(() => localStorage.getItem(TOKEN_KEY) || "");
  const [user] = useState(() => {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  });

  const [collection, setCollection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchError, setSearchError] = useState("");
  const [actionError, setActionError] = useState("");

  const [renameMode, setRenameMode] = useState(false);
  const [renameDraft, setRenameDraft] = useState("");
  const [renameBusy, setRenameBusy] = useState(false);

  const [orderDirty, setOrderDirty] = useState(false);
  const [orderBusy, setOrderBusy] = useState(false);

  const [search, setSearch] = useState("");
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [addingMovieId, setAddingMovieId] = useState(null);
  const [removingMovieId, setRemovingMovieId] = useState(null);
  const [deletingCollection, setDeletingCollection] = useState(false);

  const fetchCollection = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getCollection(id, token);
      const nextCollection = data.collection || null;
      setCollection(nextCollection);
      setRenameDraft(nextCollection?.name || "");
      setRenameMode(false);
      setOrderDirty(false);
    } catch (err) {
      setCollection(null);
      setError(err.message || "Не удалось загрузить подборку.");
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useEffect(() => {
    if (!token) {
      navigate("/tracker");
      return;
    }
    void fetchCollection();
  }, [token, navigate, fetchCollection]);

  useEffect(() => {
    if (!search.trim() || search.trim().length < 2) {
      setSearchResults([]);
      setSearchError("");
      return;
    }

    let active = true;
    const timer = setTimeout(() => {
      setSearchBusy(true);
      setSearchError("");
      searchMovies(search.trim())
        .then((data) => {
          if (!active) {
            return;
          }

          const existingExternalIds = new Set(
            (collection?.movies || [])
              .map((movie) => movie.externalId)
              .filter((value) => value !== null && value !== undefined)
          );

          const filtered = (data.results || []).filter((movie) => {
            if (movie.externalId === null || movie.externalId === undefined) {
              return true;
            }
            return !existingExternalIds.has(movie.externalId);
          });

          setSearchResults(filtered);
        })
        .catch(() => {
          if (active) {
            setSearchResults([]);
            setSearchError("Не удалось выполнить поиск фильмов. Попробуйте снова.");
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
  }, [search, collection?.movies]);

  async function handleAddMovie(movie) {
    if (!collection) {
      return;
    }

    setAddingMovieId(movie.externalId || movie.title);
    setActionError("");
    try {
      await addMovieToCollection(collection.id, movie, token);
      setSearch("");
      setSearchResults([]);
      await fetchCollection();
    } catch (err) {
      setActionError(err.message || "Не удалось добавить фильм в подборку.");
    } finally {
      setAddingMovieId(null);
    }
  }

  async function handleRemoveMovie(movieId) {
    if (!collection) {
      return;
    }

    setRemovingMovieId(movieId);
    setActionError("");
    try {
      await removeMovieFromCollection(collection.id, movieId, token);
      setCollection((prev) => {
        if (!prev) {
          return prev;
        }
        return {
          ...prev,
          movies: prev.movies.filter((movie) => movie.movieId !== movieId)
        };
      });
      setOrderDirty(false);
    } catch (err) {
      setActionError(err.message || "Не удалось удалить фильм из подборки.");
    } finally {
      setRemovingMovieId(null);
    }
  }

  async function handleDeleteCollection() {
    if (!collection) {
      return;
    }
    if (!window.confirm("Удалить эту подборку?")) {
      return;
    }

    setDeletingCollection(true);
    setActionError("");
    try {
      await deleteCollection(collection.id, token);
      navigate("/collections");
    } catch (err) {
      setActionError(err.message || "Не удалось удалить подборку.");
      setDeletingCollection(false);
    }
  }

  async function handleRenameSubmit(event) {
    event.preventDefault();
    if (!collection) {
      return;
    }

    const nextName = renameDraft.trim();
    if (!nextName) {
      setActionError("Название подборки не может быть пустым.");
      return;
    }

    setRenameBusy(true);
    setActionError("");
    try {
      const data = await updateCollectionName(collection.id, nextName, token);
      setCollection((prev) => {
        if (!prev) {
          return prev;
        }
        return {
          ...prev,
          name: data.collection?.name || nextName,
          updatedAt: data.collection?.updatedAt || prev.updatedAt
        };
      });
      setRenameMode(false);
    } catch (err) {
      setActionError(err.message || "Не удалось переименовать подборку.");
    } finally {
      setRenameBusy(false);
    }
  }

  function handleRenameCancel() {
    setRenameMode(false);
    setRenameDraft(collection?.name || "");
    setActionError("");
  }

  function handleMoveMovie(movieId, direction) {
    if (!collection || orderBusy) {
      return;
    }

    const currentIndex = collection.movies.findIndex((movie) => movie.movieId === movieId);
    const nextIndex = currentIndex + direction;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= collection.movies.length) {
      return;
    }

    const nextMovies = [...collection.movies];
    const [moved] = nextMovies.splice(currentIndex, 1);
    nextMovies.splice(nextIndex, 0, moved);

    setCollection((prev) => {
      if (!prev) {
        return prev;
      }
      return {
        ...prev,
        movies: nextMovies
      };
    });
    setOrderDirty(true);
    setActionError("");
  }

  async function handleSaveOrder() {
    if (!collection || !orderDirty) {
      return;
    }

    setOrderBusy(true);
    setActionError("");
    try {
      const movieIds = collection.movies.map((movie) => movie.movieId);
      const data = await reorderCollectionMovies(collection.id, movieIds, token);
      setCollection(data.collection || collection);
      setOrderDirty(false);
    } catch (err) {
      setActionError(err.message || "Не удалось сохранить порядок фильмов.");
    } finally {
      setOrderBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="cdetail-page">
        <main className="cdetail-container" id="main-content">
          <StateBlock variant="loading" title="Загрузка подборки..." />
        </main>
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="cdetail-page">
        <main className="cdetail-container" id="main-content">
          <StateBlock
            variant="error"
            title="Подборка не найдена"
            message={error || "Откройте страницу подборок и выберите существующую подборку."}
            actionLabel="Повторить"
            onAction={() => void fetchCollection()}
          />
          <Link to="/collections" className="cdetail-back-link">
            <span aria-hidden="true">←</span>
            <span>К подборкам</span>
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="cdetail-page">
      <div className="cdetail-aura" />
      <main className="cdetail-container" id="main-content">
        <PageHeader
          className="cdetail-hero"
          breadcrumbs={[
            { label: "Подборки", to: "/collections" },
            { label: collection.name }
          ]}
          kicker="Подборка"
          title={
            <>
              {collection.name}
              <span className="cdetail-dot">.</span>
            </>
          }
          subtitle={
            user
              ? `${user.username} - ${formatMovieCount(collection.movies.length)}`
              : formatMovieCount(collection.movies.length)
          }
          actions={
            <div className="cdetail-hero-actions">
              <button type="button" className="cdetail-rename-trigger" onClick={() => setRenameMode((prev) => !prev)}>
                {renameMode ? "Закрыть" : "Переименовать"}
              </button>
              <button
                type="button"
                className="cdetail-delete-collection"
                onClick={handleDeleteCollection}
                disabled={deletingCollection}
                aria-label="Удалить подборку"
              >
                <TrashIcon />
                <span>{deletingCollection ? "Удаляем..." : "Удалить подборку"}</span>
              </button>
            </div>
          }
        />

        {renameMode ? (
          <SectionCard className="cdetail-rename-panel" title="Переименовать подборку">
            <form className="cdetail-rename-form" onSubmit={handleRenameSubmit}>
              <input
                type="text"
                value={renameDraft}
                onChange={(event) => setRenameDraft(event.target.value)}
                placeholder="Название подборки"
                aria-label="Название подборки"
                disabled={renameBusy}
                maxLength={255}
              />
              <div className="cdetail-rename-actions">
                <button type="submit" className="cdetail-rename-save" disabled={renameBusy || !renameDraft.trim()}>
                  {renameBusy ? "Сохраняем..." : "Сохранить"}
                </button>
                <button type="button" className="cdetail-rename-cancel" onClick={handleRenameCancel} disabled={renameBusy}>
                  Отмена
                </button>
              </div>
            </form>
          </SectionCard>
        ) : null}

        {collection.movies.length > 1 ? (
          <section className="cdetail-order-panel" aria-live="polite">
            <p className="cdetail-order-copy">
              Меняйте порядок фильмов стрелками и сохраняйте, чтобы обновить превью подборки.
            </p>
            <div className="cdetail-order-actions">
              <button
                type="button"
                className="cdetail-order-save"
                onClick={() => void handleSaveOrder()}
                disabled={!orderDirty || orderBusy}
              >
                {orderBusy ? "Сохраняем порядок..." : "Сохранить порядок"}
              </button>
              <button
                type="button"
                className="cdetail-order-reset"
                onClick={() => void fetchCollection()}
                disabled={orderBusy || !orderDirty}
              >
                Сбросить
              </button>
            </div>
          </section>
        ) : null}

        <section className="cdetail-search-panel">
          <input
            className="cdetail-search-input"
            placeholder="Найти фильм для добавления в подборку..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Поиск фильма для добавления"
          />

          {searchBusy ? <p className="cdetail-hint">Ищем...</p> : null}
          {searchError ? <p className="cdetail-error">{searchError}</p> : null}
          {actionError ? <p className="cdetail-error">{actionError}</p> : null}

          {searchResults.length > 0 ? (
            <ul className="cdetail-dropdown">
              {searchResults.map((movie) => (
                <li key={movie.externalId || `${movie.title}-${movie.year || "na"}`} className="cdetail-result-item">
                  <div className="cdetail-result-meta">
                    {movie.posterUrl ? (
                      <img src={movie.posterUrl} alt={movie.title} loading="lazy" />
                    ) : (
                      <div className="cdetail-no-poster">Нет постера</div>
                    )}
                    <div>
                      <strong>{movie.title}</strong>
                      <span>{movie.year || "-"}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="cdetail-add-btn"
                    onClick={() => void handleAddMovie(movie)}
                    disabled={addingMovieId === (movie.externalId || movie.title)}
                  >
                    {addingMovieId === (movie.externalId || movie.title) ? "..." : "Добавить"}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        {collection.movies.length === 0 ? (
          <div className="cdetail-empty">
            <p>В этой подборке пока нет фильмов. Добавьте фильмы через поиск выше.</p>
          </div>
        ) : (
          <section className="cdetail-grid" aria-label="Фильмы в подборке">
            {collection.movies.map((movie, index) => (
              <article key={movie.movieId} className="cdetail-card">
                <div className="cdetail-card-poster-wrap">
                  {movie.posterUrl ? (
                    <img src={movie.posterUrl} alt={movie.title} className="cdetail-card-poster" loading="lazy" />
                  ) : (
                    <div className="cdetail-card-poster cdetail-card-no-poster">Нет постера</div>
                  )}

                  <div className="cdetail-order-controls" role="group" aria-label={`Изменить порядок: ${movie.title}`}>
                    <button
                      type="button"
                      className="cdetail-order-btn"
                      onClick={() => handleMoveMovie(movie.movieId, -1)}
                      disabled={index === 0 || orderBusy}
                      aria-label={`Поднять ${movie.title} выше`}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="cdetail-order-btn"
                      onClick={() => handleMoveMovie(movie.movieId, 1)}
                      disabled={index === collection.movies.length - 1 || orderBusy}
                      aria-label={`Опустить ${movie.title} ниже`}
                    >
                      ↓
                    </button>
                  </div>

                  <button
                    type="button"
                    className="cdetail-remove-btn"
                    onClick={() => void handleRemoveMovie(movie.movieId)}
                    disabled={removingMovieId === movie.movieId}
                    aria-label={`Удалить ${movie.title} из подборки`}
                    title="Удалить из подборки"
                  >
                    {removingMovieId === movie.movieId ? "..." : <TrashIcon />}
                  </button>
                </div>
                <div className="cdetail-card-body">
                  <strong className="cdetail-card-title">{movie.title}</strong>
                  <span className="cdetail-card-year">{movie.year || "-"}</span>
                  <Link
                    className="cdetail-card-link"
                    to={`/movie?movieId=${movie.movieId}${movie.externalId ? `&externalId=${movie.externalId}` : ""}`}
                    state={{ movie, fromPath: `/collections/${collection.id}`, fromLabel: collection.name }}
                  >
                    Подробнее
                  </Link>
                </div>
              </article>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
