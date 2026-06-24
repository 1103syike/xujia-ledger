import { Transaction } from '../models';
import { distributeSplitAmounts } from './split-distribution';

describe('distributeSplitAmounts', () => {
  it('splits evenly among unlocked rows', () => {
    expect(
      distributeSplitAmounts(220, [
        { amount: 0, locked: false },
        { amount: 0, locked: false },
      ])
    ).toEqual([110, 110]);
  });

  it('redistributes around a locked row', () => {
    expect(
      distributeSplitAmounts(
        220,
        [
          { amount: 150, locked: true },
          { amount: 0, locked: false },
        ]
      )
    ).toEqual([150, 70]);
  });
});
