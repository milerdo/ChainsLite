// ============================================================================
// CHAINS LITE — JackpotPanel
// Single progressive pool. Eases toward its new value with a short numeric
// tween whenever it changes (funding or a payout reset).
// ============================================================================

import { useEffect, useRef, useState } from 'react';
import { useGame } from '../hooks/useGame';
import { LINK_LENGTH, PRIZE_MULTIPLIERS } from '../game/constants';
import { formatCompactCurrency, formatCurrency, formatMultiplier } from '../utils/format';

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
  const { jackpotPool, payoutFlash } = useGame();
  const animated = useAnimatedValue(jackpotPool);

  return (
    <section
      aria-label="Progressive jackpot"
      className="relative flex h-11 w-full shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#eab308]/30 bg-gradient-to-b from-[#eab308]/[0.06] to-transparent px-2 shadow-[0_0_12px_-6px_rgba(234,179,8,0.35)] backdrop-blur-sm"
    >
      <span className="pointer-events-none absolute inset-0 animate-pulse bg-gradient-to-t from-[#eab308]/[0.04] to-transparent" />
      {payoutFlash ? (
        <span
          key={payoutFlash.key}
          className="relative animate-pulse font-mono text-base font-black uppercase tracking-[0.15em] text-emerald-300"
        >
          Win {formatCurrency(payoutFlash.amount)} paid
        </span>
      ) : (
        <p className="relative flex items-baseline justify-center gap-x-1 whitespace-nowrap font-mono sm:gap-x-1.5">
          <span className="text-[11px] uppercase text-white/60 sm:text-xs">1 hit</span>
          <span className="text-sm font-bold text-white">{formatMultiplier(PRIZE_MULTIPLIERS[1])}</span>
          <span className="text-white/25">·</span>
          <span className="text-[11px] uppercase text-white/60 sm:text-xs">2 hits</span>
          <span className="text-sm font-bold text-white">{formatMultiplier(PRIZE_MULTIPLIERS[2])}</span>
          <span className="text-white/25">·</span>
          <span className="text-[11px] font-bold uppercase text-[#fbbf24] sm:text-xs">
            {LINK_LENGTH} hits<span className="max-[430px]:hidden"> JACKPOT</span>
          </span>
           <span className="text-sm font-bold tabular-nums text-[#fde68a] sm:text-base">
            {formatCompactCurrency(animated)}
          </span>
        </p>
      )}
    </section>
  );
}