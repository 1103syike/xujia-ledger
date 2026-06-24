import { Transaction } from '../models';
import {
  compareTransactionsByDate,
  formatLocalDate,
  normalizeTransactionDate,
} from './transaction-date';

export type TransactionDateGroup = 'today' | 'yesterday' | 'later' | 'earlier';

export function yesterdayLocalDate(ref: Date = new Date()): string {
  const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  d.setDate(d.getDate() - 1);
  return formatLocalDate(d);
}

export function transactionDateGroup(
  date: string,
  ref: Date = new Date()
): TransactionDateGroup {
  const today = formatLocalDate(ref);
  if (date === today) return 'today';
  if (date === yesterdayLocalDate(ref)) return 'yesterday';
  if (date > today) return 'later';
  return 'earlier';
}

export function transactionDateGroupLabel(group: TransactionDateGroup): string {
  switch (group) {
    case 'today':
      return '本日';
    case 'yesterday':
      return '昨日';
    case 'later':
      return '之後';
    default:
      return '更早';
  }
}

export function groupByTransactionDate<T extends { tx: Transaction }>(
  items: T[],
  ref: Date = new Date()
): Array<{ group: TransactionDateGroup; label: string; items: T[] }> {
  const order: TransactionDateGroup[] = [
    'later',
    'today',
    'yesterday',
    'earlier',
  ];
  const buckets = new Map<TransactionDateGroup, T[]>(
    order.map((g) => [g, []])
  );

  for (const item of items) {
    const date = normalizeTransactionDate(item.tx);
    buckets.get(transactionDateGroup(date, ref))!.push(item);
  }

  for (const bucket of buckets.values()) {
    bucket.sort((a, b) => compareTransactionsByDate(a.tx, b.tx));
  }

  return order
    .filter((g) => (buckets.get(g)?.length ?? 0) > 0)
    .map((g) => ({
      group: g,
      label: transactionDateGroupLabel(g),
      items: buckets.get(g)!,
    }));
}

/** 整合勾選列用：6/23 */
export function formatTransactionPickDate(tx: Transaction): string {
  const date = normalizeTransactionDate(tx);
  const [, m, d] = date.split('-');
  return `${Number(m)}/${Number(d)}`;
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
