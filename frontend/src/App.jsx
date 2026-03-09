import { Navigate, Route, Routes } from "react-router-dom";
import HeroPage from "./pages/HeroPage";
import LibraryPage from "./pages/LibraryPage";
import TrackerPage from "./pages/TrackerPage";
import CollectionsPage from "./pages/CollectionsPage";
import CollectionDetailPage from "./pages/CollectionDetailPage";
import MovieDetailPage from "./pages/MovieDetailPage";
import AiRecommendPage from "./pages/AiRecommendPage";
import SiteHeader from "./components/SiteHeader";

export default function App() {
  return (
    <>
      <SiteHeader />
      <Routes>
        <Route path="/" element={<HeroPage />} />
        <Route path="/tracker" element={<TrackerPage />} />
        <Route path="/library" element={<LibraryPage />} />
        <Route path="/collections" element={<CollectionsPage />} />
        <Route path="/collections/:id" element={<CollectionDetailPage />} />
        <Route path="/movie" element={<MovieDetailPage />} />
        <Route path="/recommendations" element={<AiRecommendPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
