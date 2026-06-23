import { Transaction } from '../models';
import { formatLocalDate, normalizeTransactionDate, todayLocalDate } from '../transactions/transaction-date';

export type TransactionDateGroup = 'today' | 'yesterday' | 'earlier';

export function yesterdayLocalDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return formatLocalDate(d);
}

export function transactionDateGroup(date: string): TransactionDateGroup {
  const today = todayLocalDate();
  if (date === today) return 'today';
  if (date === yesterdayLocalDate()) return 'yesterday';
  return 'earlier';
}

export function transactionDateGroupLabel(group: TransactionDateGroup): string {
  switch (group) {
    case 'today':
      return '今天';
    case 'yesterday':
      return '昨天';
    default:
      return '更早';
  }
}

export function groupByTransactionDate<T extends { tx: Transaction }>(
  items: T[]
): Array<{ group: TransactionDateGroup; label: string; items: T[] }> {
  const order: TransactionDateGroup[] = ['today', 'yesterday', 'earlier'];
  const buckets = new Map<TransactionDateGroup, T[]>(
    order.map((g) => [g, []])
  );

  for (const item of items) {
    const date = normalizeTransactionDate(item.tx);
    buckets.get(transactionDateGroup(date))!.push(item);
  }

  return order
    .filter((g) => (buckets.get(g)?.length ?? 0) > 0)
    .map((g) => ({
      group: g,
      label: transactionDateGroupLabel(g),
      items: buckets.get(g)!,
    }));
}

/** 紀錄卡片用：6/23 14:25 */
export function formatTransactionListTime(tx: Transaction): string {
  const date = normalizeTransactionDate(tx);
  const [, m, d] = date.split('-');
  const monthDay = `${Number(m)}/${Number(d)}`;

  if (!tx.createdAt) return monthDay;

  const created = new Date(tx.createdAt);
  if (Number.isNaN(created.getTime())) return monthDay;

  const hh = String(created.getHours()).padStart(2, '0');
  const mm = String(created.getMinutes()).padStart(2, '0');
  return `${monthDay} ${hh}:${mm}`;
}
