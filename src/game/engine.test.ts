import { describe, it, expect } from 'vitest';
import { ChainsGame } from './engine';
import { INITIAL_JACKPOT_POOL, JACKPOT_CONTRIBUTION_RATE, MAX_LINKS_PER_ROUND, MAX_TICKET_HISTORY } from './constants';

/** Plays the three draws of a single already-placed link. */
function draws(game: ChainsGame, digits: number[]) {
  digits.forEach((d) => game.processDraw(d));
}

describe('history pruning', () => {
  it('keeps the newest settled links, in chronological order', () => {
    const game = new ChainsGame({ startingBalance: 1_000_000 });
    const total = MAX_TICKET_HISTORY + 5;
    const ids: string[] = [];
    for (let i = 0; i < total; i += 1) {
      ids.push(game.placeBet({ links: [[0, 0, 0]] }).ticketIds[0]);
      game.processDraw(9);
      game.processDraw(9);
      game.processDraw(9);
    }
    const history = game.getTicketHistory();
    expect(history).toHaveLength(MAX_TICKET_HISTORY);
    expect(history[history.length - 1].id).toBe(ids[total - 1]);
    expect(history[0].id).toBe(ids[total - MAX_TICKET_HISTORY]);
  });
});

describe('placing bets', () => {
  it('debits the stake, creates a WAITING link and funds the pool', () => {
    const game = new ChainsGame();
    const res = game.placeBet({ links: [[1, 2, 3]] });
    expect(res.success).toBe(true);
    expect(res.totalStake).toBe(1);
    expect(game.getBalance()).toBe(99);
    expect(game.getJackpotPool()).toBeCloseTo(INITIAL_JACKPOT_POOL + JACKPOT_CONTRIBUTION_RATE, 6);
    const [t] = game.getActiveTickets();
    expect(t.status).toBe('WAITING');
    expect(t.startDrawIndex).toBe(1);
  });

  it('places several links in one atomic request', () => {
    const game = new ChainsGame();
    const res = game.placeBet({ links: [[1, 2, 3], [4, 5, 6], [7, 8, 9]] });
    expect(res.success).toBe(true);
    expect(res.ticketIds).toHaveLength(3);
    expect(res.totalStake).toBe(3);
    expect(game.getBalance()).toBe(97);
    expect(game.getJackpotPool()).toBeCloseTo(200 + JACKPOT_CONTRIBUTION_RATE * 3, 6);
  });

  it('allows identical links (no per-sequence cap)', () => {
    const game = new ChainsGame();
    const res = game.placeBet({ links: [[5, 5, 5], [5, 5, 5], [5, 5, 5], [5, 5, 5]] });
    expect(res.success).toBe(true);
    expect(game.getActiveTickets()).toHaveLength(4);
  });

  it('rejects the whole batch on insufficient balance, changing nothing', () => {
    const game = new ChainsGame({ startingBalance: 2 });
    const res = game.placeBet({ links: [[1, 1, 1], [2, 2, 2], [3, 3, 3]] });
    expect(res.success).toBe(false);
    expect(game.getActiveTickets()).toHaveLength(0);
    expect(game.getBalance()).toBe(2);
    expect(game.getJackpotPool()).toBe(INITIAL_JACKPOT_POOL);
  });

  it('rejects the whole batch if any link is invalid', () => {
    const game = new ChainsGame();
    const res = game.placeBet({ links: [[1, 2, 3], [1, 2]] });
    expect(res.success).toBe(false);
    expect(game.getActiveTickets()).toHaveLength(0);
    expect(game.getBalance()).toBe(100);
  });

  it('rejects an empty request', () => {
    expect(new ChainsGame().placeBet({ links: [] }).success).toBe(false);
  });

  it('rejects bets outside BETTING_OPEN', () => {
    const game = new ChainsGame();
    game.instantStep(); // BETTING_CLOSED
    expect(game.placeBet({ links: [[1, 2, 3]] }).success).toBe(false);
  });
});

describe('MAX_LINKS_PER_ROUND', () => {
  const link = (i: number) => [i % 10, (i + 1) % 10, (i + 2) % 10];
  const many = (n: number) => Array.from({ length: n }, (_, i) => link(i));

  it('accepts exactly the cap in one request', () => {
    const game = new ChainsGame();
    expect(game.placeBet({ links: many(MAX_LINKS_PER_ROUND) }).success).toBe(true);
  });

  it('rejects a single request above the cap, atomically', () => {
    const game = new ChainsGame();
    expect(game.placeBet({ links: many(MAX_LINKS_PER_ROUND + 1) }).success).toBe(false);
    expect(game.getActiveTickets()).toHaveLength(0);
    expect(game.getBalance()).toBe(100);
  });

  it('counts links across several bets in the same round', () => {
    const game = new ChainsGame();
    expect(game.placeBet({ links: many(6) }).success).toBe(true);
    expect(game.placeBet({ links: many(MAX_LINKS_PER_ROUND - 6 + 1) }).success).toBe(false);
    expect(game.placeBet({ links: many(MAX_LINKS_PER_ROUND - 6) }).success).toBe(true);
  });

  it('resets once a draw has happened (new round)', () => {
    const game = new ChainsGame();
    game.placeBet({ links: many(MAX_LINKS_PER_ROUND) });
    game.processDraw(0);
    expect(game.placeBet({ links: many(MAX_LINKS_PER_ROUND) }).success).toBe(true);
  });

  it('does not apply to demo simulated links', () => {
    const game = new ChainsGame();
    game.placeBet({ links: many(MAX_LINKS_PER_ROUND) });
    expect(game.createSimulatedTicket([1, 2, 3]).success).toBe(true);
  });
});

