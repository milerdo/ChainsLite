import { describe, it, expect } from 'vitest';
import { RNG } from './rng';
import { ChainsGame } from './engine';
import { JackpotManager } from './jackpot';
import { createTicket, evaluateTicketOnDraw } from './ticket';
import { LINK_LENGTH, PRIZE_MULTIPLIERS, TICKET_STAKE, JACKPOT_CONTRIBUTION_RATE, JACKPOT_SEED_MULTIPLIER } from './constants';
import { hitsProbability, jackpotHitProbability, prizeRtp, totalRtp } from './rtp';

const BETS = Number(process.env.SIM_BETS ?? 2_000_000);
const ENGINE_BETS = Number(process.env.SIM_ENGINE_BETS ?? 20_000);

interface SimResult {
  prizes: number;
  jackpotPaid: number;
  jackpotHits: number;
}

/** Large run through the real ticket state machine + JackpotManager. */
async function simulate(bets: number, seed: number): Promise<SimResult> {
  const rng = new RNG(seed);
  const jackpot = new JackpotManager();
  let prizes = 0;
  let jackpotPaid = 0;
  let jackpotHits = 0;

  for (let i = 0; i < bets; i += 1) {
    // Yield periodically so Vitest's worker can report progress.
    if (i % 500_000 === 0) await new Promise((r) => setTimeout(r, 0));
    const digits = Array.from({ length: LINK_LENGTH }, () => rng.generateDigit());
    let ticket = createTicket({ digits, startDrawIndex: 1, createdAtDrawIndex: 0 });
    jackpot.contribute(TICKET_STAKE);
    let idx = 1;
    while (ticket.status === 'WAITING' || ticket.status === 'ACTIVE') {
      ticket = evaluateTicketOnDraw(ticket, { drawIndex: idx++, digit: rng.generateDigit() });
    }
    if (ticket.status === 'WON') {
      prizes += ticket.prizeAmount ?? 0;
    } else if (ticket.status === 'JACKPOT_WON') {
      jackpotPaid += jackpot.payout([ticket.id], idx - 1).totalPaid;
      jackpotHits += 1;
    }
  }
  return { prizes, jackpotPaid, jackpotHits };
}

let cached: Promise<SimResult> | null = null;
const getRun = () => (cached ??= simulate(BETS, 7));

/** Per-link variance of the 1/2-hit prize payout. */
function prizeVariance(): number {
  let second = 0;
  for (let hits = 1; hits < LINK_LENGTH; hits += 1) {
    second += hitsProbability(hits) * (PRIZE_MULTIPLIERS[hits] ?? 0) ** 2;
  }
  return second - prizeRtp() ** 2;
}

/** Approx per-link variance of the jackpot payout. Pool at win =
 * seed + rate x gap, gap ~ geometric(p). Conservative; ignores the (small,
 * negative) covariance with prizes. */
function jackpotVariance(): number {
  const p = jackpotHitProbability();
  const avgPool = JACKPOT_SEED_MULTIPLIER + JACKPOT_CONTRIBUTION_RATE / p;
  const poolSd = (JACKPOT_CONTRIBUTION_RATE * Math.sqrt(1 - p)) / p;
  const mean = p * avgPool;
  return p * (avgPool ** 2 + poolSd ** 2) - mean ** 2;
}

describe('Monte Carlo through the ticket state machine (within 4 sigma)', () => {
  it('prize-only RTP converges on 63.45%', async () => {
    const { prizes } = await getRun();
    const sigma = Math.sqrt(prizeVariance()) / Math.sqrt(BETS);
    const measured = prizes / BETS;
    console.log(`prizes: measured ${(measured * 100).toFixed(3)}% vs theory ${(prizeRtp() * 100).toFixed(3)}% (n=${BETS})`);
    expect(Math.abs(measured - prizeRtp())).toBeLessThan(4 * sigma);
  }, 600_000);

  it('total RTP (prizes + jackpot) converges on 95.45%', async () => {
    const { prizes, jackpotPaid, jackpotHits } = await getRun();
    const sigma = Math.sqrt(prizeVariance() + jackpotVariance()) / Math.sqrt(BETS);
    const measured = (prizes + jackpotPaid) / BETS;
    console.log(
      `total: measured ${(measured * 100).toFixed(3)}% vs theory ${(totalRtp() * 100).toFixed(3)}% ` +
        `(n=${BETS}, jackpot hits=${jackpotHits}, 1 sigma=${(sigma * 100).toFixed(3)}%)`,
    );
    expect(Math.abs(measured - totalRtp())).toBeLessThan(4 * sigma);
  }, 600_000);
});

describe('Engine-level run (real ChainsGame settlement path)', () => {
  it('balance matches the sum of ticket records, and prize RTP is within 4 sigma', () => {
    const START = 1_000_000_000;
    const game = new ChainsGame({ startingBalance: START }, new RNG(99));
    const picker = new RNG(5);
    let stakes = 0;
    let prizes = 0;
    let jackpots = 0;

    for (let i = 0; i < ENGINE_BETS; i += 1) {
      const digits = Array.from({ length: LINK_LENGTH }, () => picker.generateDigit());
      const res = game.placeBet({ links: [digits] });
      if (!res.success) throw new Error(res.message);
      stakes += res.totalStake;
      game.processDraw();
      game.processDraw();
      game.processDraw();
      const settled = game.getTicketHistory().find((t) => t.id === res.ticketIds[0]);
      if (!settled) throw new Error('Settled link not found in history.');
      prizes += settled.prizeAmount ?? 0;
      jackpots += settled.jackpotWinAmount ?? 0;
    }

    expect(game.getBalance()).toBeCloseTo(START - stakes + prizes + jackpots, 2);

    const sigma = Math.sqrt(prizeVariance()) / Math.sqrt(ENGINE_BETS);
    const measured = prizes / ENGINE_BETS;
    console.log(`engine prizes: measured ${(measured * 100).toFixed(3)}% vs theory ${(prizeRtp() * 100).toFixed(3)}% (n=${ENGINE_BETS})`);
    expect(Math.abs(measured - prizeRtp())).toBeLessThan(4 * sigma);
  }, 600_000);
});

// SIM_BETS=50000000 npx vitest run src/game/sim.test.ts
// PowerShell: $env:SIM_BETS=50000000; npx vitest run src/game/sim.test.ts