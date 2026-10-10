// ============================================================================
// CHAINS LITE — JackpotPanel
// Single progressive pool. Eases toward its new value with a short numeric
// tween whenever it changes (funding or a payout reset).
// ============================================================================

import { useEffect, useRef, useState } from 'react';
import { useGame } from '../hooks/useGame';
import { formatCompactCurrency } from '../utils/format';

function useAnimatedValue(target: number, durationMs = 650): number {
  const [display, setDisplay] = useState(target);
  const fromRef = useRef(target);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = fromRef.current;
    if (from === target) return;
    const start = performance.now();

    function step(now: number) {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (target - from) * eased);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        fromRef.current = target;
      }
    }
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, durationMs]);

  return display;
}

export function JackpotPanel() {
  const { jackpotPool } = useGame();
  const animated = useAnimatedValue(jackpotPool);

  return (
    <section
      aria-label="Progressive jackpot"
      className="relative w-full overflow-hidden rounded-lg border border-[#eab308]/25 bg-gradient-to-b from-white/[0.03] to-transparent px-2 py-1 backdrop-blur-sm"
    >
      <span className="pointer-events-none absolute inset-0 animate-pulse bg-gradient-to-t from-[#eab308]/[0.07] to-transparent" />
      <div className="relative flex flex-col items-center text-center">
        <span className="font-mono text-[10px] font-semibold uppercase leading-none tracking-[0.12em] text-[#fbbf24]">
          Jackpot
        </span>
        <span className="mt-0.5 font-mono text-base font-bold leading-tight tabular-nums text-white">
          {formatCompactCurrency(animated)}
        </span>
      </div>
    </section>
  );
}