import { describe, it, expect } from 'vitest';
import { ChainsGame } from './engine';
import { INITIAL_JACKPOT_POOL, DEMO_JACKPOT_PRESET } from './constants';
import { applyDemoJackpotPreset } from './demoPreset';

describe('demo jackpot preset', () => {
  it('engine default is the 200 seed, not the preset', () => {
    expect(INITIAL_JACKPOT_POOL).toBe(200);
    expect(new ChainsGame().getState().jackpotPool).toBe(INITIAL_JACKPOT_POOL);
  });

  it('applies only when called, and reset returns to the seed', () => {
    const g = new ChainsGame();
    applyDemoJackpotPreset(g);
    expect(g.getState().jackpotPool).toBe(DEMO_JACKPOT_PRESET);
    g.reset();
    expect(g.getState().jackpotPool).toBe(INITIAL_JACKPOT_POOL);
  });
});