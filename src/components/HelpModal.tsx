// ============================================================================
// CHAINS LITE — HelpModal
// All figures come from constants.ts / rtp.ts, never re-typed here.
// ============================================================================

import { useEffect, type ReactNode } from 'react';
import { INITIAL_JACKPOT_POOL, LINK_LENGTH, MAX_LINKS_PER_ROUND, PRIZE_MULTIPLIERS, RNG_DISCLAIMER } from '../game/constants';
import { houseEdge, totalRtp } from '../game/rtp';
import { formatCurrency, formatPercent } from '../utils/format';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HelpModal({ isOpen, onClose }: HelpModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="How to play"
      onClick={onClose}
    >
      <div
        className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-white/10 bg-[#141414] p-6 shadow-2xl sm:rounded-3xl sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-mono text-lg font-bold tracking-[0.1em] text-white">HOW TO PLAY</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-6 w-6 items-center justify-center rounded-full border border-white/10 text-xs text-white/50 transition hover:border-[#eab308]/50 hover:text-[#eab308]"
          >
            ✕
          </button>
        </div>

        <div className="mt-6 flex flex-col gap-6 text-sm leading-relaxed text-white/70">
          <Section title="Your link">
            <p>
              Pick {LINK_LENGTH} digits, in order, and place a {formatCurrency(1)} bet. Your link starts on the next draw and
              lives exactly {LINK_LENGTH} draws. Draw 1 is checked against your 1st digit, draw 2 against your 2nd, draw 3
              against your 3rd. A miss does not end the link. You can place up to {MAX_LINKS_PER_ROUND} links per round.
            </p>
          </Section>

          <Section title="Prizes">
            <table className="w-full font-mono text-xs">
              <thead>
                <tr className="text-left uppercase tracking-[0.15em] text-white/40">
                  <th className="pb-2 font-medium">Hits</th>
                  <th className="pb-2 text-right font-medium">Total return</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-white/[0.07]">
                  <td className="py-2 text-white/60">0</td>
                  <td className="py-2 text-right text-white/40">—</td>
                </tr>
                <tr className="border-t border-white/[0.07]">
                  <td className="py-2 text-white/60">1</td>
                  <td className="py-2 text-right font-bold text-[#eab308]">{PRIZE_MULTIPLIERS[1]}×</td>
                </tr>
                <tr className="border-t border-white/[0.07]">
                  <td className="py-2 text-white/60">2</td>
                  <td className="py-2 text-right font-bold text-[#eab308]">{PRIZE_MULTIPLIERS[2]}×</td>
                </tr>
                <tr className="border-t border-white/[0.07]">
                  <td className="py-2 text-white/60">{LINK_LENGTH}</td>
                  <td className="py-2 text-right font-bold text-[#eab308]">JACKPOT</td>
                </tr>
              </tbody>
            </table>
            <p className="mt-3">Prizes are paid when your link settles, on its 3rd draw.</p>
          </Section>

          <Section title="Jackpot">
            <p>
              The pool starts at {formatCurrency(INITIAL_JACKPOT_POOL)}, grows with every bet, and resets after a win. Hit all{' '}
              {LINK_LENGTH} digits to win the whole pool instead of the 1- or 2-hit prize. Simultaneous winners split it equally.
            </p>
          </Section>

          <Section title="Example">
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 font-mono text-xs">
              <p className="text-white/50">Link 4 → 2 → 3</p>
              <div className="mt-3 flex flex-col gap-1.5">
                <ExampleRow label="Draw 1" value="4" note="✓ hit" tone="win" />
                <ExampleRow label="Draw 2" value="9" note="✕ miss, link stays alive" tone="miss" />
                <ExampleRow label="Draw 3" value="3" note={`✓ hit — 2 hits, ${PRIZE_MULTIPLIERS[2]}× paid`} tone="win" />
              </div>
            </div>
          </Section>

          <Section title="RTP - Return to Player">
            <div className="grid grid-cols-2 gap-2">
              <RtpStat label="Total RTP" value={formatPercent(totalRtp())} highlight />
              <RtpStat label="House edge" value={formatPercent(houseEdge())} />
            </div>
            <p className="mt-2 text-xs text-white/45">Includes the jackpot share funded by bets and the operator seed.</p>
          </Section>

          <Section title="Demo">
            <p className="text-xs text-white/45">{RNG_DISCLAIMER}</p>
            <p className="mt-1.5 text-xs text-white/45">Player counts, the heat map and chat are simulated.</p>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="font-mono text-xs font-bold uppercase tracking-[0.25em] text-[#eab308]">{title}</h3>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function ExampleRow({ label, value, note, tone }: { label: string; value: string; note: string; tone: 'win' | 'miss' }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-14 shrink-0 text-white/40">{label}</span>
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/[0.06] font-bold text-white">
        {value}
      </span>
      <span className={tone === 'miss' ? 'text-red-300' : 'text-emerald-300'}>{note}</span>
    </div>
  );
}

function RtpStat({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className={[
        'rounded-xl border px-3 py-2 text-center',
        highlight ? 'border-[#eab308]/40 bg-[#eab308]/[0.06]' : 'border-white/[0.07] bg-white/[0.02]',
      ].join(' ')}
    >
      <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/40">{label}</div>
      <div className={['mt-0.5 font-mono text-sm font-bold', highlight ? 'text-[#eab308]' : 'text-white'].join(' ')}>
        {value}
      </div>
    </div>
  );
}