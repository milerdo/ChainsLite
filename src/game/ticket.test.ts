import { describe, it, expect } from 'vitest';
import { activateDueTickets, createTicket, evaluateTicketOnDraw } from './ticket';
import type { Ticket } from './types';

const mk = (digits: number[], stake?: number) =>
  createTicket({ digits, startDrawIndex: 1, createdAtDrawIndex: 0, stake });

function run(t: Ticket, draws: number[]): Ticket {
  let cur = t;
  let idx = t.nextDrawIndex;
  for (const digit of draws) cur = evaluateTicketOnDraw(cur, { drawIndex: idx++, digit });
  return cur;
}

describe('position-by-position matching', () => {
  it('a miss does NOT end the link: all 3 draws play', () => {
    const afterMiss = run(mk([1, 2, 3]), [9]);
    expect(afterMiss.status).toBe('ACTIVE');
    expect(afterMiss.hits).toBe(0);
    const t = run(afterMiss, [2, 3]);
    expect(t.status).toBe('WON');
    expect(t.hits).toBe(2);
  });

  it('draw k is checked only against digit k', () => {
    // [1,2,3] vs draws 2,1,3: digits exist but in wrong positions; only pos 3 hits.
    const t = run(mk([1, 2, 3]), [2, 1, 3]);
    expect(t.hits).toBe(1);
    expect(t.status).toBe('WON');
  });

  it('0 hits loses, settling only on the 3rd draw', () => {
    const mid = run(mk([1, 2, 3]), [9, 9]);
    expect(mid.status).toBe('ACTIVE');
    expect(mid.settledAtDrawIndex).toBeNull();
    const t = run(mid, [9]);
    expect(t.status).toBe('LOST');
    expect(t.totalReturn).toBe(0);
    expect(t.prizeAmount).toBeNull();
  });
});

describe('prizes by hit count', () => {
  it.each([
    [[1, 9, 9]],
    [[9, 2, 9]],
    [[9, 9, 3]],
  ])('1 hit pays 1.5x (draws %j)', (draws) => {
    const t = run(mk([1, 2, 3]), draws);
    expect(t.status).toBe('WON');
    expect(t.hits).toBe(1);
    expect(t.prizeAmount).toBe(1.5);
    expect(t.totalReturn).toBe(1.5);
  });

  it.each([
    [[1, 2, 9]],
    [[1, 9, 3]],
    [[9, 2, 3]],
  ])('2 hits pay 10x in any positions (draws %j)', (draws) => {
    const t = run(mk([1, 2, 3]), draws);
    expect(t.status).toBe('WON');
    expect(t.hits).toBe(2);
    expect(t.prizeAmount).toBe(10);
    expect(t.totalReturn).toBe(10);
  });

  it('3 hits is JACKPOT_WON, with no 1.5x/10x prize (engine pays the pool)', () => {
    const t = run(mk([4, 2, 3]), [4, 2, 3]);
    expect(t.status).toBe('JACKPOT_WON');
    expect(t.hits).toBe(3);
    expect(t.prizeAmount).toBeNull();
    expect(t.jackpotWinAmount).toBeNull();
    expect(t.totalReturn).toBe(0);
  });

  it('scales the prize with stake', () => {
    expect(run(mk([1, 2, 3], 2), [1, 9, 9]).prizeAmount).toBe(3);
  });
});

describe('repeated digits', () => {
  it('7-7-7 is valid and wins the jackpot on 7,7,7', () => {
    expect(run(mk([7, 7, 7]), [7, 7, 7]).status).toBe('JACKPOT_WON');
  });
  it('7-7-7 with draws 7,7,1 is 2 hits', () => {
    const t = run(mk([7, 7, 7]), [7, 7, 1]);
    expect(t.hits).toBe(2);
    expect(t.prizeAmount).toBe(10);
  });
});

describe('timeline rules', () => {
  it('settles on draw startDrawIndex + 2', () => {
    const t = run(mk([1, 2, 3]), [1, 2, 3]);
    expect(t.settledAtDrawIndex).toBe(3);
    expect(t.drawLog).toHaveLength(3);
  });

  it("ignores draws that are not the link's next index", () => {
    const t = mk([5, 5, 5]);
    expect(evaluateTicketOnDraw(t, { drawIndex: 5, digit: 5 })).toBe(t);
  });

  it('never changes a terminal link', () => {
    const lost = run(mk([5, 5, 5]), [1, 1, 1]);
    expect(evaluateTicketOnDraw(lost, { drawIndex: 4, digit: 5 })).toBe(lost);
  });

  it('overlapping links offset by one draw stay independent', () => {
    const a = mk([1, 2, 3]); // draws 1,2,3
    const b = createTicket({ digits: [2, 3, 4], startDrawIndex: 2, createdAtDrawIndex: 1 });
    const stream = [1, 2, 3, 4];
    let ta: Ticket = a;
    let tb: Ticket = b;
    stream.forEach((digit, i) => {
      const draw = { drawIndex: i + 1, digit };
      ta = evaluateTicketOnDraw(ta, draw);
      tb = evaluateTicketOnDraw(tb, draw);
    });
    expect(ta.status).toBe('JACKPOT_WON');
    expect(ta.settledAtDrawIndex).toBe(3);
    expect(tb.status).toBe('JACKPOT_WON');
    expect(tb.settledAtDrawIndex).toBe(4);
  });

  it('activates WAITING links only once their start draw is reached', () => {
    const t = mk([5, 5, 5]);
    expect(activateDueTickets([t], 0)[0].status).toBe('WAITING');
    expect(activateDueTickets([t], 1)[0].status).toBe('ACTIVE');
  });
});

describe('validation', () => {
  it('rejects wrong length and out-of-range / non-integer digits', () => {
    expect(() => mk([1, 2])).toThrow();
    expect(() => mk([1, 2, 3, 4])).toThrow();
    expect(() => mk([1, 2, 10])).toThrow();
    expect(() => mk([1, -1, 3])).toThrow();
    expect(() => mk([1, 2, 1.5])).toThrow();
  });
});