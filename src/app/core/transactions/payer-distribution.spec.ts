import {
  distributePayerAmounts,
  PayerAmountRow,
  splitEqually,
} from './payer-distribution';

function rows(
  specs: Array<{ amount?: number; locked?: boolean }>
): PayerAmountRow[] {
  return specs.map((spec) => ({
    amount: spec.amount ?? 0,
    locked: spec.locked ?? false,
  }));
}

describe('splitEqually', () => {
  it('puts remainder in first slot', () => {
    expect(splitEqually(1000, 3)).toEqual([334, 333, 333]);
  });
});

describe('distributePayerAmounts', () => {
  it('assigns full split total to single payer', () => {
    expect(distributePayerAmounts(220, rows([{}]))).toEqual([220]);
  });

  it('splits evenly between two payers', () => {
    expect(distributePayerAmounts(1000, rows([{}, {}]))).toEqual([500, 500]);
    expect(distributePayerAmounts(1486, rows([{}, {}]))).toEqual([743, 743]);
  });

  it('splits evenly between three payers', () => {
    expect(distributePayerAmounts(1000, rows([{}, {}, {}]))).toEqual([
      334, 333, 333,
    ]);
  });

  it('splits evenly between four payers', () => {
    expect(distributePayerAmounts(1000, rows([{}, {}, {}, {}]))).toEqual([
      250, 250, 250, 250,
    ]);
  });

  it('redistributes around a locked first payer', () => {
    expect(
      distributePayerAmounts(1000, rows([{ amount: 700, locked: true }, {}, {}]))
    ).toEqual([700, 150, 150]);
  });

  it('redistributes when second payer is locked', () => {
    expect(
      distributePayerAmounts(
        1000,
        rows([{ amount: 700, locked: true }, { amount: 200, locked: true }, {}])
      )
    ).toEqual([700, 200, 100]);
  });

  it('keeps locked overpay amounts for change scenarios', () => {
    expect(
      distributePayerAmounts(
        1486,
        rows([
          { amount: 1000, locked: true },
          { amount: 1000, locked: true },
        ])
      )
    ).toEqual([1000, 1000]);
  });

  it('fills remaining unlocked payer after one locks over half', () => {
    expect(
      distributePayerAmounts(
        1486,
        rows([{ amount: 1000, locked: true }, {}])
      )
    ).toEqual([1000, 486]);
  });

  it('assigns zero to unlocked when locked sum already covers split total', () => {
    expect(
      distributePayerAmounts(
        220,
        rows([
          { amount: 600, locked: true },
          { amount: 600, locked: true },
        ])
      )
    ).toEqual([600, 600]);
  });

  it('splits remainder evenly among unlocked when leading payer is locked', () => {
    expect(
      distributePayerAmounts(
        1000,
        rows([
          { amount: 100, locked: true },
          {},
          {},
          {},
        ])
      )
    ).toEqual([100, 300, 300, 300]);
  });

  it('returns zeros when split total is not positive', () => {
    expect(distributePayerAmounts(0, rows([{}, {}]))).toEqual([0, 0]);
  });
});
