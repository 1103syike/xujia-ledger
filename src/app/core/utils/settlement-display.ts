/** 你尚需還給對方：紅字負數 */
export function formatOweAmount(amount: number): string {
  return `-$${amount}`;
}

/** 對方尚需還給你：綠字正數 */
export function formatOwedAmount(amount: number): string {
  return `$${amount}`;
}

/** 依淨額正負格式化（正＝你欠對方，負＝對方欠你） */
export function formatNetBalance(owe: number): string | null {
  if (owe > 0) return formatOweAmount(owe);
  if (owe < 0) return formatOwedAmount(-owe);
  return null;
}

export function netBalanceClass(owe: number): string {
  if (owe > 0) return 'text-debt';
  if (owe < 0) return 'text-positive';
  return '';
}
