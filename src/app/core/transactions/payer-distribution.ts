import { toAmount } from '../../shared/utils/amount';

/** 單一付款列狀態（供分配演算法使用） */
export interface PayerAmountRow {
  amount: number;
  locked: boolean;
}

/**
 * 將 remainder 均分給 count 人；尾差塞進第一格。
 */
export function splitEqually(total: number, count: number): number[] {
  if (count <= 0) return [];
  if (total <= 0) return Array(count).fill(0);

  const base = Math.floor(total / count);
  const amounts = Array(count).fill(base);
  amounts[0] += total - base * count;
  return amounts;
}

/**
 * 依分攤總額分配實付金額。
 * - locked 列維持原值
 * - 未 lock：均分剩餘，尾差給第一個未 lock
 * - locked 合計已 ≥ splitTotal 時，未 lock 為 0
 */
export function distributePayerAmounts(
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
