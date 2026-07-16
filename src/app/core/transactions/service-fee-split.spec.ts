import {
  allocateByWeights,
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

  it('splits service fee proportional to base amounts', () => {
    const shares = serviceFeeSharesByMember(
      30,
      ['a', 'b'],
      'p',
      'seed',
      {
        mode: 'proportional',
        baseAmountsByMember: { a: 200, b: 100 },
      }
    );
    expect(shares.get('a')).toBe(20);
    expect(shares.get('b')).toBe(10);
  });

  it('falls back to equal when proportional bases are all zero', () => {
    const shares = serviceFeeSharesByMember(
      30,
      ['a', 'b', 'c'],
      'p',
      'seed',
      {
        mode: 'proportional',
        baseAmountsByMember: { a: 0, b: 0, c: 0 },
      }
    );
    expect(shares.get('a')).toBe(10);
    expect(shares.get('b')).toBe(10);
    expect(shares.get('c')).toBe(10);
  });
});

describe('allocateByWeights', () => {
  it('gives remainder to largest fractional parts', () => {
    const shares = allocateByWeights(10, [
      { id: 'a', amount: 1 },
      { id: 'b', amount: 1 },
      { id: 'c', amount: 1 },
    ]);
    expect([...shares.values()].reduce((s, v) => s + v, 0)).toBe(10);
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
    // 基礎均分尾差可能在不同人，但每人 = 基礎 + 服務費 10
    const byId = Object.fromEntries(
      withFee.lines.map((line) => [line.memberId, line.amount])
    );
    expect(byId['a'] + byId['b'] + byId['c']).toBe(250);
    expect([byId['a'], byId['b'], byId['c']].every((n) => n === 83 || n === 84)).toBe(
      true
    );
  });

  it('adds proportional service fee using each line as base', () => {
    const base = {
      lines: [
        {
          memberId: 'a',
          amount: 200,
          isRemainderBearer: false,
          remainderAmount: 0,
        },
        {
          memberId: 'b',
          amount: 100,
          isRemainderBearer: false,
          remainderAmount: 0,
        },
      ],
      total: 300,
      remainderBearerId: null as string | null,
      remainderAmount: 0,
    };
    const withFee = applyServiceFeeToSplitPreview(
      base,
      30,
      ['a', 'b'],
      'p',
      'seed',
      'proportional'
    );
    expect(withFee.total).toBe(330);
    expect(withFee.lines.find((l) => l.memberId === 'a')?.amount).toBe(220);
    expect(withFee.lines.find((l) => l.memberId === 'b')?.amount).toBe(110);
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

  it('restores proportional fee from inclusive totals', () => {
    const totals = { a: 220, b: 110 };
    const base = subtractServiceFeeFromAmounts(
      totals,
      30,
      ['a', 'b'],
      'p',
      'seed',
      'proportional'
    );
    expect(base).toEqual({ a: 200, b: 100 });
  });
});
