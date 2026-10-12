import type { RuleSet } from '@/engine';

/** The printed rules arcing across the felt, generated from the live rule set. */
export function FeltArc({ rules }: { rules: RuleSet }) {
  const [n, d] = rules.blackjackPays;
  const lines = [
    `BLACKJACK PAYS ${n} TO ${d}`,
    rules.dealerHitsSoft17 ? 'DEALER HITS SOFT 17' : 'DEALER STANDS ON ALL 17s',
    rules.insurance ? 'INSURANCE PAYS 2 TO 1' : 'NO INSURANCE',
  ];
  return (
    <svg viewBox="0 0 600 112" className="pointer-events-none -my-2 w-full max-w-xl select-none" aria-hidden>
      <defs>
        {/* The lower arc is the longer one, so the long rules line sits underneath. */}
        <path id="arc-outer" d="M 80 18 Q 300 96 520 18" />
        <path id="arc-inner" d="M 30 46 Q 300 140 570 46" />
      </defs>
      <text className="fill-brass-300/80 font-display" fontSize="23" letterSpacing="3" textAnchor="middle">
        <textPath href="#arc-outer" startOffset="50%">
          {lines[0]}
        </textPath>
      </text>
      <text className="fill-white/45" fontSize="12" letterSpacing="1.6" textAnchor="middle" fontWeight="600">
        <textPath href="#arc-inner" startOffset="50%">
          {`${lines[1]}  ·  ${lines[2]}`}
        </textPath>
      </text>
    </svg>
  );
}
