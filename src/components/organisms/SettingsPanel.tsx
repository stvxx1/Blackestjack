import { useState } from 'react';
import { COUNTING_SYSTEMS, RULE_PRESETS, type PresetId, type RuleSet } from '@/engine';
import { Button } from '@/components/atoms/Button';
import { Segmented } from '@/components/atoms/Segmented';
import { Toggle } from '@/components/atoms/Toggle';
import { money } from '@/lib/format';
import type { CountingSystemId } from '@/state/count';
import { gameStore, useGameStore } from '@/state/gameStore';
import { uiStore, useUi } from '@/state/uiStore';

function rulesSummary(r: RuleSet): string[] {
  const hole = { peek: 'Dealer peeks for blackjack', enhc: 'No hole card: dealer blackjack takes doubles and splits', 'enhc-obo': 'No hole card, original bets only' }[r.holeCard];
  return [
    `${r.decks} deck${r.decks > 1 ? 's' : ''}, ${Math.round(r.penetration[0] * 100)}–${Math.round(r.penetration[1] * 100)}% penetration`,
    r.dealerHitsSoft17 ? 'Dealer hits soft 17' : 'Dealer stands on soft 17',
    hole,
    `Blackjack pays ${r.blackjackPays[0]}:${r.blackjackPays[1]}`,
    `Double on ${r.doubleOn === 'any' ? 'any two cards' : r.doubleOn}${r.doubleAfterSplit ? ', after splits too' : ''}`,
    `Split to ${r.maxHands} hands${r.resplitAces ? ', resplit aces' : ''}${r.hitSplitAces ? ', hit split aces' : ''}`,
    r.surrender === 'none' ? 'No surrender' : `${r.surrender === 'early' ? 'Early' : 'Late'} surrender`,
    `Limits ${money(r.minBet)}–${money(r.maxBet)}`,
  ];
}

