// ============================================================================
// CHAINS LITE — Headless Game Engine
//
// ChainsGame owns ALL game math and state. Zero React / DOM dependencies:
//
//   const game = new ChainsGame();
//   game.placeBet({ links: [[4, 2, 3]] });
//   game.processDraw(4); game.processDraw(2); game.processDraw(3);
//   const state = game.getState();
//
// UI code only calls public methods and renders getState() / subscribe().
// ============================================================================

import type {
  BetRequest,
  DrawResult,
  GameConfig,
  GamePhase,
  GameState,
  PlaceBetResult,
  SimulatedActivity,
  SimulatedActivityEvent,
  Ticket,
} from './types';
import {
  DEFAULT_GAME_CONFIG,
  INITIAL_JACKPOT_POOL,
  LINK_LENGTH,
  MAX_LINKS_PER_ROUND,
  MAX_SIMULATED_EVENTS,
  MAX_STREAM_HISTORY,
  MAX_TICKET_HISTORY,
} from './constants';
import { JackpotManager } from './jackpot';
import { formatMoney as money } from './money';
import { RNG } from './rng';
import { calculateTotalStake, roundCurrency } from './payouts';
import {
  activateDueTickets,
  createTicket,
  evaluateTicketOnDraw,
  isTerminal,
  validateLinkDigits,
} from './ticket';

type Listener = (state: GameState) => void;

interface PlaceBetOptions {
  /** Demo helper links bypass the BETTING_OPEN requirement and the
   * per-round link cap. Real player bets never set this. */
  bypassPhaseCheck?: boolean;
}

const SIMULATED_PLAYER_LABEL_POOL_SIZE = 9000;
export class ChainsGame {
  // --- configuration -------------------------------------------------------
  private config: GameConfig;
  private rng: RNG;
  private jackpotManager: JackpotManager;

  // --- core game state -----------------------------------------------------
  private drawIndex = 0;
  private streamHistory: DrawResult[] = [];
  private currentDraw: DrawResult | null = null;
  private tickets: Ticket[] = [];
  private balance: number;

  // --- phase / scheduler state ---------------------------------------------
  private phase: GamePhase = 'BETTING_OPEN';
  private phaseDurationMs: number;
  private phaseRemainingMs: number;
  private phaseStartTime: number = Date.now();
  private isRunning = false;
  private isPaused = false;
  private speedMultiplier = 1;
  private scheduleTimeout: ReturnType<typeof setTimeout> | null = null;

  // --- simulated "other players" activity (cosmetic only) ------------------
  private simulatedActivity: SimulatedActivity = {
    playerCount: 0,
    recentEvents: [],
    digitPopularity: Array(10).fill(10),
  };

  private listeners: Set<Listener> = new Set();

  constructor(
    configOverrides: Partial<GameConfig> = {},
    rng: RNG = new RNG(),
    seedJackpotPool: number = INITIAL_JACKPOT_POOL,
  ) {
    this.config = { ...DEFAULT_GAME_CONFIG, ...configOverrides };
    this.rng = rng;
    this.jackpotManager = new JackpotManager(seedJackpotPool);
    this.balance = this.config.startingBalance;
    this.phaseDurationMs = this.config.bettingDurationMs;
    this.phaseRemainingMs = this.phaseDurationMs;
    this.simulatedActivity = this.generateSimulatedActivity();
  }

  // ==========================================================================
  // Public: state access
  // ==========================================================================

  getState(): GameState {
    return {
      phase: this.phase,
      drawIndex: this.drawIndex,
      currentDraw: this.currentDraw,
      streamHistory: [...this.streamHistory],
      tickets: this.tickets.map((t) => ({
        ...t,
        digits: [...t.digits],
        drawLog: [...t.drawLog],
      })),
      balance: this.balance,
      jackpotPool: this.jackpotManager.getPool(),
      phaseStartedAt: this.phaseStartTime,
      phaseEndsAt: this.phaseStartTime + this.phaseRemainingMs / this.speedMultiplier,
      timeRemainingMs: this.getTimeRemainingMs(),
      speedMultiplier: this.speedMultiplier,
      isPaused: this.isPaused,
      isRunning: this.isRunning,
      config: { ...this.config },
    };
  }

