import type { ReactNode } from 'react';

interface StatTileProps {
  readonly label: string;
  readonly value: ReactNode;
  /** Optional context line under the value. */
  readonly detail?: ReactNode;
  /** Direction of the value and whether that direction is good, for colouring + icon. */
  readonly tone?: 'good' | 'bad' | 'neutral';
  readonly hero?: boolean;
}

const ICON = { good: '▲', bad: '▼', neutral: '' } as const;

/** Label, value, optional detail. Tone is never colour-alone: it also carries an arrow. */
export function StatTile({ label, value, detail, tone = 'neutral', hero = false }: StatTileProps) {
  const toneClass = tone === 'good' ? 'text-good' : tone === 'bad' ? 'text-bad' : 'text-ink';
  return (
    <div className="rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/8">
      <div className="text-sm text-ink-3">{label}</div>
      <div className={`mt-1 flex items-baseline gap-1.5 font-semibold ${hero ? 'text-5xl' : 'text-2xl'} ${toneClass}`}>
        {tone !== 'neutral' && (
          <span aria-hidden className={hero ? 'text-2xl' : 'text-sm'}>
            {ICON[tone]}
          </span>
        )}
        {value}
      </div>
      {detail && <div className="mt-1 text-xs text-ink-3">{detail}</div>}
    </div>
  );
}