describe('settlement', () => {
  it('credits nothing until the 3rd draw, then pays 10x for 2 hits', () => {
    const game = new ChainsGame();
    game.placeBet({ links: [[1, 2, 3]] });
    game.processDraw(1);
    game.processDraw(5); // miss, link still alive
    expect(game.getBalance()).toBe(99);
    expect(game.getActiveTickets()).toHaveLength(1);
    game.processDraw(3);
    expect(game.getBalance()).toBe(109);
    expect(game.getTicketHistory()[0].status).toBe('WON');
  });

  it('pays 1.5x for 1 hit', () => {
    const game = new ChainsGame();
    game.placeBet({ links: [[1, 2, 3]] });
    draws(game, [1, 0, 0]);
    expect(game.getBalance()).toBe(100.5);
  });

  it('pays nothing for 0 hits', () => {
    const game = new ChainsGame();
    game.placeBet({ links: [[1, 2, 3]] });
    draws(game, [0, 0, 0]);
    expect(game.getBalance()).toBe(99);
    expect(game.getTicketHistory()[0].status).toBe('LOST');
  });

  it('3 hits pay the whole pool INSTEAD of the 10x prize, then reset to seed', () => {
    const game = new ChainsGame();
    game.placeBet({ links: [[4, 4, 4]] });
    const pool = game.getJackpotPool(); // 200.12
    draws(game, [4, 4, 4]);
    expect(game.getBalance()).toBeCloseTo(99 + pool, 2);
    expect(game.getJackpotPool()).toBe(INITIAL_JACKPOT_POOL);
    const t = game.getTicketHistory()[0];
    expect(t.status).toBe('JACKPOT_WON');
    expect(t.jackpotWinAmount).toBeCloseTo(pool, 2);
    expect(t.totalReturn).toBeCloseTo(pool, 2);
  });

  it('two links hitting 3 on the same draw split the pool; seed resets once', () => {
    const game = new ChainsGame();
    game.placeBet({ links: [[7, 7, 7], [7, 7, 7]] });
    const pool = game.getJackpotPool(); // 200.24
    draws(game, [7, 7, 7]);
    const history = game.getTicketHistory();
    expect(history).toHaveLength(2);
    expect(history[0].jackpotWinAmount).toBeCloseTo(pool / 2, 2);
    expect(history[1].jackpotWinAmount).toBeCloseTo(pool / 2, 2);
    expect(game.getBalance()).toBeCloseTo(98 + pool, 2);
    expect(game.getJackpotPool()).toBe(INITIAL_JACKPOT_POOL);
  });

  it('overlapping links settle independently on their own 3rd draws', () => {
    const game = new ChainsGame();
    game.placeBet({ links: [[1, 2, 3]] }); // draws 1,2,3
    game.processDraw(1);
    game.placeBet({ links: [[2, 3, 4]] }); // draws 2,3,4
    game.processDraw(2);
    game.processDraw(3);
    expect(game.getTicketHistory()).toHaveLength(1); // first settled (jackpot)
    expect(game.getActiveTickets()).toHaveLength(1); // second still live
    game.processDraw(4);
    expect(game.getActiveTickets()).toHaveLength(0);
    const hist = game.getTicketHistory();
    expect(hist.map((t) => t.settledAtDrawIndex).sort()).toEqual([3, 4]);
  });
});

describe('demo helpers and reset', () => {
  it('simulateJackpotWin pays the pool and resets it', () => {
    const game = new ChainsGame();
    game.forceJackpotPool(500);
    const t = game.simulateJackpotWin();
    expect(t.jackpotWinAmount).toBe(500);
    expect(game.getBalance()).toBe(600);
    expect(game.getJackpotPool()).toBe(INITIAL_JACKPOT_POOL);
  });

  it('reset returns the pool to the seed', () => {
    const game = new ChainsGame();
    game.forceJackpotPool(999);
    game.reset();
    expect(game.getJackpotPool()).toBe(INITIAL_JACKPOT_POOL);
    expect(game.getBalance()).toBe(100);
  });
});

describe('RNG routing', () => {
  it('forced demo digits are not consumed by non-draw randomness', () => {
    const game = new ChainsGame();
    game.forceNextDraw(9);
    game.createSimulatedTicket(); // uses aux digits for its random digits
    game.instantStep(); // BETTING_CLOSED
    game.instantStep(); // DRAWING -> processDraw
    expect(game.getState().currentDraw?.digit).toBe(9);
  });
});