  getActiveTickets(): Ticket[] {
    return this.tickets.filter((t) => !isTerminal(t.status));
  }

  getTicketHistory(): Ticket[] {
    return this.tickets.filter((t) => isTerminal(t.status));
  }

  getStreamHistory(): DrawResult[] {
    return [...this.streamHistory];
  }

  getJackpotPool(): number {
    return this.jackpotManager.getPool();
  }

  getBalance(): number {
    return this.balance;
  }

  getPhase(): GamePhase {
    return this.phase;
  }

  getDrawIndex(): number {
    return this.drawIndex;
  }

  getConfig(): GameConfig {
    return { ...this.config };
  }

  getSimulatedActivity(): SimulatedActivity {
    return {
      playerCount: this.simulatedActivity.playerCount,
      recentEvents: [...this.simulatedActivity.recentEvents],
      digitPopularity: [...this.simulatedActivity.digitPopularity],
    };
  }

  /** Subscribes to state changes; fires immediately. Returns unsubscribe. */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  // ==========================================================================
  // Public: betting
  // ==========================================================================

  /** Places one or more links during BETTING_OPEN. All-or-nothing: if any link
   * is invalid, the per-round cap would be exceeded, or the balance can't
   * cover the total stake, nothing is created and nothing is debited. On
   * success the stake is debited and each link funds the jackpot pool. */
  placeBet(request: BetRequest): PlaceBetResult {
    return this.placeBetInternal(request, {});
  }

  // ==========================================================================
  // Public: draw processing (core engine tick)
  // ==========================================================================

  /** Resolves exactly one global draw and advances every live link by one
   * step. Links settling on this draw are paid here. */
  processDraw(forcedDigit?: number): DrawResult {
    this.drawIndex += 1;

    let digit: number;
    if (forcedDigit !== undefined) {
      if (!Number.isInteger(forcedDigit) || forcedDigit < 0 || forcedDigit > 9) {
        throw new Error(`forcedDigit must be an integer 0-9, received ${forcedDigit}.`);
      }
      digit = forcedDigit;
    } else {
      digit = this.rng.generateDigit();
    }

    const draw: DrawResult = { drawIndex: this.drawIndex, digit };

    this.streamHistory.push(draw);
    if (this.streamHistory.length > MAX_STREAM_HISTORY) {
      this.streamHistory.shift();
    }

    this.tickets = activateDueTickets(this.tickets, this.drawIndex);
    this.tickets = this.tickets.map((ticket) => evaluateTicketOnDraw(ticket, draw));

    // Settlement for links whose 3rd draw was this one.
    const jackpotWinners: Ticket[] = [];
    for (const ticket of this.tickets) {
      if (ticket.settledAtDrawIndex !== draw.drawIndex) continue;
      if (ticket.status === 'WON' && ticket.prizeAmount !== null) {
        this.balance = roundCurrency(this.balance + ticket.prizeAmount);
      } else if (ticket.status === 'JACKPOT_WON' && ticket.jackpotWinAmount === null) {
        jackpotWinners.push(ticket);
      }
    }

    // One payout for the whole pool, split equally across the winning links,
    // then the pool resets to its seed. Jackpot replaces the 1.5x/10x prize.
    if (jackpotWinners.length > 0) {
      const payout = this.jackpotManager.payout(
        jackpotWinners.map((w) => w.id),
        draw.drawIndex,
      );
      jackpotWinners.forEach((winner, i) => {
        const idx = this.tickets.findIndex((t) => t.id === winner.id);
        if (idx === -1) return;
        const share = payout.shares[i];
        const current = this.tickets[idx];
        this.tickets[idx] = {
          ...current,
          jackpotWinAmount: share,
          totalReturn: roundCurrency(current.totalReturn + share),
        };
        this.balance = roundCurrency(this.balance + share);
      });
    }

    this.pruneTicketHistory();
    this.simulatedActivity = this.generateSimulatedActivity(draw);
    this.currentDraw = draw;
    this.emit();
    return draw;
  }

