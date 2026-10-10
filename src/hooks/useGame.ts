// ============================================================================
// CHAINS LITE — useGame Hook + GameProvider
// Thin reactive bridge from the pure ChainsGame engine into React. No game
// math lives here.
//
// Reveal pipeline (unchanged from CHAINS):
//   1. wheelTargetDraw tells the Wheel which digit to land on (not shown yet).
//   2. currentDraw / streamHistory / tickets / balance / jackpotPool update
//      only in commitPublicReveal(), called when the Wheel reports it landed
//      (reportWheelLanded) or a fallback timer fires.
// Outcome sounds fire from the same commit point, never earlier. Non-draw
// emits (bets, demo actions) update immediately unless a reveal is in flight.
// ============================================================================

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { applyDemoJackpotPreset } from '../game/demoPreset';
import { ChainsGame } from '../game/engine';
import { isTerminal } from '../game/ticket';
import { playBaseWin, playJackpotFanfare, playStepMatch } from '../utils/audio';
import type {
  BetRequest,
  DrawResult,
  GameConfig,
  GamePhase,
  GameState,
  PlaceBetResult,
  SimulatedActivity,
  Ticket,
  TicketStatus,
} from '../game/types';

export interface UseGameValue {
  /** True whenever betting is not open. */
  bettingLocked: boolean;
  /** Transient "prize paid" notice, shown in PhaseStatus. */
  payoutFlash: { amount: number; key: number } | null;
  /** Raw engine snapshot (NOT reveal-gated; never show outcomes from it). */
  gameState: GameState;
  activeTickets: Ticket[];
  history: Ticket[];
  balance: number;
  jackpotPool: number;
  /** Most recent draw, held back until the Wheel has landed. */
  currentDraw: DrawResult | null;
  streamHistory: DrawResult[];
  /** The digit the Wheel should land on. Only Wheel.tsx should read this. */
  wheelTargetDraw: DrawResult | null;
  reportWheelLanded: () => void;
  phase: GamePhase;
  timeRemaining: number;
  speedMultiplier: number;
  isPaused: boolean;
  isRunning: boolean;
  config: GameConfig;
  drawIndex: number;
  simulatedActivity: SimulatedActivity;
  forcedQueue: number[];
  jackpotCelebration: { ticketId: string; amount: number } | null;
  dismissJackpotCelebration: () => void;

  placeBet: (request: BetRequest) => PlaceBetResult;
  forceNextDraw: (digit: number) => void;
  forceDrawSequence: (digits: number[]) => void;
  clearForcedDraws: () => void;
  instantStep: () => void;
  setSpeed: (multiplier: number) => void;
  pauseGame: () => void;
  resumeGame: () => void;
  resetGame: () => void;
  resetBalance: () => void;
  simulateJackpotWin: () => void;
  createSimulatedTicket: () => void;
}

const GameContext = createContext<UseGameValue | null>(null);

const TIME_TICK_MS = 200;

/** Floor on how long a draw stays hidden after it's computed. */
export const MIN_REVEAL_DELAY_MS = 1200;

/** Ceiling on how long the public reveal waits for reportWheelLanded(). Keep
 * above Wheel.tsx's MAX_APPROACH_MS (1800). */
const PUBLIC_REVEAL_FALLBACK_MS = 2500;

/** Reserved at the end of the DRAWING phase for the Wheel's landing tween.
 * Must be >= Wheel.tsx's MAX_APPROACH_MS. */
const WHEEL_MAX_LANDING_MS = 1800;

interface RevealedState {
  currentDraw: DrawResult | null;
  streamHistory: DrawResult[];
  tickets: Ticket[];
  balance: number;
  jackpotPool: number;
}

