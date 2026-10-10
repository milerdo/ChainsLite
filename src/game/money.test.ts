import { describe, it, expect } from 'vitest';
import { formatMoney } from './money';

// Intl uses a non-breaking space before the symbol; normalise for comparison.
const plain = (s: string) => s.replace(/\u00a0/g, ' ');

describe('formatMoney', () => {
  it('puts the euro sign after the number with a decimal comma', () => {
    expect(plain(formatMoney(9))).toBe('9,00 €');
    expect(plain(formatMoney(1.5))).toBe('1,50 €');
  });
  it('groups thousands with dots', () => {
    expect(plain(formatMoney(1234.56))).toBe('1.234,56 €');
  });
});