import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { useEffect, useMemo, useRef } from 'react';
import {
  insuranceCost,
  isNatural,
  legalMoves,
  recommendPlay,
  type GameState,
  type PlayerMove,
} from '@/engine';
import { Button } from '@/components/atoms/Button';
import { BetSpot } from '@/components/molecules/BetSpot';
import { ChipRack } from '@/components/molecules/ChipRack';
import { CoachToast } from '@/components/molecules/CoachToast';
import { CountHud } from '@/components/molecules/CountHud';
import { FeltArc } from '@/components/molecules/FeltArc';
import { Hand } from '@/components/molecules/Hand';
import { ShoeAndTray } from '@/components/molecules/ShoeAndTray';
import { useHotkeys } from '@/hooks/useHotkeys';
import { useStagedReveal } from '@/hooks/useStagedReveal';
import { CHIPS } from '@/lib/chips';
import { describeTotal, upcardPhrase } from '@/lib/cards';
import { money, signedMoney } from '@/lib/format';
import { countInfo, countingSystem } from '@/state/count';
import { gameStore, useCountInfo, useGameStore } from '@/state/gameStore';
import { tableViewStore } from '@/state/tableViewStore';
import { uiStore, useUi } from '@/state/uiStore';
import { buzz, playSound, type SoundName } from '@/services/sound';

const MOVES: readonly { move: PlayerMove; label: string; key: string }[] = [
  { move: 'hit', label: 'Hit', key: 'H' },
  { move: 'stand', label: 'Stand', key: 'S' },
  { move: 'double', label: 'Double', key: 'D' },
  { move: 'split', label: 'Split', key: 'P' },
  { move: 'surrender', label: 'Surrender', key: 'R' },
];

/** Time between dealer cards once the round is over, so the dealer "plays" visibly. */
const DEALER_STEP_MS = 650;

