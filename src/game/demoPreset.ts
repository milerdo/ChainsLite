import { DEMO_JACKPOT_PRESET } from './constants';
import type { ChainsGame } from './engine';

/** Demo-only. Sets the absolute pool value via the existing forceJackpotPool path. */
export function applyDemoJackpotPreset(game: ChainsGame): void {
  game.forceJackpotPool(DEMO_JACKPOT_PRESET);
}