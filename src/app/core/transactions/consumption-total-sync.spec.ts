import { resolveSyncedConsumptionTotal } from './consumption-total-sync';

describe('resolveSyncedConsumptionTotal', () => {
  it('專屬細項超過既有總額時拉高（第一筆 89、再加到 218）', () => {
    expect(resolveSyncedConsumptionTotal(89, 218, 218)).toBe(218);
  });

  it('未填總額時用分攤合計帶入', () => {
    expect(resolveSyncedConsumptionTotal(0, 0, 150)).toBe(150);
  });

  it('已填且細項未超過時不覆寫（共同剩餘錨定）', () => {
    expect(resolveSyncedConsumptionTotal(300, 218, 300)).toBe(300);
  });

  it('欄位與細項皆為 0 時維持 0', () => {
    expect(resolveSyncedConsumptionTotal(0, 0, 0)).toBe(0);
  });
});
