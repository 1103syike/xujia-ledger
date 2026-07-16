/** 金額：一律轉成 ≥0 數字，避免字串 `"123"+456` 黏成怪總額 */
export function toAmount(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  const n = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n;
}

export function sumAmounts(values: Iterable<unknown>): number {
  let sum = 0;
  for (const value of values) {
    sum += toAmount(value);
  }
  return sum;
}
