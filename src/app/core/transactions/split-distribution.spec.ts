import {
  distributeHybridSplitAmounts,
  distributeSplitAmounts,
} from './split-distribution';

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

describe('distributeHybridSplitAmounts', () => {
  it('splits common remainder among everyone after exclusive items', () => {
    // 全聯 521：A 蜜桃汽水+餅乾 83、B 建洛 25 → 剩 413 均分
    expect(distributeHybridSplitAmounts(521, [83, 25])).toEqual([290, 231]);
  });

  it('gives only exclusive when items cover the total', () => {
    expect(distributeHybridSplitAmounts(108, [83, 25])).toEqual([83, 25]);
  });

  it('splits entire total when nobody has exclusive items', () => {
    expect(distributeHybridSplitAmounts(521, [0, 0])).toEqual([261, 260]);
  });

  it('免均分：有專屬者不進共同（兩盒泡芙）', () => {
    // 總額 600；A 專屬一盒 300 免均分；BCD 分另一盒 300
    expect(
      distributeHybridSplitAmounts(
        600,
        [300, 0, 0, 0],
        [false, true, true, true]
      )
    ).toEqual([300, 100, 100, 100]);
  });

  it('免均分且無專屬 → 應付 0', () => {
    expect(
      distributeHybridSplitAmounts(300, [0, 0, 0], [false, true, true])
    ).toEqual([0, 150, 150]);
  });
});
