import { useEffect, useRef } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { pageView } from './analytics';
import AppLayout from './components/AppLayout';
import Dashboard from './pages/Dashboard';
import PlayerStatsPage from './pages/PlayerStatsPage';
import PlayerNewsPage from './pages/PlayerNewsPage';
import FixturesPage from './pages/FixturesPage';
import SquadPlannerPage from './pages/SquadPlannerPage';
import NotFoundPage from './pages/NotFoundPage';
import ClubsPage from './pages/ClubsPage';
import ClubPage from './pages/ClubPage';
import OpinionsPage from './pages/OpinionsPage';

function App() {
  const location = useLocation();
  const hasHandledInitialPageView = useRef(false);

  useEffect(() => {
    if (!hasHandledInitialPageView.current) {
      hasHandledInitialPageView.current = true;
      return;
    }
    pageView(location.pathname);
  }, [location.pathname]);

  return (
    <Routes>
      <Route path="/" element={<AppLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="player-stats" element={<PlayerStatsPage />} />
        <Route path="player-news" element={<PlayerNewsPage />} />
        <Route path="fixtures" element={<FixturesPage />} />
        <Route path="clubs" element={<ClubsPage />} />
        <Route path="clubs/:slug" element={<ClubPage />} />
        <Route path="squad-planner" element={<SquadPlannerPage />} />
        <Route path="opinions" element={<OpinionsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default App;
