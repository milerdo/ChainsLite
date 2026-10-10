// ============================================================================
// CHAINS — GameHistory
// Two tabs: the shared GLOBAL draw history (identical for every player) and
// the local player's ticket HISTORY (every resolved ticket, win or loss).
// ============================================================================

import { useState } from 'react';
import { useGame } from '../hooks/useGame';
import { formatDrawIndex, formatSequence, formatSignedCurrency } from '../utils/format';
import { playUiClick } from '../utils/audio';
import type { Ticket } from '../game/types';

type Tab = 'GLOBAL' | 'YOURS';

const VISIBLE_GLOBAL_ROWS = 20;
const VISIBLE_TICKET_ROWS = 20;

/** Amounts are NET (return minus stake), matching the Session Net total. */
function outcomeMeta(ticket: Ticket): { label: string; amount: number; tone: 'win' | 'loss' } {
  if (ticket.status === 'LOST') {
    return { label: 'LOSS', amount: -ticket.stake, tone: 'loss' };
  }
  if (ticket.status === 'JACKPOT_WON') {
    return { label: 'JACKPOT', amount: ticket.totalReturn - ticket.stake, tone: 'win' };
  }
  return { label: `${ticket.hits} HIT${ticket.hits === 1 ? '' : 'S'}`, amount: ticket.totalReturn - ticket.stake, tone: 'win' };
}

interface GameHistoryProps {
  /** Which tab shows first. Defaults to 'GLOBAL' — unchanged for any
   * existing call site that doesn't pass this. */
  defaultTab?: Tab;
}

export function GameHistory({ defaultTab = 'GLOBAL' }: GameHistoryProps = {}) {

  const { streamHistory, history } = useGame();
  const [tab, setTab] = useState<Tab>(defaultTab);

  function selectTab(next: Tab) {
    playUiClick();
    setTab(next);
  }

  const globalRows = [...streamHistory].slice(-VISIBLE_GLOBAL_ROWS).reverse();
  const ticketRows = [...history].slice(-VISIBLE_TICKET_ROWS).reverse();

  return (
    <section
      aria-label="Game history"
      className="rounded-3xl border border-white/[0.07] bg-gradient-to-b from-white/[0.035] to-transparent p-5 backdrop-blur-sm sm:p-6"
    >
      <div className="flex items-center gap-1 rounded-xl bg-white/[0.03] p-1">
        <TabButton label="Draw History" active={tab === 'GLOBAL'} onClick={() => selectTab('GLOBAL')} />
        <TabButton label="Your History" active={tab === 'YOURS'} onClick={() => selectTab('YOURS')} />
      </div>

      <div className="mt-3.5 max-h-64 overflow-y-auto pr-1">
        {tab === 'GLOBAL' ? (
          globalRows.length === 0 ? (
            <EmptyState message="No draws yet." />
          ) : (
            <ul className="flex flex-col gap-1">
              {globalRows.map((draw) => (
                <li
                  key={draw.drawIndex}
                  className="flex items-center justify-between rounded-lg px-2.5 py-1.5 font-mono text-xs odd:bg-white/[0.015]"
                >
                  <span className="text-white/40">{formatDrawIndex(draw.drawIndex)}</span>
                  <span className="font-bold tabular-nums text-white">{draw.digit}</span>
                </li>
              ))}
            </ul>
          )
        ) : ticketRows.length === 0 ? (
          <EmptyState message="No resolved tickets yet." />
        ) : (
          <ul className="flex flex-col gap-1">
            {ticketRows.map((ticket) => {
              const outcome = outcomeMeta(ticket);
              return (
                <li
                  key={ticket.id}
                  className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 font-mono text-xs odd:bg-white/[0.015]"
                >
                  <span className="text-white/60">
                    {formatSequence(ticket.digits)}
                  </span>
                  <span className="shrink-0 text-white/35">{outcome.label}</span>
                  <span
                    className={[
                      'shrink-0 font-bold tabular-nums',
                      outcome.tone === 'win' ? 'text-emerald-300' : 'text-red-300',
                    ].join(' ')}
                  >
                    {formatSignedCurrency(outcome.amount)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'flex-1 rounded-lg py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.15em] transition',
        active ? 'bg-[#eab308] text-black' : 'text-white/40 hover:text-white/70',
      ].join(' ')}
    >
      {label}
    </button>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <p className="rounded-xl border border-dashed border-white/10 px-3 py-6 text-center font-mono text-xs text-white/30">
      {message}
    </p>
  );
}
