import { toAmount } from '../../shared/utils/amount';
import { PayerAmountRow, splitEqually } from './payer-distribution';

/** 分攤金額：未 lock 的成員均分剩餘（純均分，無「一半」規則） */
export function distributeSplitAmounts(
  splitTotal: number,
  rows: PayerAmountRow[]
): number[] {
  const n = rows.length;
  if (n === 0) return [];
  const total = toAmount(splitTotal);
  if (total <= 0) return rows.map(() => 0);

  const amounts = rows.map((r) => (r.locked ? toAmount(r.amount) : 0));
  const lockedSum = amounts.reduce((sum, value) => sum + value, 0);
  const unlockedIndices = rows
    .map((row, index) => (!row.locked ? index : -1))
    .filter((index) => index >= 0);

  if (unlockedIndices.length === 0) {
    return amounts;
  }

  let remainder = total - lockedSum;
  if (remainder < 0) remainder = 0;

  const parts = splitEqually(remainder, unlockedIndices.length);
  unlockedIndices.forEach((index, i) => {
    amounts[index] = parts[i];
  });

  return amounts;
}

/**
 * 細項混合分攤：專屬細項歸人，剩餘均分給「參與共同」的人。
 * - sharesCommon 省略或全 true → 全體均分剩餘（含有細項的人）
 * - sharesCommon[i]=false → 該員只付專屬，不進共同
 *
 * 例：兩盒泡芙 600；A 專屬 300 且免均分；BCD 均分剩 300 → [300,100,100,100]
 */
export function distributeHybridSplitAmounts(
  splitTotal: number,
  exclusiveAmounts: number[],
  sharesCommon?: boolean[]
): number[] {
  const n = exclusiveAmounts.length;
  if (n === 0) return [];
  const total = toAmount(splitTotal);
  if (total <= 0) return exclusiveAmounts.map(() => 0);

  const exclusives = exclusiveAmounts.map((amount) => toAmount(amount));
  const exclusiveSum = exclusives.reduce((sum, amount) => sum + amount, 0);
  let remainder = total - exclusiveSum;
  if (remainder < 0) remainder = 0;

  const shareIndices = exclusives
    .map((_, index) => {
      const shares = sharesCommon ? sharesCommon[index] !== false : true;
      return shares ? index : -1;
    })
    .filter((index) => index >= 0);

  if (shareIndices.length === 0) {
    return exclusives;
  }

  const parts = splitEqually(remainder, shareIndices.length);
  const amounts = [...exclusives];
  shareIndices.forEach((index, i) => {
    amounts[index] = exclusives[index] + parts[i];
  });
  return amounts;
}
