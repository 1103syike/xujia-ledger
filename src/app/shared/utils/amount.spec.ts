import { sumAmounts, toAmount } from './amount';

describe('toAmount / sumAmounts', () => {
  it('把字串數字轉成數字', () => {
    expect(toAmount('123')).toBe(123);
    expect(toAmount(' 45 ')).toBe(45);
  });

  it('空／無效當 0', () => {
    expect(toAmount('')).toBe(0);
    expect(toAmount(null)).toBe(0);
    expect(toAmount('abc')).toBe(0);
    expect(toAmount(-3)).toBe(0);
  });

  it('加總不會黏成字串', () => {
    expect(sumAmounts(['123', 121, 288, 0])).toBe(532);
    expect(sumAmounts(['123', '123', '131', '213'])).toBe(590);
  });
});
