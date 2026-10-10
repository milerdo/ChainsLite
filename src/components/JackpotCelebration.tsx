// ============================================================================
// CHAINS — JackpotCelebration
// Full-screen celebratory overlay fired the instant a link's jackpot win is
// revealed (see useGame.ts's jackpotCelebration, set at the same gated
// commit point as the win sound/fanfare — never before the wheel lands).
// ============================================================================

import { useEffect } from 'react';
import { useGame } from '../hooks/useGame';
import { formatSignedCurrency } from '../utils/format';

const AUTO_DISMISS_MS = 4200;
const CONFETTI_COLORS = ['#eab308', '#facc15', '#fde68a', '#f59e0b', '#ffffff'];
const CONFETTI_COUNT = 36;

export function JackpotCelebration() {
  const { jackpotCelebration, dismissJackpotCelebration } = useGame();

  useEffect(() => {
    if (!jackpotCelebration) return;
    const timeout = window.setTimeout(dismissJackpotCelebration, AUTO_DISMISS_MS);
    return () => window.clearTimeout(timeout);
  }, [jackpotCelebration, dismissJackpotCelebration]);

  if (!jackpotCelebration) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 backdrop-blur-sm"
      role="alertdialog"
      aria-label="Jackpot won"
      onClick={dismissJackpotCelebration}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {Array.from({ length: CONFETTI_COUNT }, (_, i) => {
          const left = (i * 137.5) % 100; // golden-angle spread, deterministic
          const delay = (i % 12) * 90;
          const duration = 2200 + (i % 7) * 260;
          const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
          const size = 6 + (i % 4) * 3;
          return (
            <span
              key={i}
              className="absolute top-[-5%] rounded-sm opacity-90"
              style={{
                left: `${left}%`,
                width: size,
                height: size * 1.6,
                backgroundColor: color,
                animation: `chains-confetti-fall ${duration}ms ${delay}ms ease-in forwards`,
              }}
            />
          );
        })}
      </div>

      <div className="relative flex flex-col items-center gap-3 rounded-3xl border border-[#eab308]/40 bg-[#141414]/90 px-10 py-10 text-center shadow-[0_0_80px_-12px_rgba(234,179,8,0.65)]">
        <span className="animate-pulse font-mono text-4xl font-black uppercase tracking-[0.15em] text-[#eab308] sm:text-5xl">
          Jackpot Won
        </span>
        <span className="font-mono text-3xl font-bold tabular-nums text-white sm:text-4xl">
          {formatSignedCurrency(jackpotCelebration.amount)}
        </span>
        <span className="mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-white/35">
          tap anywhere to dismiss
        </span>
      </div>

      <style>{`
        @keyframes chains-confetti-fall {
          0% { transform: translateY(0) rotate(0deg); opacity: 0.95; }
          100% { transform: translateY(110vh) rotate(540deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}