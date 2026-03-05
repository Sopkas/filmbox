import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getProfileReviews } from "../api";
import "./LibraryPage.css";

const TOKEN_KEY = "kinopulse_token";
const USER_KEY = "kinopulse_user";

function Stars({ value }) {
    const num = Number(value) || 0;
    const stars = [];
    for (let i = 1; i <= 5; i++) {
        if (num >= i) {
            stars.push(<span key={i} className="lib-star-icon lib-star-full">{"\u2605"}</span>);
        } else if (num >= i - 0.5) {
            stars.push(
                <span key={i} className="lib-star-icon lib-star-half">
                    <span className="lib-star-bg">{"\u2606"}</span>
                    <span className="lib-star-fg">{"\u2605"}</span>
                </span>
            );
        } else {
            stars.push(<span key={i} className="lib-star-icon lib-star-empty">{"\u2606"}</span>);
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
    const [filterText, setFilterText] = useState("");

    useEffect(() => {
        if (!token) {
            navigate("/tracker");
            return;
        }
        setLoading(true);
        getProfileReviews({ sortBy: "createdAt", order: "desc", limit: 100 }, token)
            .then((data) => setMovies(data.items || []))
            .catch(() => setMovies([]))
            .finally(() => setLoading(false));
    }, [token, navigate]);

    const filtered = filterText.trim()
        ? movies.filter((m) => m.title.toLowerCase().includes(filterText.toLowerCase()))
        : movies;

    return (
        <div className="lib-page">
            <div className="lib-aura" />
            <main className="lib-container">
                <header className="lib-header">
                    <div className="lib-header-copy">
                        <p className="lib-kicker">{"Библиотека"}</p>
                        <h1>
                            {"Просмотренные фильмы"}
                            <span className="lib-dot">.</span>
                        </h1>
                        {user ? (
                            <p className="lib-sub">{`${user.username} — ${movies.length} фильмов в коллекции`}</p>
                        ) : null}
                    </div>
                    <div className="lib-header-actions">
                        <Link to="/collections" className="lib-link">{"Подборки"}</Link>
                        <Link to="/tracker" className="lib-link">{"Трекер"}</Link>
                        <Link to="/" className="lib-link">{"На главную"}</Link>
                    </div>
                </header>

                <div className="lib-filter-bar">
                    <input
                        className="lib-filter-input"
                        placeholder="Фильтр по названию..."
                        value={filterText}
                        onChange={(e) => setFilterText(e.target.value)}
                    />
                    <span className="lib-filter-count">{`${filtered.length} из ${movies.length}`}</span>
                </div>

                {loading ? (
                    <p className="lib-hint">{"Загрузка..."}</p>
                ) : filtered.length === 0 ? (
                    <p className="lib-hint">{"Нет фильмов для отображения."}</p>
                ) : (
                    <div className="lib-grid">
                        {filtered.map((movie) => (
                            <div key={movie.id} className="lib-card">
                                <div className="lib-card-poster-wrap">
                                    {movie.posterUrl ? (
                                        <img src={movie.posterUrl} alt={movie.title} className="lib-card-poster" loading="lazy" />
                                    ) : (
                                        <div className="lib-card-poster lib-card-no-poster">{"Без постера"}</div>
                                    )}
                                    <div className="lib-card-overlay">
                                        {movie.comment ? (
                                            <p className="lib-card-comment">{movie.comment}</p>
                                        ) : (
                                            <p className="lib-card-comment lib-card-comment-empty">{"Без комментария"}</p>
                                        )}
                                    </div>
                                </div>
                                <div className="lib-card-body">
                                    <strong className="lib-card-title">{movie.title}</strong>
                                    <div className="lib-card-meta">
                                        <span className="lib-card-year">{movie.year || "—"}</span>
                                        <Stars value={movie.rating} />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
