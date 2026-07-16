import { resolveSyncedConsumptionTotal } from './consumption-total-sync';

describe('resolveSyncedConsumptionTotal', () => {
  it('未錨定：總額跟著鎖定應付加總', () => {
    expect(
      resolveSyncedConsumptionTotal({
        fromField: 0,
        exclusiveSum: 0,
        lockedSplitSum: 1353,
        anchored: false,
      })
    ).toBe(1353);
  });

  it('未錨定：改小鎖定應付時總額跟著降', () => {
    expect(
      resolveSyncedConsumptionTotal({
        fromField: 1353,
        exclusiveSum: 0,
        lockedSplitSum: 246,
        anchored: false,
      })
    ).toBe(246);
  });

  it('未錨定：細項可撐開', () => {
    expect(
      resolveSyncedConsumptionTotal({
        fromField: 100,
        exclusiveSum: 218,
        lockedSplitSum: 100,
        anchored: false,
      })
    ).toBe(218);
  });

  it('已錨定：改應付不改總額', () => {
    expect(
      resolveSyncedConsumptionTotal({
        fromField: 6492,
        exclusiveSum: 0,
        lockedSplitSum: 3369,
        anchored: true,
      })
    ).toBe(6492);
  });

  it('已錨定：細項超過總額仍撐開', () => {
    expect(
      resolveSyncedConsumptionTotal({
        fromField: 100,
        exclusiveSum: 500,
        lockedSplitSum: 0,
        anchored: true,
      })
    ).toBe(500);
  });

  it('未錨定且無鎖定無細項 → 0', () => {
    expect(
      resolveSyncedConsumptionTotal({
        fromField: 2,
        exclusiveSum: 0,
        lockedSplitSum: 0,
        anchored: false,
      })
    ).toBe(0);
  });

  it('字串金額不會黏成怪總額', () => {
    expect(
      resolveSyncedConsumptionTotal({
        fromField: '123' as unknown as number,
        exclusiveSum: 0,
        lockedSplitSum: '590' as unknown as number,
        anchored: false,
      })
    ).toBe(590);
  });
});
