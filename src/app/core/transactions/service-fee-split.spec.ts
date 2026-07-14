import {
  applyServiceFeeToSplitPreview,
  serviceFeeSharesByMember,
  subtractServiceFeeFromAmounts,
} from './service-fee-split';
import { calculateEqualSplit } from './split-calculator';

describe('serviceFeeSharesByMember', () => {
  it('splits service fee equally among participants', () => {
    const shares = serviceFeeSharesByMember(30, ['a', 'b', 'c'], 'p', 'seed');
    expect([...shares.values()].reduce((s, v) => s + v, 0)).toBe(30);
    expect(shares.get('a')).toBe(10);
    expect(shares.get('b')).toBe(10);
    expect(shares.get('c')).toBe(10);
  });
});

describe('applyServiceFeeToSplitPreview', () => {
  it('adds service fee on top of equal subtotal split', () => {
    const base = calculateEqualSplit(220, ['a', 'b', 'c'], 'p', 'seed');
    const withFee = applyServiceFeeToSplitPreview(
      base,
      30,
      ['a', 'b', 'c'],
      'p',
      'seed'
    );

    expect(withFee.total).toBe(250);
    expect(withFee.lines.find((l) => l.memberId === 'a')?.amount).toBe(84);
    expect(withFee.lines.find((l) => l.memberId === 'b')?.amount).toBe(83);
    expect(withFee.lines.find((l) => l.memberId === 'c')?.amount).toBe(83);
  });
});

describe('subtractServiceFeeFromAmounts', () => {
  it('restores base amounts from totals that included service fee', () => {
    const totals = { a: 84, b: 83, c: 83 };
    const base = subtractServiceFeeFromAmounts(
      totals,
      30,
      ['a', 'b', 'c'],
      'p',
      'seed'
    );
    expect(base).toEqual({ a: 74, b: 73, c: 73 });
  });
});
