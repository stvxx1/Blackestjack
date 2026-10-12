import type { CountInfo } from '@/state/count';
import { signed } from '@/lib/format';

export function CountHud({ count, system }: { count: CountInfo; system: string }) {
  return (
    <dl
      aria-label={`${system} count`}
      className="tabular grid grid-cols-3 gap-x-3 rounded-xl bg-black/40 px-3 py-1.5 text-center ring-1 ring-white/10 backdrop-blur"
    >
      <div>
        <dt className="text-[0.65rem] tracking-wide text-ink-3 uppercase">Running</dt>
        <dd className="text-lg font-semibold">{signed(count.running)}</dd>
      </div>
      <div>
        <dt className="text-[0.65rem] tracking-wide text-ink-3 uppercase">True</dt>
        <dd className="text-lg font-semibold">{count.trueCount === null ? '—' : signed(count.trueCount)}</dd>
      </div>
      <div>
        <dt className="text-[0.65rem] tracking-wide text-ink-3 uppercase">Decks</dt>
        <dd className="text-lg font-semibold">{count.decksRemaining.toFixed(1)}</dd>
      </div>
    </dl>
  );
}
