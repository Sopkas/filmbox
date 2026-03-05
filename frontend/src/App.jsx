import { Navigate, Route, Routes } from "react-router-dom";
import HeroPage from "./pages/HeroPage";
import LibraryPage from "./pages/LibraryPage";
import TrackerPage from "./pages/TrackerPage";
import CollectionsPage from "./pages/CollectionsPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HeroPage />} />
      <Route path="/tracker" element={<TrackerPage />} />
      <Route path="/library" element={<LibraryPage />} />
      <Route path="/collections" element={<CollectionsPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

