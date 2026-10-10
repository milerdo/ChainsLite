// ============================================================================
// CHAINS LITE — Configuration Constants
// All timings and economic parameters live here (ChainsLiteContext.txt §1-5).
// ============================================================================

import type { GameConfig } from './types';

// --- Currency (display only; the engine works in plain numbers) ------------
export const CURRENCY_CODE = 'EUR';
/** Locale controls separators and symbol position ("1.234,56 €"). */
export const CURRENCY_LOCALE = 'de-DE';

// --- Timings (ms) ----------------------------------------------------------
export const BETTING_DURATION = 10_000;
export const BETTING_CLOSED_DURATION = 1_000;
export const DRAW_ANIMATION_DURATION = 5_000;
export const RESULT_DISPLAY_DURATION = 1_000;

// --- Economy ---------------------------------------------------------------
export const TICKET_STAKE = 1;
export const STARTING_BALANCE = 100;

/** Digits in a link; a link lives exactly this many draws (spec §1). */
export const LINK_LENGTH = 3;

/** Total-return multiplier by number of hits (stake included). 0 hits loses;
 * 3 hits pays the progressive jackpot INSTEAD of a multiplier, so it has no
 * entry here (spec §1). */
export const PRIZE_MULTIPLIERS: Readonly<Record<number, number>> = {
  1: 1.5,
  2: 10,
};

/** Jackpot seed, as a multiple of stake (spec §3: 200x). Operator-funded. */
export const JACKPOT_SEED_MULTIPLIER = 200;
export const INITIAL_JACKPOT_POOL = JACKPOT_SEED_MULTIPLIER * TICKET_STAKE;

/** Share of every stake added to the pool when the bet is confirmed (12%). */
export const JACKPOT_CONTRIBUTION_RATE = 0.12;

/**
 * DEMO-ONLY presentation preset, applied only when the URL has ?demo.
 * 320 = steady-state average pool at win (200 + 0.12 / 0.001).
 * NOT a seed: never used by engine defaults, rtp.ts or any RTP figure.
 */
export const DEMO_JACKPOT_PRESET = 320;

/** Max links a player may hold that were created in one betting round
 * (i.e. since the last draw). Edit this one number to change the cap. */
export const MAX_LINKS_PER_ROUND = 10;

// --- Bounds on retained history -------------------------------------------
export const MAX_STREAM_HISTORY = 200;
export const MAX_TICKET_HISTORY = 200;
export const MAX_SIMULATED_EVENTS = 25;

export const DIGIT_MIN = 0;
export const DIGIT_MAX = 9;
export const DIGIT_COUNT = DIGIT_MAX - DIGIT_MIN + 1;

export const DEFAULT_GAME_CONFIG: GameConfig = {
  bettingDurationMs: BETTING_DURATION,
  bettingClosedDurationMs: BETTING_CLOSED_DURATION,
  drawAnimationDurationMs: DRAW_ANIMATION_DURATION,
  resultDisplayDurationMs: RESULT_DISPLAY_DURATION,
  startingBalance: STARTING_BALANCE,
  ticketStake: TICKET_STAKE,
};

export const RNG_DISCLAIMER =
  'CHAINS is a demonstration system using an unaudited pseudo-random number ' +
  'generator. It is NOT a certified gambling RNG and must not be used for ' +
  'real-money play.';