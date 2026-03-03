import { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { pageView } from './analytics';
import AppLayout from './components/AppLayout';
import Dashboard from './pages/Dashboard';
import PlayerStatsPage from './pages/PlayerStatsPage';
import FixturesPage from './pages/FixturesPage';

function App() {
  const location = useLocation();

  useEffect(() => {
    pageView(location.pathname);
  }, [location.pathname]);

  return (
    <Routes>
      <Route path="/" element={<AppLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="player-stats" element={<PlayerStatsPage />} />
        <Route path="fixtures" element={<FixturesPage />} />
      </Route>
    </Routes>
  );
}

export default App;
