// ============================================================================
// CHAINS — App
// Cabinet-style layout, no page scroll. Desktop: fixed 3-column grid
// (betting | wheel/jackpot | tickets+chat). Mobile: tabbed BET/TABLE/TICKETS,
// auto-switching on phase change (BETTING_OPEN -> BET, wheel hidden;
// anything else -> TABLE so the player never misses a draw). A manual tap
// wins until the next genuine phase transition (same prevPhaseRef pattern
// used elsewhere — DemoPanel, Wheel.tsx).
// ============================================================================

import { useState } from 'react';
import { GameProvider, useGame } from './hooks/useGame';
import { GameHeader } from './components/GameHeader';
import { JackpotPanel } from './components/JackpotPanel';
import { Wheel } from './components/Wheel';
import { BettingPanel } from './components/BettingPanel';
import { TicketDrawer } from './components/Ticket';
import { MultiplayerSim } from './components/MultiplayerSim';
import { EmojiChat } from './components/EmojiChat';
import { HelpModal } from './components/HelpModal';
import { BetHistoryModal } from './components/BetHistoryModal';
import { DemoPanel } from './components/DemoPanel';
import { JackpotCelebration } from './components/JackpotCelebration';
import { MobileFooter } from './components/MobileFooter';
import { PhaseStatus } from './components/PhaseStatus';
import { useMediaQuery } from './hooks/useMediaQuery';

/** Presenter tools only appear when the URL has ?demo (e.g. yoursite.com/?demo). */
const demoEnabled = new URLSearchParams(window.location.search).has('demo');

function AppShell() {
  const { activeTickets, phase, balance, bettingLocked } = useGame();
  const [helpOpen, setHelpOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false); 
  const [demoOpen, setDemoOpen] = useState(false);
  const isDesktop = useMediaQuery('(min-width: 1024px)'); // matches Tailwind's `lg`
  const shortScreen = useMediaQuery('(max-height: 740px)');

  return (
    <div className="table-ambience flex h-dvh flex-col overflow-hidden text-white/90">
      <GameHeader
        onOpenHelp={() => setHelpOpen(true)}
        onOpenHistory={() => setHistoryOpen(true)}
        onToggleDemo={() => setDemoOpen((o) => !o)}
        showDemo={demoEnabled}
      />

            {isDesktop ? (
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="mx-auto grid min-h-0 w-full max-w-6xl flex-1 grid-cols-[1fr_1.3fr_1fr] gap-4 overflow-hidden px-6 py-4">
            <div className="flex min-h-0 flex-col gap-3 overflow-hidden">
              <div className="h-[31%] min-h-[190px] shrink-0">
                <MultiplayerSim />
              </div>
              <EmojiChat />
            </div>
            <div className="flex min-h-0 flex-col gap-3 overflow-hidden">
              <JackpotPanel />
              <Wheel />
            </div>
            <div className="flex min-h-0 flex-col overflow-hidden">
              <PhaseStatus className="mb-3" />
              <div className={['min-h-0 flex-1 overflow-y-auto pr-1', bettingLocked ? 'hidden' : ''].join(' ')}>
                <BettingPanel />
                {activeTickets.length > 0 && (
                  <div className="mt-3">
                    <TicketDrawer tickets={activeTickets} />
                  </div>
                )}
              </div>
              {bettingLocked && (
                <div className="min-h-0 flex-1 overflow-hidden">
                  <TicketDrawer tickets={activeTickets} />
                </div>
              )}
            </div>
          </div>
        </main>
      ) : (
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex min-h-0 flex-1 flex-col gap-2 px-4 py-2">
            <PhaseStatus />
            {!(shortScreen && !bettingLocked) && <JackpotPanel />}
            <div className={['shrink-0', shortScreen && !bettingLocked ? 'hidden' : ''].join(' ')}>
              <Wheel compact collapsed={phase === 'BETTING_OPEN'} />
            </div>
            {/* Shared zone: BettingPanel stays mounted (hidden) while locked */}
            <div className={['flex min-h-0 flex-1 flex-col gap-2', bettingLocked ? 'hidden' : ''].join(' ')}>
              <div className="min-h-0 flex-1 overflow-y-auto">
                <BettingPanel />
              </div>
            </div>
             {bettingLocked && activeTickets.length > 0 && <TicketDrawer tickets={activeTickets} compact />}
          </div>
          <MobileFooter
            balance={balance}
            onOpenHelp={() => setHelpOpen(true)}
            onOpenHistory={() => setHistoryOpen(true)}
            onToggleDemo={() => setDemoOpen((o) => !o)}
            showDemo={demoEnabled}
          />
        </main>
      )}

      <HelpModal isOpen={helpOpen} onClose={() => setHelpOpen(false)} />
      <BetHistoryModal isOpen={historyOpen} onClose={() => setHistoryOpen(false)} />
      <DemoPanel isOpen={demoEnabled && demoOpen} />
      <JackpotCelebration />
    </div>
  );
}

export default function App() {
  return (
    <GameProvider demoPreset={demoEnabled}>
      <AppShell />
    </GameProvider>
  );
}