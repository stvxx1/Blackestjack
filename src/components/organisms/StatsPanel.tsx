import { accuracy, decisionAccuracy, observedReturn, winRate } from '@/engine';
import { Button } from '@/components/atoms/Button';
import { StatTile } from '@/components/atoms/StatTile';
import { money, percent, signed, signedMoney } from '@/lib/format';
import { gameStore, useGameStore } from '@/state/gameStore';
import { useCountingStore } from '@/state/countingStore';
import { useTrainerStore } from '@/state/trainerStore';

const tone = (n: number): 'good' | 'bad' | 'neutral' => (n > 0 ? 'good' : n < 0 ? 'bad' : 'neutral');
const LABEL = { hit: 'Hit', stand: 'Stand', double: 'Double', split: 'Split', surrender: 'Surrender', insure: 'Insure', decline: 'Decline' } as const;

export function StatsPanel() {
  const stats = useGameStore((s) => s.stats);
  const mistakes = useGameStore((s) => s.mistakes);
  const bankroll = useGameStore((s) => s.game.bankroll);
  const drill = useTrainerStore((s) => s.stats);
  const counting = useCountingStore((s) => s.stats);

  const countingAttempts = Object.values(counting).reduce((n, k) => n + k.attempts, 0);
  const countingCorrect = Object.values(counting).reduce((n, k) => n + k.correct, 0);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-2xl text-brass-200">Session</h1>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            gameStore.getState().resetBankroll();
          }}
        >
          New session (reset bankroll)
        </Button>
      </div>

      <section aria-label="Table results" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2">
          <StatTile hero label="Net result" value={signedMoney(stats.net)} tone={tone(stats.net)} detail={`Bankroll ${money(bankroll)} · ${stats.rounds} ${stats.rounds === 1 ? 'round' : 'rounds'}`} />
        </div>
        <StatTile label="Win rate" value={stats.wins + stats.losses ? percent(winRate(stats), 1) : '—'} detail={`${stats.wins}W · ${stats.losses}L · ${stats.pushes}P`} />
        <StatTile label="Observed return" value={stats.wagered ? `${signed(observedReturn(stats) * 100, 2)}%` : '—'} detail={`of ${money(stats.wagered)} wagered`} />
        <StatTile label="Decision accuracy" value={stats.decisions ? percent(decisionAccuracy(stats), 1) : '—'} detail={`${stats.mistakes} mistakes in ${stats.decisions}`} />
        <StatTile label="EV lost to mistakes" value={money(stats.evLost)} tone={stats.evLost > 0 ? 'bad' : 'neutral'} detail="expected, not actual" />
        <StatTile label="Blackjacks" value={stats.blackjacks} detail={`${stats.busts} busts · ${stats.surrenders} surrenders`} />
        <StatTile label="Best / worst round" value={signedMoney(stats.biggestWin)} detail={`worst ${signedMoney(stats.biggestLoss)}`} />
      </section>

      <section aria-label="Training" className="grid gap-3 sm:grid-cols-3">
        <StatTile label="Strategy drill accuracy" value={drill.attempts ? percent(accuracy(drill), 1) : '—'} detail={`${drill.attempts} hands · best streak ${drill.bestStreak}`} />
        <StatTile label="Counting drill accuracy" value={countingAttempts ? percent(countingCorrect / countingAttempts, 1) : '—'} detail={`${countingAttempts} drills`} />
        <StatTile
          label="Fastest countdown"
          value={counting.countdown.bestMs === null ? '—' : `${(counting.countdown.bestMs / 1000).toFixed(1)}s`}
          detail="51 cards, correct answers only"
        />
      </section>

      <section aria-labelledby="mistakes-title" className="flex flex-col gap-3">
        <h2 id="mistakes-title" className="text-lg font-semibold">
          Mistake log <span className="text-sm font-normal text-ink-3">· last {Math.min(mistakes.length, 50)} of {mistakes.length}</span>
        </h2>
        {mistakes.length === 0 ? (
          <p className="rounded-2xl bg-white/[0.03] p-6 text-center text-ink-3 ring-1 ring-white/8">
            No mistakes logged. Turn on the coach in Settings and play a few hands.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl ring-1 ring-white/8">
            <table className="tabular w-full text-left text-sm">
              <thead className="bg-white/[0.04] text-ink-3">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">Round</th>
                  <th scope="col" className="px-3 py-2 font-medium">Hand</th>
                  <th scope="col" className="px-3 py-2 font-medium">Dealer</th>
                  <th scope="col" className="px-3 py-2 font-medium">You</th>
                  <th scope="col" className="px-3 py-2 font-medium">Correct</th>
                  <th scope="col" className="px-3 py-2 font-medium">Index</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">EV lost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {mistakes.slice(0, 50).map((m) => (
                  <tr key={`${m.at}-${m.round}-${m.chose}`}>
                    <td className="px-3 py-2 text-ink-3">{m.round}</td>
                    <td className="px-3 py-2">{m.hand.join(' ')}</td>
                    <td className="px-3 py-2">{m.upcard}</td>
                    <td className="px-3 py-2 text-bad">{LABEL[m.chose]}</td>
                    <td className="px-3 py-2 text-good">{LABEL[m.correct]}</td>
                    <td className="px-3 py-2 text-ink-3">{m.deviation ? `${m.deviation} @ ${signed(m.trueCount ?? 0)}` : '—'}</td>
                    <td className="px-3 py-2 text-right">{money(m.evLost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
