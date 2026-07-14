/**
 * 對齊記帳消費總額欄位（不含服務費）。
 * - 專屬細項加總超過既有總額 → 拉高（由下往上）
 * - 尚未填 → 用分攤合計帶入
 * - 其餘維持既有總額（錨定共同剩餘）
 */
export function resolveSyncedConsumptionTotal(
  fromField: number,
  exclusiveSum: number,
  fromSplits: number
): number {
  const field = Math.max(0, fromField);
  const exclusives = Math.max(0, exclusiveSum);
  const splits = Math.max(0, fromSplits);

  if (exclusives > field) return exclusives;
  if (field > 0) return field;
  return splits > 0 ? splits : field;
}
