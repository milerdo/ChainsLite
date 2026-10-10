// ============================================================================
// CHAINS — Display Formatting Helpers
// Pure presentation functions only. No game math lives here — see
// src/game/payouts.ts for anything that touches actual credited amounts.
// ============================================================================

import { formatMoney } from '../game/money';
import { CURRENCY_LOCALE } from '../game/constants';

/** "1,5×" / "10×" (locale from constants). */
export function formatMultiplier(multiplier: number): string {
  return `${multiplier.toLocaleString(CURRENCY_LOCALE)}×`;
}

/** "9,00 €" / "-1,00 €" */
export function formatCurrency(value: number): string {
  return formatMoney(value);
}

/** "+10,00 €" — explicitly signed, used for history/ticket amounts. */
export function formatSignedCurrency(value: number): string {
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${sign}${formatMoney(Math.abs(value))}`;
}

/** "1.234,56 €" — same format; kept as a separate name for the jackpot pool. */
export function formatCompactCurrency(value: number): string {
  return formatMoney(value);
}
export function formatDrawIndex(index: number): string {
  return `#${index}`;
}

export function formatSequence(digits: readonly number[]): string {
  return digits.join(' → ');
}

/** Seconds remaining as a one-decimal string ("10.0", "9.9", "0.0"). */
export function formatCountdown(ms: number): string {
  return String(Math.max(0, Math.ceil(ms / 1000)));
}

/** "95,45 %" (locale from constants). */
export function formatPercent(fraction: number, decimals = 2): string {
  return new Intl.NumberFormat(CURRENCY_LOCALE, {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(fraction);
}
