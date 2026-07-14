import { PayerAmountRow, splitEqually } from './payer-distribution';

/** 分攤金額：未 lock 的成員均分剩餘（純均分，無「一半」規則） */
export function distributeSplitAmounts(
  splitTotal: number,
  rows: PayerAmountRow[]
): number[] {
  const n = rows.length;
  if (n === 0) return [];
  if (splitTotal <= 0) return rows.map(() => 0);

  const amounts = rows.map((r) => (r.locked ? Math.max(0, r.amount) : 0));
  const lockedSum = amounts.reduce((sum, value) => sum + value, 0);
  const unlockedIndices = rows
    .map((row, index) => (!row.locked ? index : -1))
    .filter((index) => index >= 0);

  if (unlockedIndices.length === 0) {
    return amounts;
  }

  let remainder = splitTotal - lockedSum;
  if (remainder < 0) remainder = 0;

  const parts = splitEqually(remainder, unlockedIndices.length);
  unlockedIndices.forEach((index, i) => {
    amounts[index] = parts[i];
  });

  return amounts;
}

/**
 * 細項混合分攤：專屬細項歸人，剩餘全數均分給所有參與者。
 * 例：總額 521、A 專屬 83、B 專屬 25 → 剩 413 均分 → A 290、B 231
 */
export function distributeHybridSplitAmounts(
  splitTotal: number,
  exclusiveAmounts: number[]
): number[] {
  const n = exclusiveAmounts.length;
  if (n === 0) return [];
  if (splitTotal <= 0) return exclusiveAmounts.map(() => 0);

  const exclusives = exclusiveAmounts.map((amount) => Math.max(0, amount));
  const exclusiveSum = exclusives.reduce((sum, amount) => sum + amount, 0);
  let remainder = splitTotal - exclusiveSum;
  if (remainder < 0) remainder = 0;

  const shares = splitEqually(remainder, n);
  return exclusives.map((exclusive, index) => exclusive + shares[index]);
}