export function GameProvider({
  children,
  demoPreset = false,
}: {
  children: ReactNode;
  demoPreset?: boolean;
}) {
  const [game] = useState(() => new ChainsGame());

  const demoPresetAppliedRef = useRef(false);
  useLayoutEffect(() => {
    if (!demoPreset || demoPresetAppliedRef.current) return;
    demoPresetAppliedRef.current = true;
    applyDemoJackpotPreset(game);
  }, [demoPreset, game]);

  const [gameState, setGameState] = useState<GameState>(() => game.getState());
  const [simulatedActivity, setSimulatedActivity] = useState<SimulatedActivity>(() => game.getSimulatedActivity());
  const [forcedQueue, setForcedQueue] = useState<number[]>(() => game.peekForcedDraws());
  const [timeRemaining, setTimeRemaining] = useState<number>(() => game.getState().timeRemainingMs);
  const [jackpotCelebration, setJackpotCelebration] = useState<{ ticketId: string; amount: number } | null>(null);

  // Ticket ids whose LOST transition is held visible briefly (red-X flash)
  // before dropping into history. Pure display delay.
  const [flashingFailedIds, setFlashingFailedIds] = useState<Set<string>>(new Set());
  const failedFlashTimeoutsRef = useRef<Map<string, number>>(new Map());

  const [payoutFlash, setPayoutFlash] = useState<{ amount: number; key: number } | null>(null);
  const payoutFlashTimeoutRef = useRef<number | null>(null);

  const [revealedDraw, setRevealedDraw] = useState<RevealedState>(() => {
    const initial = game.getState();
    return {
      currentDraw: initial.currentDraw,
      streamHistory: initial.streamHistory,
      tickets: initial.tickets,
      balance: initial.balance,
      jackpotPool: initial.jackpotPool,
    };
  });

  const lastSeenDrawIndexRef = useRef<number>(revealedDraw.currentDraw?.drawIndex ?? 0);
  const revealTimeoutRef = useRef<number | null>(null);
  // Set synchronously around instantStep()/reset so the (stable) subscribe
  // closure can read it at the exact moment the engine's sync emit fires.
  const skipNextRevealDelayRef = useRef(false);
  // Last status / hits seen per ticket id: fires each sound exactly once per
  // genuine transition.
  const prevTicketStatusRef = useRef<Map<string, TicketStatus>>(new Map());
  const prevTicketHitsRef = useRef<Map<string, number>>(new Map());
  // Pending "play the outcome sounds for this draw" closure; only invoked
  // from commitPublicReveal().
  const applyTicketSoundsRef = useRef<(() => void) | null>(null);

  const [wheelTargetDraw, setWheelTargetDraw] = useState<DrawResult | null>(() => game.getState().currentDraw);
  const pendingPublicRevealRef = useRef<RevealedState | null>(null);
  const publicRevealFallbackTimeoutRef = useRef<number | null>(null);

  const commitPublicReveal = useCallback(() => {
    if (publicRevealFallbackTimeoutRef.current !== null) {
      window.clearTimeout(publicRevealFallbackTimeoutRef.current);
      publicRevealFallbackTimeoutRef.current = null;
    }
    if (pendingPublicRevealRef.current === null) return;
    setRevealedDraw(pendingPublicRevealRef.current);
    pendingPublicRevealRef.current = null;
    if (applyTicketSoundsRef.current) {
      const fn = applyTicketSoundsRef.current;
      applyTicketSoundsRef.current = null;
      fn();
    }
  }, []);

  const reportWheelLanded = useCallback(() => {
    commitPublicReveal();
  }, [commitPublicReveal]);

  useEffect(() => {
        // Keeps a just-settled link visible briefly before it drops into history.
    // (State/ref names say "Failed" for historical reasons; kept to keep the
    // diff small. They now cover WON links too.)
    const flashSettled = (id: string, ms: number) => {
      setFlashingFailedIds((prev) => new Set(prev).add(id));
      const existing = failedFlashTimeoutsRef.current.get(id);
      if (existing !== undefined) window.clearTimeout(existing);
      const timeoutId = window.setTimeout(() => {
        setFlashingFailedIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        failedFlashTimeoutsRef.current.delete(id);
      }, ms);
      failedFlashTimeoutsRef.current.set(id, timeoutId);
    };
    const unsubscribe = game.subscribe((nextState) => {
      setGameState(nextState);
      setSimulatedActivity(game.getSimulatedActivity());
      setForcedQueue(game.peekForcedDraws());
      setTimeRemaining(nextState.timeRemainingMs);

      // Plays the right sound for any link whose status or hit count just
      // changed, at most once per transition.
      const applyTicketSounds = (tickets: Ticket[]) => {
        let prizeTotal = 0;
        let jackpotTotal = 0;
        let jackpotTicketId: string | null = null;

        for (const ticket of tickets) {
          const previousStatus = prevTicketStatusRef.current.get(ticket.id);
          const previousHits = prevTicketHitsRef.current.get(ticket.id);
          const statusChanged = previousStatus !== ticket.status;
          const hitsAdvanced = previousHits !== undefined && ticket.hits > previousHits;

          prevTicketStatusRef.current.set(ticket.id, ticket.status);
          prevTicketHitsRef.current.set(ticket.id, ticket.hits);

          if (statusChanged) {
            if (ticket.status === 'JACKPOT_WON') {
              jackpotTotal += ticket.jackpotWinAmount ?? 0;
              jackpotTicketId = ticket.id;
              continue;
            }
            if (ticket.status === 'WON') {
              prizeTotal += ticket.prizeAmount ?? 0;
              flashSettled(ticket.id, 2000);
              continue;
            }
            if (ticket.status === 'LOST') {
              flashSettled(ticket.id, 500);
              continue;
            }
          }
          // A digit matched but the link isn't settled yet.
          if (hitsAdvanced) playStepMatch();
        }

        // One celebration + one fanfare per draw, even if several links won
        // the jackpot together (amounts are combined).
        if (jackpotTicketId !== null) {
          playJackpotFanfare();
          setJackpotCelebration({ ticketId: jackpotTicketId, amount: jackpotTotal });
        }
        if (prizeTotal > 0) {
          playBaseWin();
          setPayoutFlash({ amount: prizeTotal, key: Date.now() });
          if (payoutFlashTimeoutRef.current !== null) window.clearTimeout(payoutFlashTimeoutRef.current);
          payoutFlashTimeoutRef.current = window.setTimeout(() => setPayoutFlash(null), 4500);
        }
      };

      const incomingDrawIndex = nextState.currentDraw?.drawIndex ?? 0;
      if (incomingDrawIndex === lastSeenDrawIndexRef.current) {
        // Not a new draw (bet placed, demo action...). Keep the link list in
        // sync right away; balance/pool only if no reveal is in flight.
        const revealInFlight = revealTimeoutRef.current !== null || pendingPublicRevealRef.current !== null;
        setRevealedDraw((prev) => ({
          ...prev,
          tickets: nextState.tickets,
          ...(revealInFlight ? {} : { balance: nextState.balance, jackpotPool: nextState.jackpotPool }),
        }));
        applyTicketSounds(nextState.tickets);
        return;
      }
      lastSeenDrawIndexRef.current = incomingDrawIndex;

      if (revealTimeoutRef.current !== null) {
        window.clearTimeout(revealTimeoutRef.current);
        revealTimeoutRef.current = null;
      }

      const reveal = () => {
        revealTimeoutRef.current = null;
        // Stage 1: tell the Wheel what to land on.
        setWheelTargetDraw(nextState.currentDraw);

        // Queue sounds; they play only from commitPublicReveal().
        applyTicketSoundsRef.current = () => applyTicketSounds(nextState.tickets);

        // Stage 2: queue the public reveal until the wheel has landed.
        pendingPublicRevealRef.current = {
          currentDraw: nextState.currentDraw,
          streamHistory: nextState.streamHistory,
          tickets: nextState.tickets,
          balance: nextState.balance,
          jackpotPool: nextState.jackpotPool,
        };
        if (publicRevealFallbackTimeoutRef.current !== null) {
          window.clearTimeout(publicRevealFallbackTimeoutRef.current);
        }
        publicRevealFallbackTimeoutRef.current = window.setTimeout(commitPublicReveal, PUBLIC_REVEAL_FALLBACK_MS);
      };

      if (skipNextRevealDelayRef.current) {
        reveal();
      } else {
        const delayMs =
          Math.max(
            MIN_REVEAL_DELAY_MS,
            nextState.config.drawAnimationDurationMs - WHEEL_MAX_LANDING_MS - 200,
          ) / nextState.speedMultiplier;
        revealTimeoutRef.current = window.setTimeout(reveal, delayMs);
      }
    });
    game.start();
    return () => {
      unsubscribe();
      game.destroy();
      if (revealTimeoutRef.current !== null) {
        window.clearTimeout(revealTimeoutRef.current);
        revealTimeoutRef.current = null;
      }
      if (publicRevealFallbackTimeoutRef.current !== null) {
        window.clearTimeout(publicRevealFallbackTimeoutRef.current);
        publicRevealFallbackTimeoutRef.current = null;
      }
    };
  }, [game, commitPublicReveal]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setTimeRemaining(game.getState().timeRemainingMs);
    }, TIME_TICK_MS);
    return () => window.clearInterval(interval);
  }, [game]);

  const bettingLocked = gameState.phase !== 'BETTING_OPEN';

  const placeBet = useCallback((request: BetRequest) => game.placeBet(request), [game]);
  const forceNextDraw = useCallback((digit: number) => game.forceNextDraw(digit), [game]);
  const forceDrawSequence = useCallback((digits: number[]) => game.forceDrawSequence(digits), [game]);
  const clearForcedDraws = useCallback(() => game.clearForcedDraws(), [game]);

  const instantStep = useCallback(() => {
    // The whole call chain (advancePhase -> enterPhase -> processDraw ->
    // emit) is synchronous, so the subscribe callback sees the flag at the
    // right moment and it is safe to flip back immediately.
    skipNextRevealDelayRef.current = true;
    game.instantStep();
    skipNextRevealDelayRef.current = false;
  }, [game]);

  const setSpeed = useCallback((multiplier: number) => game.setSpeedMultiplier(multiplier), [game]);
  const pauseGame = useCallback(() => game.pause(), [game]);
  const resumeGame = useCallback(() => game.resume(), [game]);
  const resetGame = useCallback(() => {
    skipNextRevealDelayRef.current = true;
    game.reset();
    if (demoPreset) applyDemoJackpotPreset(game); // demo only
    skipNextRevealDelayRef.current = false;
    commitPublicReveal();
    // The committed payload predates the demo preset; resync balance/pool.
    setRevealedDraw((prev) => ({ ...prev, balance: game.getBalance(), jackpotPool: game.getJackpotPool() }));
    prevTicketStatusRef.current.clear();
    prevTicketHitsRef.current.clear();
    setJackpotCelebration(null);
    failedFlashTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
    failedFlashTimeoutsRef.current.clear();
    setFlashingFailedIds(new Set());
    setPayoutFlash(null);
  }, [game, commitPublicReveal, demoPreset]);

  const dismissJackpotCelebration = useCallback(() => setJackpotCelebration(null), []);
  const resetBalance = useCallback(() => game.resetBalance(), [game]);
  const simulateJackpotWin = useCallback(() => {
    game.simulateJackpotWin();
  }, [game]);
  const createSimulatedTicket = useCallback(() => {
    game.createSimulatedTicket();
  }, [game]);

  const value = useMemo<UseGameValue>(
    () => ({
      gameState,
      activeTickets: revealedDraw.tickets.filter((t) => !isTerminal(t.status) || flashingFailedIds.has(t.id)),
      history: revealedDraw.tickets.filter((t) => isTerminal(t.status) && !flashingFailedIds.has(t.id)),
      balance: revealedDraw.balance,
      jackpotPool: revealedDraw.jackpotPool,
      bettingLocked,
      payoutFlash,
      currentDraw: revealedDraw.currentDraw,
      streamHistory: revealedDraw.streamHistory,
      wheelTargetDraw,
      reportWheelLanded,
      phase: gameState.phase,
      timeRemaining,
      speedMultiplier: gameState.speedMultiplier,
      isPaused: gameState.isPaused,
      isRunning: gameState.isRunning,
      config: gameState.config,
      drawIndex: gameState.drawIndex,
      simulatedActivity,
      forcedQueue,
      jackpotCelebration,
      dismissJackpotCelebration,
      placeBet,
      forceNextDraw,
      forceDrawSequence,
      clearForcedDraws,
      instantStep,
      setSpeed,
      pauseGame,
      resumeGame,
      resetGame,
      resetBalance,
      simulateJackpotWin,
      createSimulatedTicket,
    }),
    [
      gameState,
      revealedDraw,
      flashingFailedIds,
      wheelTargetDraw,
      reportWheelLanded,
      timeRemaining,
      simulatedActivity,
      forcedQueue,
      jackpotCelebration,
      dismissJackpotCelebration,
      placeBet,
      forceNextDraw,
      forceDrawSequence,
      clearForcedDraws,
      instantStep,
      setSpeed,
      pauseGame,
      resumeGame,
      resetGame,
      resetBalance,
      simulateJackpotWin,
      createSimulatedTicket,
      bettingLocked,
      payoutFlash,
    ],
  );

  // oxlint-disable-next-line react/refs -- value holds callbacks that read refs only in handlers, never in render
  return createElement(GameContext.Provider, { value }, children);
}

export function useGame(): UseGameValue {
  const ctx = useContext(GameContext);
  if (!ctx) {
    throw new Error('useGame() must be called within a <GameProvider>.');
  }
  return ctx;
}