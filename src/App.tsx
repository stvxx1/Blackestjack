import { AU_CASINO, strategyChart } from '@/engine';

/** Placeholder shell until the table UI lands in Phase 4. */
export function App() {
  const chart = strategyChart(AU_CASINO);
  return (
    <main className="min-h-dvh bg-[radial-gradient(ellipse_at_top,var(--color-felt-600),var(--color-felt-900)_70%)] px-4 py-10">
      <h1 className="font-display text-4xl text-brass-300">BlackjackWiz</h1>
      <p className="mt-2 text-white/70">
        Engine online. Ruleset: {AU_CASINO.name}. Hard chart rows: {chart.hard.size}.
      </p>
    </main>
  );
}
