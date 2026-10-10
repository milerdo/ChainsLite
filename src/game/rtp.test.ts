import { describe, it, expect } from 'vitest';
import { hitsDistribution, houseEdge, jackpotHitProbability, jackpotRtp, prizeRtp, totalRtp } from './rtp';

describe('theoretical RTP (closed form)', () => {
  it('hit distribution is 72.9 / 24.3 / 2.7 / 0.1 % and sums to 1', () => {
    const d = hitsDistribution();
    expect(d[0]).toBeCloseTo(0.729, 10);
    expect(d[1]).toBeCloseTo(0.243, 10);
    expect(d[2]).toBeCloseTo(0.027, 10);
    expect(d[3]).toBeCloseTo(0.001, 10);
    expect(d.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
  });

  it('regular prizes: 36.45% + 27.00% = 63.45%', () => {
    expect(prizeRtp()).toBeCloseTo(0.6345, 10);
  });

  it('jackpot RTP = 12% contribution + 20% seed = 32%', () => {
    expect(jackpotHitProbability()).toBeCloseTo(0.001, 12);
    expect(jackpotRtp()).toBeCloseTo(0.32, 10);
  });

  it('total RTP 95.45%, house edge 4.55%', () => {
    expect(totalRtp()).toBeCloseTo(0.9545, 10);
    expect(houseEdge()).toBeCloseTo(0.0455, 10);
  });
});