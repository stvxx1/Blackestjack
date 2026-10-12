import { MotionConfig } from 'framer-motion';
import { useEffect } from 'react';
import { AppShell } from '@/components/templates/AppShell';
import { BlackjackTable } from '@/components/organisms/BlackjackTable';
import { CountingDrills } from '@/components/organisms/CountingDrills';
import { SettingsPanel } from '@/components/organisms/SettingsPanel';
import { StatsPanel } from '@/components/organisms/StatsPanel';
import { StrategyTrainer } from '@/components/organisms/StrategyTrainer';
import { useHashRoute, type Route } from '@/hooks/useHashRoute';

const TITLES: Record<Route, string> = {
  table: 'Table',
  trainer: 'Strategy trainer',
  counting: 'Counting drills',
  stats: 'Stats',
  settings: 'Settings',
};

export function App() {
  const route = useHashRoute();
  useEffect(() => {
    document.title = `${TITLES[route]} · BlackjackWiz`;
  }, [route]);

  return (
    // Framer Motion follows the OS "reduce motion" setting for every animation in the app.
    <MotionConfig reducedMotion="user">
      <AppShell route={route}>
        {route === 'table' && <BlackjackTable />}
        {route === 'trainer' && <StrategyTrainer />}
        {route === 'counting' && <CountingDrills />}
        {route === 'stats' && <StatsPanel />}
        {route === 'settings' && <SettingsPanel />}
      </AppShell>
    </MotionConfig>
  );
}
