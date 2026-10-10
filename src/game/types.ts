// ============================================================================
// CHAINS LITE — Core Engine Type Definitions
// Pure TypeScript. No React / DOM dependencies.
// ============================================================================

export type GamePhase = 'BETTING_OPEN' | 'BETTING_CLOSED' | 'DRAWING' | 'RESULT';

/**
 * WAITING      -> created, first draw hasn't happened yet
 * ACTIVE       -> 1 or 2 of its 3 draws evaluated
 * LOST         -> settled on draw 3 with 0 hits (terminal)
 * WON          -> settled on draw 3 with 1 or 2 hits (terminal)
 * JACKPOT_WON  -> settled on draw 3 with 3 hits (terminal)
 */
export type TicketStatus = 'WAITING' | 'ACTIVE' | 'LOST' | 'WON' | 'JACKPOT_WON';

export interface DrawResult {
  drawIndex: number;
  digit: number;
}

/** One audit entry per evaluated draw. Position = index in the drawLog. */
export interface TicketDrawRecord {
  drawIndex: number;
  digit: number;
  matched: boolean;
}

export interface Ticket {
  id: string;
  /** The 3 digits; digit i is checked only against the link's i-th draw. */
  digits: number[];
  stake: number;
  status: TicketStatus;
  /** Positions matched so far (0..3). */
  hits: number;
  startDrawIndex: number;
  /** The only global draw index this ticket will react to next. */
  nextDrawIndex: number;
  createdAtDrawIndex: number;
  /** Draw index on which the link settled, or null while live. */
  settledAtDrawIndex: number | null;
  /** 1-hit / 2-hit prize (total return incl. stake). Null unless WON. */
  prizeAmount: number | null;
  /** Share of the jackpot paid to this ticket. Null unless JACKPOT_WON. */
  jackpotWinAmount: number | null;
  /** Everything credited from this ticket (prize OR jackpot share). */
  totalReturn: number;
  drawLog: TicketDrawRecord[];
}

/** One or more links, placed atomically (all or nothing). */
export interface BetRequest {
  links: number[][];
}

export interface PlaceBetResult {
  success: boolean;
  message: string;
  ticketIds: string[];
  totalStake: number;
}

export interface GameConfig {
  bettingDurationMs: number;
  bettingClosedDurationMs: number;
  drawAnimationDurationMs: number;
  resultDisplayDurationMs: number;
  startingBalance: number;
  ticketStake: number;
}

/** Cosmetic simulated "other players" (never real accounts). */
export interface SimulatedActivity {
  playerCount: number;
  recentEvents: SimulatedActivityEvent[];
  /** Simulated "% of players betting this digit", indexed 0-9. Cosmetic. */
  digitPopularity: number[];
}

export interface SimulatedActivityEvent {
  id: string;
  playerLabel: string;
  outcome: 'WIN' | 'LOST';
  atDrawIndex: number;
}

export interface GameState {
  phase: GamePhase;
  drawIndex: number;
  currentDraw: DrawResult | null;
  streamHistory: DrawResult[];
  tickets: Ticket[];
  balance: number;
  /** The single progressive pool. */
  jackpotPool: number;
  phaseStartedAt: number;
  phaseEndsAt: number;
  timeRemainingMs: number;
  speedMultiplier: number;
  isPaused: boolean;
  isRunning: boolean;
  config: GameConfig;
}