export function SettingsPanel() {
  const settings = useGameStore((s) => s.settings);
  const phase = useGameStore((s) => s.game.phase);
  const ui = useUi((s) => s);
  const [bankrollInput, setBankrollInput] = useState(String(settings.startingBankroll / 100));
  const { updateSettings, resetBankroll } = gameStore.getState();
  const midRound = phase !== 'betting' && phase !== 'roundOver';
  const rules = RULE_PRESETS[settings.presetId];

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-6 lg:grid-cols-2">
      <section aria-labelledby="table-title" className="rounded-2xl bg-white/[0.03] p-5 ring-1 ring-white/8">
        <h2 id="table-title" className="mb-3 text-lg font-semibold">
          Table
        </h2>
        <label className="flex flex-col gap-1.5 text-sm text-ink-2">
          House rules
          <select
            value={settings.presetId}
            disabled={midRound}
            onChange={(e) => { updateSettings({ presetId: e.target.value as PresetId }); }}
            className="h-11 rounded-xl bg-black/30 px-3 text-base text-ink ring-1 ring-white/15 disabled:opacity-50"
          >
            {Object.entries(RULE_PRESETS).map(([id, r]) => (
              <option key={id} value={id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        {midRound && <p className="mt-1 text-xs text-warn">Finish the current round to change tables.</p>}
        <ul className="mt-4 space-y-1.5 text-sm text-ink-2">
          {rulesSummary(rules).map((line) => (
            <li key={line} className="flex gap-2">
              <span aria-hidden className="text-brass-400">•</span>
              {line}
            </li>
          ))}
        </ul>
        {settings.presetId === 'au-casino' && (
          <p className="mt-4 rounded-xl bg-warn/10 p-3 text-xs text-ink-2 ring-1 ring-warn/30">
            Australian rules vary by venue and table. Check the house rules card where you play, especially whether a dealer
            blackjack takes your doubles and splits.
          </p>
        )}

        <form
          className="mt-6 flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const cents = Math.round(Number(bankrollInput) * 100);
            if (!Number.isFinite(cents) || cents <= 0) return;
            updateSettings({ startingBankroll: cents });
            resetBankroll(cents);
          }}
        >
          <label className="flex flex-col gap-1.5 text-sm text-ink-2">
            Starting bankroll (AUD)
            <input
              inputMode="decimal"
              value={bankrollInput}
              onChange={(e) => { setBankrollInput(e.target.value.replace(/[^\d.]/g, '')); }}
              className="tabular h-11 w-40 rounded-xl bg-black/30 px-3 text-base text-ink ring-1 ring-white/15"
            />
          </label>
          <Button type="submit" variant="danger" disabled={midRound}>
            Reset bankroll
          </Button>
        </form>
      </section>

      <section aria-labelledby="coach-title" className="rounded-2xl bg-white/[0.03] p-5 ring-1 ring-white/8">
        <h2 id="coach-title" className="mb-1 text-lg font-semibold">
          Coach and counting
        </h2>
        <div className="divide-y divide-white/8">
          <Toggle
            label="Coach"
            description="Grade every decision and price mistakes in dollars."
            checked={settings.coach}
            onChange={(coach) => { updateSettings({ coach }); }}
          />
          <Toggle
            label="Grade with index plays"
            description="Use Hi-Lo Illustrious 18 and Fab 4 at the live true count instead of pure basic strategy."
            checked={settings.useDeviations}
            onChange={(useDeviations) => { updateSettings({ useDeviations }); }}
          />
          <Toggle
            label="Highlight the right move"
            description="Ring the recommended button while you play. Shortcut: ?"
            checked={ui.showHints}
            onChange={(v) => { uiStore.getState().set('showHints', v); }}
          />
          <Toggle
            label="Show the count"
            description="Running count, true count and decks left on the table. Shortcut: K"
            checked={ui.showCount}
            onChange={(v) => { uiStore.getState().set('showCount', v); }}
          />
          <div className="flex flex-wrap items-center justify-between gap-3 py-3">
            <span className="font-medium">Counting system</span>
            <Segmented<CountingSystemId>
              label="Counting system"
              value={settings.countingSystem}
              options={COUNTING_SYSTEMS.map((s) => ({ value: s.id, label: s.name.replace(' (KO)', '') }))}
              onChange={(countingSystem) => { updateSettings({ countingSystem }); }}
            />
          </div>
          {settings.useDeviations && settings.countingSystem !== 'hi-lo' && (
            <p className="py-2 text-xs text-warn">Index plays are Hi-Lo numbers; grading falls back to basic strategy with this system.</p>
          )}
        </div>

        <h2 className="mt-6 mb-1 text-lg font-semibold">Feel</h2>
        <div className="divide-y divide-white/8">
          <Toggle label="Sound" checked={ui.sound} onChange={(v) => { uiStore.getState().set('sound', v); }} />
          <label className="flex items-center justify-between gap-4 py-3">
            <span className="font-medium">Deal speed</span>
            <input
              type="range"
              min={0}
              max={400}
              step={20}
              value={400 - ui.dealSpeed}
              onChange={(e) => { uiStore.getState().set('dealSpeed', 400 - Number(e.target.value)); }}
              className="w-40 accent-brass-400"
              aria-valuetext={ui.dealSpeed === 0 ? 'Instant' : `${ui.dealSpeed} milliseconds between cards`}
            />
          </label>
        </div>
      </section>

      <section aria-labelledby="keys-title" className="rounded-2xl bg-white/[0.03] p-5 ring-1 ring-white/8 lg:col-span-2">
        <h2 id="keys-title" className="mb-3 text-lg font-semibold">
          Keyboard
        </h2>
        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm lg:grid-cols-[max-content_1fr_max-content_1fr]">
          {[
            ['H S D P R', 'Hit, stand, double, split, surrender'],
            ['1 – 5', 'Add a $5 / $25 / $100 / $500 / $1K chip'],
            ['Enter or Space', 'Deal'],
            ['C / X', 'Clear bet / double bet'],
            ['Y / N', 'Insurance yes / no'],
            ['K', 'Show or hide the count'],
            ['?', 'Show or hide move hints'],
          ].map(([k, d]) => (
            <div key={k} className="contents">
              <dt className="font-semibold text-brass-200">{k}</dt>
              <dd className="text-ink-2">{d}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
