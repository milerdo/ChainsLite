// ============================================================================
// CHAINS — MultiplayerSim ("Bets Heat Map")
// Simulated per-digit "what % of other players are betting each digit"
// bar chart. Each round gets one low-variance popularity bias from the
// engine (SimulatedActivity.digitPopularity, regenerated once per fresh
// BETTING_OPEN — see engine.ts's regenerateDigitPopularity()); this
// component animates the displayed bars drifting toward that bias with a
// small local jitter, only while betting is open, and resets to 0% the
// instant a new round starts.
// ============================================================================

import { useEffect, useRef, useState } from 'react';
import { useGame } from '../hooks/useGame';
import { DIGIT_COLORS } from '../utils/digitColors';

const TICK_MS = 1500;
const JITTER = 3;
const DRIFT_RATE = 0.35;

export function MultiplayerSim() {
  const { simulatedActivity, phase } = useGame();
  const target = simulatedActivity.digitPopularity;
  const [heat, setHeat] = useState<number[]>(() => Array(10).fill(0));
  const prevPhaseRef = useRef(phase);

  useEffect(() => {
    const enteredBettingOpen = phase === 'BETTING_OPEN' && prevPhaseRef.current !== 'BETTING_OPEN';
    prevPhaseRef.current = phase;
    if (enteredBettingOpen) setHeat(Array(10).fill(0));
  }, [phase]);

  useEffect(() => {
    if (phase !== 'BETTING_OPEN') return;
    const id = window.setInterval(() => {
      setHeat((prev) =>
        prev.map((v, i) => {
          const goal = target[i] ?? 10;
          const step = (goal - v) * DRIFT_RATE + (Math.random() * 2 - 1) * JITTER;
          return Math.max(0, Math.round(v + step));
        }),
      );
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [phase, target]);

  const maxPct = Math.max(...heat, 1);

  return (
    <section
      aria-label="Simulated live active bets"
      className="flex h-full min-h-0 flex-col rounded-3xl border border-white/[0.07] bg-gradient-to-b from-white/[0.035] to-transparent p-4 backdrop-blur-sm"
    >
      <div className="flex shrink-0 items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.4em] text-white/40">Live Active Bets</span>
        <span className="flex items-center gap-1.5 font-mono text-[10px] tabular-nums text-white/40">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          {simulatedActivity.playerCount.toLocaleString()} players
        </span>
      </div>

      <div className="mt-2 flex min-h-0 flex-1 items-end justify-between gap-1">
        {heat.map((pct, digit) => (
          <div key={digit} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
            <span className="font-mono text-[11px] font-semibold tabular-nums text-white/60">{pct}%</span>
            <div className="flex w-full flex-1 flex-col justify-end overflow-hidden rounded-t-md bg-white/[0.05]">
              <div
                className="w-full transition-all duration-700"
                style={{ height: `${(pct / maxPct) * 100}%`, backgroundColor: DIGIT_COLORS[digit] }}
              />
            </div>
            <span
              style={{ backgroundColor: DIGIT_COLORS[digit] }}
              className="flex h-5 w-full items-center justify-center rounded-b-md font-mono text-[11px] font-bold tabular-nums text-white"
            >
              {digit}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}