import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
    addMovieToCollection,
    createCollection,
    deleteCollection,
    getCollection,
    getCollections,
    removeMovieFromCollection,
    searchMovies
} from "../api";
import "./CollectionsPage.css";

const TOKEN_KEY = "kinopulse_token";
const USER_KEY = "kinopulse_user";

export default function CollectionsPage() {
    const navigate = useNavigate();
    const [token] = useState(() => localStorage.getItem(TOKEN_KEY) || "");
    const [user] = useState(() => {
        const raw = localStorage.getItem(USER_KEY);
        return raw ? JSON.parse(raw) : null;
    });

    const [collections, setCollections] = useState([]);
    const [loadingList, setLoadingList] = useState(true);

    const [activeCollectionId, setActiveCollectionId] = useState(null);
    const [activeCollection, setActiveCollection] = useState(null);
    const [loadingActive, setLoadingActive] = useState(false);

    const [newCollName, setNewCollName] = useState("");
    const [creating, setCreating] = useState(false);

    // Search state for active collection
    const [search, setSearch] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [searchBusy, setSearchBusy] = useState(false);
    const [addingMovie, setAddingMovie] = useState(false);

    useEffect(() => {
        if (!token) {
            navigate("/tracker");
            return;
        }
        fetchCollections();
    }, [token, navigate]);

    useEffect(() => {
        if (activeCollectionId && token) {
            fetchActiveCollection(activeCollectionId);
        } else {
            setActiveCollection(null);
        }
    }, [activeCollectionId, token]);

    // Search effect
    useEffect(() => {
        if (!search.trim() || search.trim().length < 2 || !token) {
            setSearchResults([]);
            return;
        }

        let active = true;
        const timer = setTimeout(() => {
            setSearchBusy(true);
            searchMovies(search.trim())
                .then((data) => {
                    if (active) setSearchResults(data.results || []);
                })
                .catch(() => {
                    if (active) setSearchResults([]);
                })
                .finally(() => {
                    if (active) setSearchBusy(false);
                });
        }, 350);

        return () => {
            active = false;
            clearTimeout(timer);
        };
    }, [search, token]);

    async function fetchCollections() {
        setLoadingList(true);
        try {
            const data = await getCollections(token);
            setCollections(data.collections || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingList(false);
        }
    }

    async function fetchActiveCollection(id) {
        setLoadingActive(true);
        try {
            const data = await getCollection(id, token);
            setActiveCollection(data.collection);
        } catch (err) {
            console.error(err);
            setActiveCollectionId(null);
        } finally {
            setLoadingActive(false);
        }
    }

    async function handleCreateCollection(e) {
        e.preventDefault();
        if (!newCollName.trim() || !token) return;
        setCreating(true);
        try {
            const data = await createCollection(newCollName.trim(), token);
            await fetchCollections();
            setNewCollName("");
            setActiveCollectionId(data.collection.id);
        } catch (err) {
            console.error(err);
        } finally {
            setCreating(false);
        }
    }

    async function handleDeleteCollection(id) {
        if (!confirm("Удалить подборку?")) return;
        try {
            await deleteCollection(id, token);
            if (activeCollectionId === id) setActiveCollectionId(null);
            await fetchCollections();
        } catch (err) {
            console.error(err);
        }
    }

    async function handleAddMovie(movie) {
        if (!activeCollectionId || !token) return;
        setAddingMovie(true);
        try {
            await addMovieToCollection(activeCollectionId, movie, token);
            setSearch("");
            setSearchResults([]);
            await fetchActiveCollection(activeCollectionId);
            await fetchCollections(); // update counts/previews
        } catch (err) {
            console.error(err);
        } finally {
            setAddingMovie(false);
        }
    }

    async function handleRemoveMovie(movieId) {
        if (!activeCollectionId || !token) return;
        try {
            await removeMovieFromCollection(activeCollectionId, movieId, token);
            await fetchActiveCollection(activeCollectionId);
            await fetchCollections();
        } catch (err) {
            console.error(err);
        }
    }

    return (
        <div className="coll-page">
            <div className="coll-aura" />
            <main className="coll-container">
                <header className="coll-header">
                    <div className="coll-header-copy">
                        <p className="coll-kicker">{"Комнаты"}</p>
                        <h1>
                            {"Собственные подборки"}
                            <span className="coll-dot">.</span>
                        </h1>
                        {user && (
                            <p className="coll-sub">{`${user.username} — ${collections.length} подборок`}</p>
                        )}
                    </div>
                    <div className="coll-header-actions">
                        <Link to="/tracker" className="coll-link">{"Трекер"}</Link>
                        <Link to="/library" className="coll-link">{"Библиотека"}</Link>
                        <Link to="/" className="coll-link">{"На главную"}</Link>
                    </div>
                </header>

                <div className="coll-workspace">
                    {/* Sidebar */}
                    <aside className="coll-sidebar">
                        <form className="coll-create-form" onSubmit={handleCreateCollection}>
                            <input
                                type="text"
                                placeholder="Новая подборка..."
                                value={newCollName}
                                onChange={(e) => setNewCollName(e.target.value)}
                                disabled={creating}
                            />
                            <button type="submit" disabled={creating || !newCollName.trim()}>
                                {creating ? "..." : "+"}
                            </button>
                        </form>

                        {loadingList ? (
                            <p className="coll-hint">{"Загрузка..."}</p>
                        ) : collections.length === 0 ? (
                            <p className="coll-hint">{"У вас пока нет подборок. Создайте первую выше!"}</p>
                        ) : (
                            <ul className="coll-list">
                                {collections.map((c) => (
                                    <li key={c.id}>
                                        <button
                                            type="button"
                                            className={`coll-list-btn ${activeCollectionId === c.id ? "active" : ""}`}
                                            onClick={() => setActiveCollectionId(c.id)}
                                        >
                                            <div className="coll-list-info">
                                                <strong>{c.name}</strong>
                                                <span>{`${c.movieCount} фильмов`}</span>
                                            </div>
                                            <div className="coll-preview-grid">
                                                {[0, 1, 2, 3].map((i) => {
                                                    const m = c.previewMovies?.[i];
                                                    if (m?.posterUrl) {
                                                        return <img key={i} src={m.posterUrl} alt="" className="coll-preview-img" />;
                                                    }
                                                    return <div key={i} className="coll-preview-empty" />;
                                                })}
                                            </div>
                                        </button>
                                        <button
                                            type="button"
                                            className="coll-delete-btn"
                                            onClick={() => handleDeleteCollection(c.id)}
                                            title="Удалить подборку"
                                        >
                                            {"×"}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </aside>

                    {/* Main Area */}
                    <section className="coll-main">
                        {!activeCollectionId ? (
                            <div className="coll-main-empty">
                                <p>{"👈 Выберите подборку слева или создайте новую"}</p>
                            </div>
                        ) : loadingActive ? (
                            <p className="coll-hint">{"Загрузка подборки..."}</p>
                        ) : activeCollection ? (
                            <div className="coll-detail">
                                <header className="coll-detail-header">
                                    <h2>{activeCollection.name}</h2>
                                    <p>{`${activeCollection.movies.length} фильмов`}</p>
                                </header>

                                <div className="coll-search-box">
                                    <input
                                        className="coll-search-input"
                                        placeholder="Добавить фильм в эту подборку..."
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                    />
                                    {searchBusy ? <p className="coll-hint">{"Поиск..."}</p> : null}
                                    {searchResults.length > 0 ? (
                                        <ul className="coll-dropdown">
                                            {searchResults.map((movie) => (
                                                <li key={movie.externalId} className="coll-search-result-item">
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
                                                    <button
                                                        type="button"
                                                        className="coll-add-btn"
                                                        onClick={() => handleAddMovie(movie)}
                                                        disabled={addingMovie}
                                                    >
                                                        {"Добавить"}
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : null}
                                </div>

                                {activeCollection.movies.length === 0 ? (
                                    <p className="coll-hint">{"В этой подборке пусто. Найдите и добавьте фильмы выше!"}</p>
                                ) : (
                                    <div className="coll-movies-grid">
                                        {activeCollection.movies.map((movie) => (
                                            <div key={movie.movieId} className="coll-movie-card">
                                                <div className="coll-movie-poster-wrap">
                                                    {movie.posterUrl ? (
                                                        <img src={movie.posterUrl} alt={movie.title} className="coll-movie-poster" loading="lazy" />
                                                    ) : (
                                                        <div className="coll-movie-poster coll-movie-no-poster">{"Без постера"}</div>
                                                    )}
                                                    <button
                                                        type="button"
                                                        className="coll-movie-remove"
                                                        onClick={() => handleRemoveMovie(movie.movieId)}
                                                        title="Убрать из подборки"
                                                    >
                                                        {"×"}
                                                    </button>
                                                </div>
                                                <div className="coll-movie-body">
                                                    <strong>{movie.title}</strong>
                                                    <span>{movie.year || "—"}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : null}
                    </section>
                </div>
            </main>
        </div>
    );
}