  // ==========================================================================
  // Public: game loop scheduler (live/timed play)
  // ==========================================================================

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.isPaused = false;
    this.enterPhase('BETTING_OPEN', this.config.bettingDurationMs);
  }

  stop(): void {
    this.isRunning = false;
    this.isPaused = false;
    this.clearTimer();
    this.emit();
  }

  pause(): void {
    if (!this.isRunning || this.isPaused) return;
    this.isPaused = true;
    const elapsedReal = Date.now() - this.phaseStartTime;
    this.phaseRemainingMs = Math.max(0, this.phaseRemainingMs - elapsedReal * this.speedMultiplier);
    this.clearTimer();
    this.emit();
  }

  resume(): void {
    if (!this.isRunning || !this.isPaused) return;
    this.isPaused = false;
    this.phaseStartTime = Date.now();
    this.armTimer();
    this.emit();
  }

  setSpeedMultiplier(multiplier: number): void {
    if (!Number.isFinite(multiplier) || multiplier <= 0) {
      throw new Error('Speed multiplier must be a positive number.');
    }
    if (this.isRunning && !this.isPaused) {
      const elapsedReal = Date.now() - this.phaseStartTime;
      this.phaseRemainingMs = Math.max(0, this.phaseRemainingMs - elapsedReal * this.speedMultiplier);
      this.phaseStartTime = Date.now();
    }
    this.speedMultiplier = multiplier;
    this.armTimer();
    this.emit();
  }

  /** Skips whatever remains of the current phase. */
  instantStep(): void {
    this.clearTimer();
    this.phaseRemainingMs = 0;
    this.advancePhase();
  }

  isGameRunning(): boolean {
    return this.isRunning;
  }

  isGamePaused(): boolean {
    return this.isPaused;
  }

  getSpeedMultiplier(): number {
    return this.speedMultiplier;
  }

  // ==========================================================================
  // Public: demo / developer controls
  // ==========================================================================

  forceNextDraw(digit: number): void {
    this.rng.forceNext(digit);
    this.emit();
  }

  forceDrawSequence(digits: number[]): void {
    this.rng.forceSequence(digits);
    this.emit();
  }

  clearForcedDraws(): void {
    this.rng.clearForced();
    this.emit();
  }

  peekForcedDraws(): number[] {
    return this.rng.peekForcedQueue();
  }

  /** Demo helper: creates a link at any moment (ignores phase and the
   * per-round cap). Digits default to random aux digits. */
  createSimulatedTicket(digits?: number[]): PlaceBetResult {
    const resolved = digits ?? this.randomDigits(LINK_LENGTH);
    return this.placeBetInternal({ links: [resolved] }, { bypassPhaseCheck: true });
  }

  /** Demo helper: fabricates and instantly resolves a jackpot-winning link,
   * paying the live pool with the standard reset. Consumes no stream draws. */
  simulateJackpotWin(): Ticket {
    let ticket = createTicket({
      digits: this.randomDigits(LINK_LENGTH),
      startDrawIndex: this.drawIndex,
      createdAtDrawIndex: this.drawIndex,
      stake: this.config.ticketStake,
    });

    const payout = this.jackpotManager.payout([ticket.id], this.drawIndex);
    const share = payout.shares[0];

    ticket = {
      ...ticket,
      status: 'JACKPOT_WON',
      hits: LINK_LENGTH,
      settledAtDrawIndex: this.drawIndex,
      jackpotWinAmount: share,
      totalReturn: share,
    };

    this.balance = roundCurrency(this.balance + share);
    this.tickets.push(ticket);
    this.pruneTicketHistory();
    this.emit();
    return ticket;
  }

  forceJackpotPool(amount: number): void {
    this.jackpotManager.forceSetPool(amount);
    this.emit();
  }

  /** Full reset: balance, links, stream, pool and phase. */
  reset(): void {
    this.clearTimer();
    this.isRunning = false;
    this.isPaused = false;
    this.speedMultiplier = 1;

    this.drawIndex = 0;
    this.streamHistory = [];
    this.currentDraw = null;
    this.tickets = [];
    this.balance = this.config.startingBalance;

    this.jackpotManager.reset();
    this.rng.reset();

    this.phase = 'BETTING_OPEN';
    this.phaseDurationMs = this.config.bettingDurationMs;
    this.phaseRemainingMs = this.phaseDurationMs;
    this.phaseStartTime = Date.now();

    this.simulatedActivity = this.generateSimulatedActivity();
    this.simulatedActivity = { ...this.simulatedActivity, digitPopularity: this.regenerateDigitPopularity() };
    this.emit();
  }

  resetBalance(): void {
    this.balance = this.config.startingBalance;
    this.emit();
  }

  /** Cleans up timers and subscribers. Resets isRunning/isPaused so a later
   * start() on the same instance re-arms the loop (React StrictMode mounts,
   * unmounts and mounts again in dev, firing destroy() before the real
   * start()). */
  destroy(): void {
    this.clearTimer();
    this.isRunning = false;
    this.isPaused = false;
    this.listeners.clear();
  }

  // ==========================================================================
  // Private: betting internals
  // ==========================================================================

  private placeBetInternal(request: BetRequest, options: PlaceBetOptions): PlaceBetResult {
    if (!options.bypassPhaseCheck && this.phase !== 'BETTING_OPEN') {
      return this.betFailure('Betting is currently closed for this round.');
    }

    if (!request || !Array.isArray(request.links) || request.links.length === 0) {
      return this.betFailure(`Pick ${LINK_LENGTH} digits before placing a bet.`);
    }

    try {
      request.links.forEach((digits) => validateLinkDigits(digits));
    } catch (error) {
      return this.betFailure(error instanceof Error ? error.message : 'Invalid bet.');
    }

    // Per-round cap. A "round" is the span between two draws, so links created
    // in the current round are exactly those with createdAtDrawIndex equal to
    // the current drawIndex. No extra state to reset.
    if (!options.bypassPhaseCheck) {
      const alreadyThisRound = this.tickets.filter((t) => t.createdAtDrawIndex === this.drawIndex).length;
      if (alreadyThisRound + request.links.length > MAX_LINKS_PER_ROUND) {
        return this.betFailure(
          `Maximum of ${MAX_LINKS_PER_ROUND} links per round`,
        );
      }
    }

    const totalStake = calculateTotalStake(request.links.length, this.config.ticketStake);
    if (this.balance < totalStake) {
      return this.betFailure(`Insufficient balance. Need ${money(totalStake)}, have ${money(this.balance)}.`);
    }

    const startDrawIndex = this.drawIndex + 1;
    const newTickets: Ticket[] = request.links.map((digits) =>
      createTicket({
        digits,
        startDrawIndex,
        createdAtDrawIndex: this.drawIndex,
        stake: this.config.ticketStake,
      }),
    );

    // One contribution per link, at bet confirmation.
    for (let i = 0; i < newTickets.length; i += 1) {
      this.jackpotManager.contribute(this.config.ticketStake);
    }

    this.balance = roundCurrency(this.balance - totalStake);
    this.tickets.push(...newTickets);
    this.emit();

    return {
      success: true,
      message:
        newTickets.length === 1
          ? `${money(totalStake)} BET ACCEPTED`
          : `${newTickets.length} links placed, total stake ${money(totalStake)}.`,
      ticketIds: newTickets.map((t) => t.id),
      totalStake,
    };
  }

  private betFailure(message: string): PlaceBetResult {
    return { success: false, message, ticketIds: [], totalStake: 0 };
  }

  // ==========================================================================
  // Private: phase scheduler internals
  // ==========================================================================

  private enterPhase(phase: GamePhase, durationMs: number): void {
    this.phase = phase;
    this.phaseDurationMs = durationMs;
    this.phaseRemainingMs = durationMs;
    this.phaseStartTime = Date.now();

    if (phase === 'BETTING_OPEN') {
      // Cosmetic: one low-variance digit-popularity bias per round.
      this.simulatedActivity = { ...this.simulatedActivity, digitPopularity: this.regenerateDigitPopularity() };
    }

    if (phase === 'DRAWING') {
      // processDraw() already performs its own emit() at the end. Emitting
      // again would double-fire this state — useGame.ts relies on exactly ONE
      // emit per new draw to defer outcome sounds until the wheel lands.
      this.processDraw();
      this.armTimer();
      return;
    }

    this.armTimer();
    this.emit();
  }

  private advancePhase(): void {
    switch (this.phase) {
      case 'BETTING_OPEN':
        this.enterPhase('BETTING_CLOSED', this.config.bettingClosedDurationMs);
        break;
      case 'BETTING_CLOSED':
        this.enterPhase('DRAWING', this.config.drawAnimationDurationMs);
        break;
      case 'DRAWING':
        this.enterPhase('RESULT', this.config.resultDisplayDurationMs);
        break;
      case 'RESULT':
        this.enterPhase('BETTING_OPEN', this.config.bettingDurationMs);
        break;
    }
  }

  private armTimer(): void {
    this.clearTimer();
    if (!this.isRunning || this.isPaused) return;
    const scaledMs = Math.max(0, this.phaseRemainingMs / this.speedMultiplier);
    this.scheduleTimeout = setTimeout(() => this.advancePhase(), scaledMs);
  }

  private clearTimer(): void {
    if (this.scheduleTimeout !== null) {
      clearTimeout(this.scheduleTimeout);
      this.scheduleTimeout = null;
    }
  }

  private getTimeRemainingMs(): number {
    if (!this.isRunning) return 0;
    if (this.isPaused) return this.phaseRemainingMs;
    const elapsedReal = (Date.now() - this.phaseStartTime) * this.speedMultiplier;
    return Math.max(0, this.phaseRemainingMs - elapsedReal);
  }

  // ==========================================================================
  // Private: bookkeeping helpers
  // ==========================================================================

  /** Caps retained settled links; never discards a live one. Keeps array
   * order (= placement order) and drops the OLDEST settled links first, so
   * history stays chronological. */
  private pruneTicketHistory(): void {
    let excess = this.tickets.filter((t) => isTerminal(t.status)).length - MAX_TICKET_HISTORY;
    if (excess <= 0) return;
    this.tickets = this.tickets.filter((t) => {
      if (excess > 0 && isTerminal(t.status)) {
        excess -= 1;
        return false;
      }
      return true;
    });
  }

  private randomDigits(count: number): number[] {
    return Array.from({ length: count }, () => this.rng.generateAuxDigit());
  }

  /** Cosmetic "other players" activity. Never influences stream or payouts. */
  private generateSimulatedActivity(draw?: DrawResult): SimulatedActivity {
    const playerCount = 80 + Math.floor(Math.random() * 120);
    const digitPopularity = this.simulatedActivity.digitPopularity;

    const recentEvents = [...this.simulatedActivity.recentEvents];
    if (draw) {
      const eventCount = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < eventCount; i += 1) {
        const outcome: SimulatedActivityEvent['outcome'] = Math.random() < 0.27 ? 'WIN' : 'LOST';
        const playerLabel = `Player #${1000 + Math.floor(Math.random() * SIMULATED_PLAYER_LABEL_POOL_SIZE)}`;
        recentEvents.unshift({
          id: `sim-${draw.drawIndex}-${i}-${Math.random().toString(36).slice(2, 7)}`,
          playerLabel,
          outcome,
          atDrawIndex: draw.drawIndex,
        });
      }
      while (recentEvents.length > MAX_SIMULATED_EVENTS) {
        recentEvents.pop();
      }
    }

    return { playerCount, recentEvents, digitPopularity };
  }

  /** Low-variance simulated "popular digits this round" bias, regenerated once
   * per fresh BETTING_OPEN (see MultiplayerSim for the drift animation). */
  private regenerateDigitPopularity(): number[] {
    const hotCount = 1 + Math.floor(Math.random() * 2);
    const hotDigits = new Set<number>();
    while (hotDigits.size < hotCount) hotDigits.add(Math.floor(Math.random() * 10));
    const weights = Array.from({ length: 10 }, (_, i) =>
      10 + (hotDigits.has(i) ? 6 + Math.random() * 6 : Math.random() * 4 - 2),
    );
    const sum = weights.reduce((a, b) => a + b, 0);
    return weights.map((w) => Math.round((w / sum) * 100));
  }

  private emit(): void {
    const state = this.getState();
    this.listeners.forEach((listener) => listener(state));
  }
}