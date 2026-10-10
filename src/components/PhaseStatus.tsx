import { useGame } from '../hooks/useGame';
import { formatCountdown, formatCurrency } from '../utils/format';

export function PhaseStatus({ className = '' }: { className?: string }) {
  const { payoutFlash, bettingLocked: locked, timeRemaining } = useGame();
  return (
    <div className={`flex h-10 shrink-0 items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 ${className}`}>
      {payoutFlash ? (
        <span key={payoutFlash.key} className="animate-pulse font-mono text-xs font-bold uppercase tracking-[0.15em] text-emerald-300">
          Win {formatCurrency(payoutFlash.amount)} paid
        </span>
      ) : (
        <span className="flex items-center gap-3">
          <span className={['font-mono text-xs font-semibold uppercase tracking-[0.3em]', locked ? 'text-[#eab308]' : 'text-emerald-400'].join(' ')}>
            {locked ? 'GOOD LUCK' : 'BETTING OPEN'}
          </span>
          {!locked && <span className="font-mono text-sm tabular-nums text-white/70">{formatCountdown(timeRemaining)}s</span>}
        </span>
      )}
    </div>
  );
}