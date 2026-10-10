import { DIGIT_COLORS } from '../utils/digitColors';
import { LINK_LENGTH } from '../game/constants';
import { isTerminal } from '../game/ticket';
import type { Ticket } from '../game/types';

type CircleState = 'pending' | 'current' | 'hit' | 'miss';

/** Derived from the ticket's own drawLog: no duplicated per-position state. */
function circleState(ticket: Ticket, index: number): CircleState {
  const entry = ticket.drawLog[index];
  if (entry) return entry.matched ? 'hit' : 'miss';
  if (!isTerminal(ticket.status) && index === ticket.drawLog.length) return 'current';
  return 'pending';
}

/** Background stays tinted to the digit's wheel color; the border carries
 * the progress signal (pending / current / hit / miss). */
function circleColors(digit: number, state: CircleState): { bg: string; border: string } {
  const c = DIGIT_COLORS[digit];
  switch (state) {
    case 'hit':
      return { bg: `${c}80`, border: '#34d399' };
    case 'miss':
      return { bg: `${c}40`, border: '#f87171' };
    case 'current':
      return { bg: `${c}80`, border: '#eab308' };
    default:
      return { bg: `${c}33`, border: `${c}66` };
  }
}

const TEXT: Record<CircleState, string> = {
  hit: 'text-white',
  miss: 'text-red-100',
  current: 'text-white',
  pending: 'text-white/55',
};

interface CircleProps {
  digit: number;
  state: CircleState;
  size?: 'xs' | 'sm' | 'md';
}

export function ChainCircle({ digit, state, size = 'md' }: CircleProps) {
  const dims = size === 'xs' ? 'h-6 w-6 text-[11px]' : size === 'sm' ? 'h-8 w-8 text-sm' : 'h-9 w-9 text-sm';
  const { bg, border } = circleColors(digit, state);
  return (
    <span
      style={{ backgroundColor: bg, borderColor: border }}
      className={[
        'relative flex shrink-0 items-center justify-center rounded-full border font-mono font-bold tabular-nums transition-colors',
        dims,
        state === 'current' ? 'border-[3px] shadow-[0_0_0_3px_rgba(234,179,8,0.18)] animate-pulse' : '',
        TEXT[state],
      ].join(' ')}
    >
      {digit}
      {state === 'miss' && (
        <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/45 text-sm font-black text-red-400">
          ✕
        </span>
      )}
    </span>
  );
}

function Connector({ size }: { size: 'xs' | 'sm' | 'md' }) {
  const width = size === 'md' ? 'w-3' : 'w-2';
  return <span className={`h-[2px] shrink-0 ${width} bg-white/15`} />;
}

interface LinkChainProps {
  ticket: Ticket;
  size?: 'xs' | 'sm' | 'md';
}

export function LinkChain({ ticket, size = 'md' }: LinkChainProps) {
  const live = !isTerminal(ticket.status);
  const spin = Math.min(ticket.drawLog.length + 1, LINK_LENGTH);
  return (
    <div className="flex flex-nowrap items-center">
      <span className="flex shrink-0 items-center">
        {ticket.digits.map((digit, i) => (
          <span key={i} className="flex items-center">
            {i > 0 && <Connector size={size} />}
            <ChainCircle digit={digit} state={circleState(ticket, i)} size={size} />
          </span>
        ))}
      </span>
      {live && (
        <span className="ml-2.5 shrink-0 font-mono text-[10px] uppercase tracking-[0.1em] text-white/40">
          spin {spin} of {LINK_LENGTH}
        </span>
      )}
    </div>
  );
}