export function BlackjackTable() {
  const game = useGameStore((s) => s.game);
  const bet = useGameStore((s) => s.bet);
  const feedback = useGameStore((s) => s.feedback);
  const error = useGameStore((s) => s.error);
  const settings = useGameStore((s) => s.settings);
  const { showCount, showHints, dealSpeed } = useUi((s) => s);
  const count = useCountInfo();

  const { phase, rules, round } = game;
  const roundOver = phase === 'roundOver';
  const betting = phase === 'betting' || roundOver;

  // Replay the dealer's hand card by card once the engine has settled the round.
  const shownDealer = useStagedReveal(game.dealer.length, roundOver, DEALER_STEP_MS, round);
  const revealing = roundOver && shownDealer < game.dealer.length;
  const settled = roundOver && !revealing;
  const holeHidden = rules.holeCard === 'peek' && !roundOver;
  const dealerCards = game.dealer.slice(0, shownDealer);
  const dealerVisible = holeHidden ? dealerCards.slice(0, 1) : dealerCards;

  useEffect(() => {
    tableViewStore.getState().setRevealing(revealing);
  }, [revealing]);
  useEffect(
    () => () => {
      tableViewStore.getState().setRevealing(false);
    },
    [],
  );

  useTableSounds(game, shownDealer, settled);

  const hint = useMemo(() => {
    const hand = game.hands[game.activeHand];
    const up = game.dealer[0];
    if (phase !== 'playerTurn' || !hand || !up) return null;
    const tc = settings.useDeviations && settings.countingSystem === 'hi-lo' ? countInfo(game, countingSystem('hi-lo')).trueCount : null;
    return recommendPlay({
      cards: hand.cards,
      dealerUpcard: up,
      rules,
      available: legalMoves(game),
      ...(tc === null ? {} : { trueCount: tc }),
    }).move;
  }, [game, phase, rules, settings.useDeviations, settings.countingSystem]);

  const legal = legalMoves(game);
  const { setBet, deal, act, insurance } = gameStore.getState();
  const addChip = (cents: number): void => {
    if (!betting) return;
    setBet(bet + cents);
    if (uiStore.getState().sound) playSound('chip');
  };

  useHotkeys({
    ...(betting
      ? Object.fromEntries(CHIPS.map((c, i) => [String(i + 1), () => { addChip(c.value); }]))
      : {}),
    c: () => {
      if (betting) setBet(0);
    },
    x: () => {
      if (betting) setBet(bet * 2);
    },
    Enter: () => {
      if (betting) deal();
    },
    ' ': () => {
      if (betting) deal();
    },
    h: () => { if (legal.includes('hit')) act('hit'); },
    s: () => { if (legal.includes('stand')) act('stand'); },
    d: () => { if (legal.includes('double')) act('double'); },
    p: () => { if (legal.includes('split')) act('split'); },
    r: () => { if (legal.includes('surrender')) act('surrender'); },
    y: () => { if (phase === 'insurance') insurance(true); },
    n: () => { if (phase === 'insurance') insurance(false); },
    k: () => { uiStore.getState().set('showCount', !uiStore.getState().showCount); },
    '?': () => { uiStore.getState().set('showHints', !uiStore.getState().showHints); },
  });

  // Initial deal order: player, dealer, player, dealer.
  const step = dealSpeed / 1000;
  const playerDelay = (handIndex: number) => (i: number) =>
    game.hands[handIndex]?.fromSplit ? 0 : i === 0 ? 0 : i === 1 ? 2 * step : 0;
  const dealerDelay = (i: number) => (i === 0 ? step : i === 1 ? 3 * step : 0);

  const playerBJ = game.hands.length === 1 && isNatural(game.hands[0]?.cards ?? []);
  const multi = game.hands.length > 1;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Announcer game={game} settled={settled} shownDealer={shownDealer} error={error} />

      {/* Felt */}
      <div className="felt relative mx-auto flex w-full max-w-5xl flex-1 flex-col items-center overflow-hidden rounded-b-[45%_18%] px-3 pt-4 pb-6 shadow-[inset_0_0_0_10px_rgb(0_0_0/0.25),inset_0_0_80px_rgb(0_0_0/0.5)] sm:rounded-b-[50%_28%] sm:px-6">
        <div className="absolute top-3 left-3 sm:left-6">
          <ShoeAndTray shoe={game.shoe} side="tray" />
        </div>
        <div className="absolute top-3 right-3 sm:right-6">
          <ShoeAndTray shoe={game.shoe} side="shoe" />
        </div>
        <div className="flex min-h-6 w-full justify-center">
          <div className="flex flex-col items-center gap-2">
            {showCount && <CountHud count={count} system={countingSystem(settings.countingSystem).name} />}
            <AnimatePresence>
              {game.reshuffled && phase !== 'roundOver' && (
                <motion.span
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="rounded-full bg-brass-400/20 px-3 py-1 text-xs font-semibold tracking-wide text-brass-200 uppercase ring-1 ring-brass-400/40"
                >
                  New shoe · count reset
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Dealer */}
        <div className="flex min-h-[calc(var(--card-h)+2.5rem)] flex-col items-center">
          {game.dealer.length > 0 ? (
            <Hand
              label="Dealer"
              cards={dealerCards}
              total={describeTotal(dealerVisible)}
              {...(holeHidden ? { faceDownIndex: 1 } : {})}
              dealDelay={dealerDelay}
            />
          ) : (
            <div className="flex h-(--card-h) items-center text-sm text-ink-3">Dealer</div>
          )}
        </div>

        <FeltArc rules={rules} />

        <div className="my-1 w-full">
          <CoachToast feedback={settings.coach ? feedback : null} />
        </div>

        {/* Player */}
        <LayoutGroup>
          <div className="flex w-full flex-wrap items-start justify-center gap-x-2 gap-y-3 sm:gap-x-6">
            {game.hands.map((hand, i) => (
              <Hand
                key={i}
                label={multi ? `Hand ${i + 1}` : 'Your hand'}
                cards={hand.cards}
                total={describeTotal(hand.cards, { natural: !hand.fromSplit })}
                active={phase === 'playerTurn' && i === game.activeHand}
                dealDelay={playerDelay(i)}
                result={settled ? (game.result?.hands[i] ?? null) : null}
                compact={multi}
                footer={
                  <span className="tabular text-xs text-ink-3">
                    {money(hand.bet)}
                    {hand.doubled ? ' · doubled' : ''}
                  </span>
                }
              />
            ))}
          </div>
        </LayoutGroup>

        {/* During play each hand shows its own stake; the betting circle is for the next bet. */}
        {betting && (
          <div className="mt-auto pt-4">
            <BetSpot amount={bet} label="Place your bet" />
          </div>
        )}
      </div>

      {/* Dock */}
      {/* Sits above the phone tab bar; on desktop it sticks to the bottom edge. */}
      <div className="sticky bottom-[calc(3.6rem+env(safe-area-inset-bottom))] z-10 mx-auto w-full max-w-5xl px-3 pt-3 pb-3 sm:px-6 md:bottom-0 md:pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="flex min-h-16 flex-wrap items-center justify-center gap-2 rounded-2xl bg-felt-900/90 p-2.5 shadow-2xl ring-1 ring-white/10 backdrop-blur sm:gap-3">
          {error && (
            <p role="alert" className="w-full text-center text-sm text-[#ffb3ad]">
              {error}
            </p>
          )}

          {betting && (
            <>
              <ChipRack available={Math.max(0, Math.min(game.bankroll, rules.maxBet) - bet)} onAdd={addChip} />
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" shortcut="C" onClick={() => { setBet(0); }} disabled={bet === 0}>
                  Clear
                </Button>
                <Button size="sm" variant="ghost" shortcut="X" onClick={() => { setBet(bet * 2); }} disabled={bet === 0}>
                  ×2
                </Button>
                <Button variant="primary" size="lg" shortcut="↵" onClick={deal} disabled={bet === 0}>
                  {roundOver ? 'Deal again' : 'Deal'}
                </Button>
              </div>
            </>
          )}

          {phase === 'insurance' && (
            <div className="flex flex-wrap items-center justify-center gap-3">
              <span className="text-sm text-ink-2">
                Dealer shows an ace. {playerBJ ? 'Even money?' : `Insurance costs ${money(insuranceCost(game))}.`}
              </span>
              <Button variant="primary" shortcut="Y" onClick={() => { insurance(true); }}>
                {playerBJ ? 'Even money' : 'Insure'}
              </Button>
              <Button shortcut="N" onClick={() => { insurance(false); }}>
                No thanks
              </Button>
            </div>
          )}

          {phase === 'playerTurn' && (
            <div role="group" aria-label="Your move" className="grid w-full grid-cols-3 gap-2 sm:flex sm:w-auto">
              {MOVES.filter((m) => m.move !== 'surrender' || rules.surrender !== 'none').map((m) => (
                <Button
                  key={m.move}
                  shortcut={m.key}
                  disabled={!legal.includes(m.move)}
                  highlight={showHints && hint === m.move}
                  onClick={() => { act(m.move); }}
                  className="min-w-0 px-2 sm:min-w-24 sm:px-4"
                >
                  {m.label}
                </Button>
              ))}
            </div>
          )}
        </div>
        {settled && game.result && (
          <p className="tabular mt-2 text-center text-sm text-ink-2">
            Round {round}: <span className={game.result.net > 0 ? 'text-good' : game.result.net < 0 ? 'text-bad' : ''}>{signedMoney(game.result.net)}</span>
          </p>
        )}
      </div>
    </div>
  );
}

