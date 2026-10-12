import { strategyChart, UPCARDS, type CardValue, type RuleSet, type StrategyCode } from '@/engine';

type Table = 'hard' | 'soft' | 'pairs';

const STYLE: Record<StrategyCode, { bg: string; hatch?: boolean; name: string }> = {
  H: { bg: 'var(--color-act-hit)', name: 'Hit' },
  S: { bg: 'var(--color-act-stand)', name: 'Stand' },
  D: { bg: 'var(--color-act-double)', name: 'Double, otherwise hit' },
  Ds: { bg: 'var(--color-act-double)', name: 'Double, otherwise stand' },
  P: { bg: 'var(--color-act-split)', name: 'Split' },
  Ph: { bg: 'var(--color-act-split)', name: 'Split if double-after-split is allowed, otherwise hit' },
  Rh: { bg: 'var(--color-act-surrender)', hatch: true, name: 'Surrender, otherwise hit' },
  Rs: { bg: 'var(--color-act-surrender)', hatch: true, name: 'Surrender, otherwise stand' },
  Rp: { bg: 'var(--color-act-surrender)', hatch: true, name: 'Surrender, otherwise split' },
};

const upLabel = (v: CardValue): string => (v === 1 ? 'A' : v === 10 ? 'T' : String(v));

const rowsFor = (table: Table): readonly { key: number; label: string }[] => {
  if (table === 'hard') return [...Array.from({ length: 12 }, (_, i) => ({ key: i + 5, label: String(i + 5) })), { key: 17, label: '17+' }];
  if (table === 'soft') return Array.from({ length: 8 }, (_, i) => ({ key: i + 13, label: `A,${i + 2}` }));
  return [1, 10, 9, 8, 7, 6, 4, 3, 2].map((v) => ({ key: v, label: v === 1 ? 'A,A' : v === 10 ? 'T,T' : `${v},${v}` }));
};

interface StrategyChartProps {
  readonly rules: RuleSet;
  readonly table: Table;
  /** Cell to outline, e.g. the hand just drilled: `${table}:${row}:${upcard}`. */
  readonly highlight?: string | null;
}

/** One strategy table as an accessible grid: letters in every cell, colour as reinforcement. */
export function StrategyChart({ rules, table, highlight }: StrategyChartProps) {
  const chart = strategyChart(rules);
  const source = table === 'hard' ? chart.hard : table === 'soft' ? chart.soft : chart.pairs;
  const cellKey = (row: number, up: CardValue): string => `${table === 'pairs' ? 'pair' : table}:${row}:${up}`;
  const title = table === 'hard' ? 'Hard totals' : table === 'soft' ? 'Soft totals' : 'Pairs';

  return (
    <div className="overflow-x-auto">
      <table className="tabular w-full min-w-[20rem] table-fixed border-separate border-spacing-[2px] text-center text-xs sm:text-sm">
        <caption className="mb-2 text-left text-sm font-semibold text-ink-2">{title}</caption>
        <thead>
          <tr>
            <th scope="col" className="w-11 text-left text-ink-3">
              <span className="sr-only">Your hand</span>
            </th>
            {UPCARDS.map((up) => (
              <th key={up} scope="col" className="pb-1 font-semibold text-ink-2">
                <span className="sr-only">Dealer </span>
                {upLabel(up)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rowsFor(table).map(({ key, label }) => {
            const row = (source as ReadonlyMap<number, readonly StrategyCode[]>).get(key);
            if (!row) return null;
            return (
              <tr key={key}>
                <th scope="row" className="pr-2 text-left font-semibold whitespace-nowrap text-ink-2">
                  {label}
                </th>
                {UPCARDS.map((up, i) => {
                  const code = row[i] ?? 'H';
                  const style = STYLE[code];
                  const isHi = highlight === cellKey(key, up);
                  return (
                    <td
                      key={up}
                      title={`${label} vs ${upLabel(up)}: ${style.name}`}
                      className={`h-7 rounded-[4px] font-semibold text-white ${style.hatch ? 'hatch' : ''} ${
                        isHi ? 'outline-2 outline-offset-1 outline-brass-200' : ''
                      }`}
                      style={{ backgroundColor: style.bg }}
                    >
                      <span className="sr-only">{style.name}: </span>
                      {code}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Legend for the codes this rule set's chart actually uses. */
export function ChartLegend({ rules }: { rules: RuleSet }) {
  const chart = strategyChart(rules);
  const used = new Set([...chart.hard.values(), ...chart.soft.values(), ...chart.pairs.values()].flat());
  const codes = (Object.keys(STYLE) as StrategyCode[]).filter((c) => used.has(c));
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink-2" aria-label="Chart legend">
      {codes.map((code) => (
        <li key={code} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className={`inline-flex h-5 min-w-6 items-center justify-center rounded-[4px] px-1 font-semibold text-white ${STYLE[code].hatch ? 'hatch' : ''}`}
            style={{ backgroundColor: STYLE[code].bg }}
          >
            {code}
          </span>
          {STYLE[code].name}
        </li>
      ))}
    </ul>
  );
}
