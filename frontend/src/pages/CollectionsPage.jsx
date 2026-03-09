import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createCollection, deleteCollection, getCollections } from "../api";
import TrashIcon from "../components/TrashIcon";
import PageHeader from "../components/ui/PageHeader";
import SectionCard from "../components/ui/SectionCard";
import StateBlock from "../components/ui/StateBlock";
import "./CollectionsPage.css";

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

export default function CollectionsPage() {
  const navigate = useNavigate();
  const [token] = useState(() => localStorage.getItem(TOKEN_KEY) || "");
  const [user] = useState(() => {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  });

  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const fetchCollections = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const data = await getCollections(token);
      setCollections(data.collections || []);
    } catch (error) {
      setCollections([]);
      setLoadError(error.message || "Не удалось загрузить подборки. Попробуйте снова.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      navigate("/tracker");
      return;
    }
    void fetchCollections();
  }, [token, navigate, fetchCollections]);

  async function handleCreateCollection(event) {
    event.preventDefault();
    const name = newName.trim();
    if (!name || !token) {
      return;
    }

    setCreating(true);
    setActionError("");
    try {
      await createCollection(name, token);
      setNewName("");
      await fetchCollections();
    } catch (error) {
      setActionError(error.message || "Не удалось создать подборку.");
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteCollection(collectionId) {
    if (!window.confirm("Удалить эту подборку?")) {
      return;
    }

    setDeletingId(collectionId);
    setActionError("");
    try {
      await deleteCollection(collectionId, token);
      setCollections((prev) => prev.filter((item) => item.id !== collectionId));
    } catch (error) {
      setActionError(error.message || "Не удалось удалить подборку.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="coll-page">
      <div className="coll-aura" />
      <main className="coll-container" id="main-content">
        <PageHeader
          className="coll-hero"
          kicker="Подборки"
          title={
            <>
              Личные подборки
              <span className="coll-dot">.</span>
            </>
          }
          subtitle={user ? `${user.username} - ${collections.length} подборок` : "Собирайте фильмы по настроению, эпохе или жанру."}
        />

        <SectionCard
          className="coll-create-panel"
          title="Создать подборку"
          description="Откройте подборку, чтобы добавлять, удалять и менять порядок фильмов."
        >
          <form className="coll-create-form" onSubmit={handleCreateCollection}>
            <input
              type="text"
              placeholder="Название подборки"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              aria-label="Название подборки"
              disabled={creating}
            />
            <button type="submit" disabled={creating || !newName.trim()}>
              {creating ? "Создаём..." : "Создать"}
            </button>
          </form>
          {actionError ? (
            <p className="coll-action-error" role="alert">
              {actionError}
            </p>
          ) : null}
        </SectionCard>

        {loading ? (
          <StateBlock variant="loading" title="Загрузка подборок..." />
        ) : loadError ? (
          <StateBlock variant="error" title="Не удалось загрузить подборки" message={loadError} actionLabel="Повторить" onAction={() => void fetchCollections()} />
        ) : collections.length === 0 ? (
          <StateBlock variant="empty" title="Подборок пока нет" message="Создайте первую подборку выше." />
        ) : (
          <section className="coll-grid" aria-label="Список подборок">
            {collections.map((collection) => (
              <article key={collection.id} className="coll-card">
                <button
                  type="button"
                  className="coll-delete-btn"
                  onClick={() => void handleDeleteCollection(collection.id)}
                  disabled={deletingId === collection.id}
                  aria-label={`Удалить подборку ${collection.name}`}
                  title="Удалить подборку"
                >
                  <TrashIcon />
                </button>

                <Link to={`/collections/${collection.id}`} className="coll-card-link">
                  <div className="coll-cover-wrap">
                    {collection.coverMovie?.posterUrl ? (
                      <img
                        src={collection.coverMovie.posterUrl}
                        alt={collection.coverMovie.title || collection.name}
                        className="coll-cover-img"
                        loading="lazy"
                      />
                    ) : (
                      <div className="coll-cover-empty">Нет обложки</div>
                    )}
                  </div>

                  <div className="coll-card-body">
                    <strong className="coll-card-title">{collection.name}</strong>
                    <span className="coll-card-meta">{formatMovieCount(collection.movieCount)}</span>
                  </div>

                  <span className="coll-open-cta">
                    Открыть подборку <span aria-hidden="true">→</span>
                  </span>
                </Link>
              </article>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
