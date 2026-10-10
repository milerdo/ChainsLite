// CHAINS LITE: theoretical RTP derived from constants (never hardcoded).
// Each of the 3 positions is an independent 1-in-DIGIT_COUNT shot, so hits
// follow Binomial(LINK_LENGTH, 1/DIGIT_COUNT).
// Jackpot RTP = contribution rate + seed x P(jackpot): the pool is funded by
// contributions, and the operator re-funds the seed after every win.
import {
  DIGIT_COUNT,
  JACKPOT_CONTRIBUTION_RATE,
  JACKPOT_SEED_MULTIPLIER,
  LINK_LENGTH,
  PRIZE_MULTIPLIERS,
} from './constants';

const P_HIT = 1 / DIGIT_COUNT;

function choose(n: number, k: number): number {
  let result = 1;
  for (let i = 1; i <= k; i += 1) result = (result * (n - k + i)) / i;
  return result;
}

/** P(exactly `hits` positions match). */
export const hitsProbability = (hits: number): number =>
  choose(LINK_LENGTH, hits) * P_HIT ** hits * (1 - P_HIT) ** (LINK_LENGTH - hits);

/** [P(0 hits), P(1 hit), ... P(LINK_LENGTH hits)] */
export const hitsDistribution = (): number[] =>
  Array.from({ length: LINK_LENGTH + 1 }, (_, hits) => hitsProbability(hits));

export const jackpotHitProbability = (): number => hitsProbability(LINK_LENGTH);

/** RTP from the 1- and 2-hit multiplier prizes. */
export const prizeRtp = (): number => {
  let sum = 0;
  for (let hits = 1; hits < LINK_LENGTH; hits += 1) {
    sum += hitsProbability(hits) * (PRIZE_MULTIPLIERS[hits] ?? 0);
  }
  return sum;
};

export const jackpotRtp = (): number =>
  JACKPOT_CONTRIBUTION_RATE + JACKPOT_SEED_MULTIPLIER * jackpotHitProbability();

export const totalRtp = (): number => prizeRtp() + jackpotRtp();
export const houseEdge = (): number => 1 - totalRtp();