/** Screen-reader narration of the table, one polite announcement per change. */
function Announcer({ game, settled, shownDealer, error }: { game: GameState; settled: boolean; shownDealer: number; error: string | null }) {
  const up = game.dealer[0];
  let message = '';
  if (error) message = error;
  else if (game.phase === 'insurance') message = 'Dealer shows an ace. Insurance? Press Y or N.';
  else if (game.phase === 'playerTurn' && up) {
    const hand = game.hands[game.activeHand];
    const which = game.hands.length > 1 ? `Hand ${game.activeHand + 1}: ` : 'You have ';
    message = `${which}${describeTotal(hand?.cards ?? [], { natural: !hand?.fromSplit })}. Dealer shows ${upcardPhrase(up)}.`;
  } else if (settled && game.result) {
    const outcomes = game.result.hands.map((h) => h.outcome).join(', ');
    message = `Dealer ${describeTotal(game.dealer.slice(0, shownDealer))}. ${outcomes}. Net ${signedMoney(game.result.net)}.`;
  }
  return (
    <p className="sr-only" aria-live="polite" aria-atomic>
      {message}
    </p>
  );
}

/** Card, flip, shuffle and result sounds driven by state changes. */
function useTableSounds(game: GameState, shownDealer: number, settled: boolean): void {
  const sound = useUi((s) => s.sound);
  const cardCount = game.hands.reduce((n, h) => n + h.cards.length, 0) + shownDealer;
  const prev = useRef({ cardCount, round: game.round, settled, phase: game.phase, error: false });
  const error = useGameStore((s) => s.error !== null);

  useEffect(() => {
    const p = prev.current;
    prev.current = { cardCount, round: game.round, settled, phase: game.phase, error };
    if (!sound) return;
    const play = (name: SoundName): void => {
      playSound(name);
    };
    if (error && !p.error) play('error');
    if (game.round !== p.round && game.reshuffled) play('shuffle');
    if (cardCount > p.cardCount) play('card');
    if (game.phase === 'roundOver' && p.phase !== 'roundOver' && game.rules.holeCard === 'peek') play('flip');
    if (settled && !p.settled && game.result) {
      const { net, hands } = game.result;
      if (hands.some((h) => h.outcome === 'blackjack')) {
        play('blackjack');
        buzz([30, 40, 30]);
      } else play(net > 0 ? 'win' : net < 0 ? 'lose' : 'push');
    }
  }, [cardCount, game, settled, sound, error]);
}
