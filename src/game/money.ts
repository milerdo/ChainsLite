import { CURRENCY_CODE, CURRENCY_LOCALE } from './constants';

const formatter = new Intl.NumberFormat(CURRENCY_LOCALE, {
  style: 'currency',
  currency: CURRENCY_CODE,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** "9,00 €", "1.234,56 €" (locale from constants). Display only. */
export function formatMoney(value: number): string {
  return formatter.format(value);
}