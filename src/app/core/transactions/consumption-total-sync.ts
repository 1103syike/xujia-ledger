import { toAmount } from '../../shared/utils/amount';

/**
 * 對齊記帳消費總額欄位（不含服務費）。
 *
 * - 已錨定（使用者有設總額）：總額不跟個人應付跑；細項超過時仍可撐開
 * - 未錨定（沒設總額）：總額＝鎖定應付加總（與細項取大），淺色跟隨增減
 *
 * 參數用 toAmount 強制成數字，避免字串 `"123"+456` 黏出怪總額。
 */
export function resolveSyncedConsumptionTotal(input: {
  fromField: number;
  exclusiveSum: number;
  lockedSplitSum: number;
  anchored: boolean;
}): number {
  const field = toAmount(input.fromField);
  const exclusives = toAmount(input.exclusiveSum);
  const locked = toAmount(input.lockedSplitSum);

  if (input.anchored) {
    return Math.max(field, exclusives);
  }

  return Math.max(locked, exclusives);
}
