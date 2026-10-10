import { useEffect, useState } from 'react';
import { useGame } from '../hooks/useGame';
import { playUiClick } from '../utils/audio';
import { formatCurrency } from '../utils/format';
import { LINK_LENGTH, TICKET_STAKE } from '../game/constants';
import { DIGIT_COLORS } from '../utils/digitColors';

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

export function BettingPanel() {
  const { placeBet, balance, bettingLocked: locked } = useGame();
  const [digits, setDigits] = useState<(number | null)[]>(() => Array(LINK_LENGTH).fill(null));
  const [focus, setFocus] = useState<number | null>(0);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (!feedback) return;
    const timeout = window.setTimeout(() => setFeedback(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [feedback]);

  const filled = digits.filter((d): d is number => d !== null);
  const complete = filled.length === LINK_LENGTH;
  const canSubmit = !locked && complete && balance >= TICKET_STAKE;

  function handleSlot(index: number) {
    if (locked) return;
    playUiClick();
    setFocus(index);
  }

  function handleDigitPress(digit: number) {
    if (locked || focus === null) return;
    playUiClick();
    setFeedback(null);
    setDigits((prev) => {
      const next = [...prev];
      next[focus] = digit;
      return next;
    });
    setFocus(focus + 1 < LINK_LENGTH ? focus + 1 : null);
  }

  function handleClear() {
    if (locked) return;
    playUiClick();
    setDigits(Array(LINK_LENGTH).fill(null));
    setFocus(0);
    setFeedback(null);
  }

  function handleRandom() {
    if (locked) return;
    playUiClick();
    setDigits(Array.from({ length: LINK_LENGTH }, () => Math.floor(Math.random() * 10)));
    setFocus(null);
    setFeedback(null);
  }

  function handleSubmit() {
    if (!canSubmit) return;
    const result = placeBet({ links: [filled] });
    if (result.success) {
      playUiClick();
      setFeedback({ type: 'success', message: result.message });
      setDigits(Array(LINK_LENGTH).fill(null));
      setFocus(0);
    } else {
      setFeedback({ type: 'error', message: result.message });
    }
  }

  return (
    <section
      aria-label="Place a bet"
      className="rounded-3xl border border-white/[0.07] bg-gradient-to-b from-white/[0.035] to-transparent p-4 backdrop-blur-sm sm:p-5"
    >
      <div className="flex items-center justify-center gap-2">
        {digits.map((digit, i) => {
          const isFocused = focus === i;
          const isFilled = digit !== null;
          return (
            <button
              key={i}
              type="button"
              onClick={() => handleSlot(i)}
              disabled={locked}
              style={isFilled && !isFocused ? { backgroundColor: `${DIGIT_COLORS[digit]}33`, borderColor: DIGIT_COLORS[digit] } : undefined}
              className={[
                'flex h-12 w-12 items-center justify-center rounded-xl border font-mono text-xl font-bold tabular-nums transition',
                isFocused
                  ? 'border-[#eab308] bg-[#eab308]/15 text-[#eab308] shadow-[0_0_0_3px_rgba(234,179,8,0.15)]'
                  : isFilled
                    ? 'text-white'
                    : 'border-dashed border-white/15 text-white/25',
              ].join(' ')}
            >
              {digit ?? '·'}
            </button>
          );
        })}
      </div>

      <div
        className={[
          'mt-3 grid grid-cols-5 gap-1.5 transition-opacity duration-200',
          !locked && focus !== null ? 'opacity-100' : 'pointer-events-none opacity-30',
        ].join(' ')}
      >
        {DIGITS.map((digit) => (
          <button
            key={digit}
            type="button"
            onClick={() => handleDigitPress(digit)}
            disabled={locked || focus === null}
            style={{ backgroundColor: `${DIGIT_COLORS[digit]}80`, borderColor: `${DIGIT_COLORS[digit]}80` }}
            className="flex h-10 items-center justify-center rounded-lg border font-mono text-lg font-bold tabular-nums text-white transition hover:brightness-125 active:scale-95"
          >
            {digit}
          </button>
        ))}
      </div>

      <div className="mt-2 flex items-center justify-center gap-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleClear}
            disabled={locked || filled.length === 0}
            className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.15em] text-white/60 transition hover:border-[#eab308]/50 hover:text-[#eab308] disabled:cursor-not-allowed disabled:opacity-30"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={handleRandom}
            disabled={locked}
            className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.15em] text-white/60 transition hover:border-[#eab308]/50 hover:text-[#eab308] disabled:cursor-not-allowed disabled:opacity-30"
          >
            Random
          </button>
        </div>
      </div>

      <div className="sticky bottom-0 -mx-4 -mb-4 mt-4 rounded-b-3xl border-t border-white/[0.06] bg-[#141414]/95 px-4 pb-4 pt-4 backdrop-blur-sm sm:-mx-5 sm:-mb-5 sm:px-5 sm:pb-5">
          <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          aria-live="polite"
          className={[
            'flex h-12 w-full items-center justify-center rounded-xl border px-2 text-center font-mono transition',
            feedback
              ? 'border-transparent text-[11px] font-semibold normal-case leading-tight tracking-normal'
              : 'border-transparent text-sm font-bold uppercase tracking-[0.2em]',
            feedback?.type === 'success'
              ? 'cursor-default border-emerald-400/40 bg-emerald-400/15 text-emerald-300'
              : feedback?.type === 'error'
                ? 'border-red-400/40 bg-red-400/15 text-red-300'
                : canSubmit
                  ? 'bg-[#eab308] text-black shadow-[0_0_24px_-6px_rgba(234,179,8,0.7)] hover:bg-[#facc15]'
                  : 'cursor-not-allowed bg-white/[0.06] text-white/25',
          ].join(' ')}
        >
          {feedback
            ? feedback.message
            : complete
              ? `Place ${formatCurrency(TICKET_STAKE)} Bet`
              : `Select ${LINK_LENGTH} Digits`}
        </button>
      </div>
    </section>
  );
}