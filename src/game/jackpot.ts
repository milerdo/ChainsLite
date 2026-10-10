// ============================================================================
// CHAINS LITE — Progressive Jackpot Manager (single pool)
// Live balance, funding, payout with equal split, and reset to seed.
// Money identity: paid + pool = seed + contributed + seed x payoutEvents
// (the seed is operator-funded and re-added after every payout).
// ============================================================================

import { INITIAL_JACKPOT_POOL, JACKPOT_CONTRIBUTION_RATE } from './constants';
import { roundCurrency, roundPrecise, splitJackpotShares } from './payouts';

export interface JackpotWinRecord {
  ticketId: string;
  amountWon: number;
  drawIndex: number;
  splitAmong: number;
}

export interface JackpotPayoutResult {
  /** Amount for each winner, same order as winnerTicketIds. Sums to the pool. */
  shares: number[];
  totalPaid: number;
  winnerTicketIds: string[];
}

export class JackpotManager {
  private pool: number;
  private readonly seed: number;
  private winHistory: JackpotWinRecord[] = [];

  constructor(seed: number = INITIAL_JACKPOT_POOL) {
    this.seed = seed;
    this.pool = seed;
  }

  getPool(): number {
    return this.pool;
  }

  /** Adds the contribution (rate x stake) to the pool; returns the amount. */
  contribute(stake: number): number {
    const contribution = roundPrecise(JACKPOT_CONTRIBUTION_RATE * stake);
    this.pool = roundPrecise(this.pool + contribution);
    return contribution;
  }

  /** Pays the whole pool, split equally across the winning links, then
   * resets the pool to its seed. */
  payout(winnerTicketIds: string[], drawIndex: number): JackpotPayoutResult {
    if (winnerTicketIds.length === 0) {
      return { shares: [], totalPaid: 0, winnerTicketIds: [] };
    }

    const shares = splitJackpotShares(this.pool, winnerTicketIds.length);
    winnerTicketIds.forEach((ticketId, i) => {
      this.winHistory.push({
        ticketId,
        amountWon: shares[i],
        drawIndex,
        splitAmong: winnerTicketIds.length,
      });
    });

    this.pool = this.seed;

    return {
      shares,
      totalPaid: roundCurrency(shares.reduce((sum, s) => sum + s, 0)),
      winnerTicketIds: [...winnerTicketIds],
    };
  }

  getWinHistory(): JackpotWinRecord[] {
    return [...this.winHistory];
  }

  forceSetPool(amount: number): void {
    this.pool = roundCurrency(amount);
  }

  /** Back to the seed value; clears win history. */
  reset(): void {
    this.pool = this.seed;
    this.winHistory = [];
  }
}