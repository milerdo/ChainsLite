// ============================================================================
// CHAINS LITE — Payout Calculations. Pure functions only.
// ============================================================================

import { PRIZE_MULTIPLIERS, TICKET_STAKE } from './constants';

/** Rounds to the nearest cent, avoiding float artifacts. Use for anything
 * credited/debited to the player's balance. */
export function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Rounds to 6 decimals purely to remove float dust in internal accumulators. */
export function roundPrecise(value: number, decimals = 6): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/** Total-return multiplier for 1 or 2 hits; 0 for 0 hits. 3 hits is the
 * jackpot and is NOT a multiplier prize, so it also returns 0 here. */
export function prizeMultiplierForHits(hits: number): number {
  return PRIZE_MULTIPLIERS[hits] ?? 0;
}

/** Total return (incl. stake) for a 1- or 2-hit link. */
export function calculatePrize(hits: number, stake: number = TICKET_STAKE): number {
  return roundCurrency(prizeMultiplierForHits(hits) * stake);
}

export function calculateTotalStake(linkCount: number, stakePerLink: number = TICKET_STAKE): number {
  return roundCurrency(linkCount * stakePerLink);
}

/**
 * Splits a pool equally across N simultaneous winning links, in whole cents.
 * Any remainder cents go one each to the first winners, so the shares always
 * sum to the pool exactly (no money created or lost to rounding).
 */
export function splitJackpotShares(poolAmount: number, winnerCount: number): number[] {
  if (winnerCount <= 0) return [];
  const totalCents = Math.round(poolAmount * 100);
  const base = Math.floor(totalCents / winnerCount);
  const remainder = totalCents - base * winnerCount;
  return Array.from({ length: winnerCount }, (_, i) => (base + (i < remainder ? 1 : 0)) / 100);
}