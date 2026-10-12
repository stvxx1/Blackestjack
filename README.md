# BlackjackWiz

Blackjack strategy trainer, card-counting drills and casino-grade table play.

```
npm install
npm run dev        # app
npm test           # engine test suite
npm run coverage   # with coverage thresholds
npm run lint && npm run typecheck
npm run build && npm run preview   # then, in another shell:
CHROMIUM_PATH=/path/to/chrome npm run e2e   # browser smoke test
```

## Layout

| Path | What lives there |
| --- | --- |
| `src/engine` | Pure TypeScript game logic. No React, DOM or state libraries (enforced by ESLint). |
| `src/state` | Zustand stores: live game + coaching, strategy trainer, counting trainer. Persisted. |
| `src/services` | Storage (localStorage with in-memory fallback), Web Audio sounds, haptics. |
| `src/components` | Atomic design: atoms → molecules → organisms → templates. |
| `src/hooks`, `src/lib` | Hotkeys, hash routing, staged dealer reveal; AUD formatting, chips, card text. |
| `e2e` | Playwright smoke test: every route at phone and desktop widths, keyboard-only play. |

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
  against the moves actually legal at that moment. 1–3 deck charts are computed by the EV solver,
  weighting each two-card hand by how often it's dealt.
- **EV solver** (`ev.ts`) — expected value of every move from the real shoe composition. Prices
  every mistake and audits the 4–8 deck tables cell by cell in the test suite. Doubles are exact;
  hitting holds the dealer distribution fixed after the first card and splits ignore resplits,
  which moves EVs by thousandths at most.
- **Counting** — Hi-Lo, KO, Omega II; running and true count. Illustrious 18 + Fab 4 index plays
  (Hi-Lo, multi-deck S17), with ENHC-unsafe doubles/splits vs 10/A removed for Australian games.
- **Drills** — weakness-weighted basic-strategy flash cards; running count, true count
  conversion, deck countdown and index-play drills.
- **Session stats** — win rate, observed return, decision accuracy, EV lost to mistakes, and a
  capped mistake log.

## State

Three persisted Zustand stores, each built by a factory (`createGameStore` etc.) so tests get
an isolated store with in-memory storage and a fixed seed. Persisted data is versioned and
validated field by field on load; anything malformed falls back to defaults. The whole game
state is plain data, so a round in progress survives a reload. The coach grades with pure basic
strategy, or with index plays at the live Hi-Lo true count when `useDeviations` is on — in which
case mistakes are priced against the shoe as the player has seen it.

## UI

Five hash routes — `#/table`, `#/trainer`, `#/counting`, `#/stats`, `#/settings` — in an app
shell with a top nav on desktop and a bottom tab bar on phones.

- **Table** — felt with the live rules printed in an arc, shoe and discard tray drawn to scale
  (with the cut card), chip rack, per-hand stakes and outcome ribbons. Cards deal from the shoe in
  real order; the engine settles a round instantly and the dealer's draws are replayed one by
  one, with the header bankroll holding the payout back until they land. Optional count HUD and
  move hints. Every action has a key (see Settings → Keyboard); everything is narrated through a
  polite live region.
- **Trainer** — weakness-weighted flash hands, instant grading with the EV of each option, and the
  live strategy chart for the chosen rules with the drilled cell outlined.
- **Counting** — running count flash (adjustable speed and length), true count conversion, deck
  countdown, and Hi-Lo index-play drills, each timed with best/average times.
- **Stats** — session results, decision accuracy, EV lost, drill accuracy and the mistake log.

Strategy chart colours: a validated three-hue set (stand / double / split) plus neutral for hit
and a hatched texture for surrender; every cell also carries its letter code, so colour never
carries meaning alone. Animations respect `prefers-reduced-motion`.
