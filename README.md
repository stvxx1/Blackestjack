# BlackjackWiz

Blackjack strategy trainer, card-counting drills and casino-grade table play.

```
npm install
npm run dev        # app
npm test           # engine test suite
npm run coverage   # with coverage thresholds
npm run lint && npm run typecheck
```

## Layout

| Path | What lives there |
| --- | --- |
| `src/engine` | Pure TypeScript game logic. No React, DOM or state libraries (enforced by ESLint). |
| `src/state` | Zustand stores, persistence (Phase 3). |
| `src/services` | Storage, audio, analytics adapters (Phase 3–4). |
| `src/components` | Atomic design: atoms → molecules → organisms → templates (Phase 4). |

## Engine at a glance

- **State machine** — `applyAction(state, action) => state`. Every transition is pure; the
  PRNG state lives inside `GameState`, so a seed replays a whole session exactly.
- **Money** is integer cents throughout (AUD by default).
- **Shoe** — xoshiro128\*\* seeded from Web Crypto, unbiased Fisher–Yates, cut card placed
  randomly inside the rule set's penetration window, burn cards, and an emergency reshuffle of
  discards if a round outlasts the shoe.
- **Rules** — deck count, H17/S17, peek vs no-hole-card (all bets or original bets only),
  double restrictions, DAS, late/early surrender, up to 4 hands, resplit/hit split aces,
  insurance and even money, 3:2 or 6:5. Presets: `AU_CASINO` (default), `VEGAS_STRIP`,
  `ATLANTIC_CITY`, `VEGAS_DOWNTOWN_H17`.
- **Basic strategy** — 4–8 deck charts adjusted per rule set (H17, DAS, LS/ES, ENHC), resolved
  against the moves actually legal at that moment. 1–2 deck games are flagged approximate via
  `chartIsExactFor` until the combinatorial solver lands.
- **Counting** — Hi-Lo, KO, Omega II; running and true count.
