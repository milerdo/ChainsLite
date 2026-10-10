import { describe, it, expect } from 'vitest';
import { JackpotManager } from './jackpot';
import { INITIAL_JACKPOT_POOL, JACKPOT_CONTRIBUTION_RATE, JACKPOT_SEED_MULTIPLIER, TICKET_STAKE } from './constants';

describe('JackpotManager', () => {
  it('starts at the 200x seed', () => {
    expect(INITIAL_JACKPOT_POOL).toBe(JACKPOT_SEED_MULTIPLIER * TICKET_STAKE);
    expect(INITIAL_JACKPOT_POOL).toBe(200);
    expect(new JackpotManager().getPool()).toBe(200);
  });

  it('contributes the configured rate per stake', () => {
    const jm = new JackpotManager();
    expect(jm.contribute(1)).toBeCloseTo(0.12, 10);
    expect(jm.getPool()).toBeCloseTo(200.12, 6);
    jm.contribute(3);
    expect(jm.getPool()).toBeCloseTo(200 + JACKPOT_CONTRIBUTION_RATE * 4, 6);
  });

  it('pays the whole pool (seed + accumulated) to one winner and resets to seed', () => {
    const jm = new JackpotManager();
    for (let i = 0; i < 100; i += 1) jm.contribute(1);
    const res = jm.payout(['T1'], 10);
    expect(res.shares).toEqual([212]);
    expect(res.totalPaid).toBe(212);
    expect(jm.getPool()).toBe(200);
    expect(jm.getWinHistory()).toHaveLength(1);
  });

  it('splits equally between simultaneous winners', () => {
    const jm = new JackpotManager();
    jm.forceSetPool(100);
    const res = jm.payout(['A', 'B'], 1);
    expect(res.shares).toEqual([50, 50]);
    expect(res.totalPaid).toBe(100);
    expect(jm.getPool()).toBe(200);
  });

  it('distributes remainder cents so shares sum to the pool exactly', () => {
    const jm = new JackpotManager();
    jm.forceSetPool(100);
    const res = jm.payout(['A', 'B', 'C'], 1);
    expect(res.shares).toEqual([33.34, 33.33, 33.33]);
    expect(res.totalPaid).toBe(100);
  });

  it('does nothing with zero winners', () => {
    const jm = new JackpotManager();
    jm.contribute(10);
    const before = jm.getPool();
    expect(jm.payout([], 1).totalPaid).toBe(0);
    expect(jm.getPool()).toBe(before);
  });

  it('reset() returns to seed and clears history', () => {
    const jm = new JackpotManager();
    jm.contribute(5);
    jm.payout(['T'], 1);
    jm.forceSetPool(999);
    jm.reset();
    expect(jm.getPool()).toBe(200);
    expect(jm.getWinHistory()).toHaveLength(0);
  });

  it('conserves money: paid + pool = seed + contributed + seed x payouts', () => {
    const jm = new JackpotManager();
    let contributed = 0;
    let paid = 0;
    let payouts = 0;
    for (let i = 1; i <= 500; i += 1) {
      contributed += jm.contribute(1);
      if (i % 37 === 0) {
        paid += jm.payout(['T'], i).totalPaid;
        payouts += 1;
      }
    }
    expect(paid + jm.getPool()).toBeCloseTo(INITIAL_JACKPOT_POOL + contributed + INITIAL_JACKPOT_POOL * payouts, 2);
  });
});