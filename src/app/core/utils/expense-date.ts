import { Expense } from '../models';

/** 本地時區 YYYY-MM-DD */
export function todayLocalDate(): string {
  return formatLocalDate(new Date());
}

export function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function normalizeExpenseDate(expense: {
  date?: string | null;
  createdAt?: string;
}): string {
  if (expense.date && /^\d{4}-\d{2}-\d{2}$/.test(expense.date)) {
    return expense.date;
  }
  if (expense.createdAt) {
    return expense.createdAt.slice(0, 10);
  }
  return todayLocalDate();
}

export function formatExpenseDateLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  if (!y || !m || !d) return date;
  return new Date(y, m - 1, d).toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });
}

export function compareExpensesByDate(a: Expense, b: Expense): number {
  const dateCmp = normalizeExpenseDate(b).localeCompare(normalizeExpenseDate(a));
  if (dateCmp !== 0) return dateCmp;
  return (b.createdAt ?? '').localeCompare(a.createdAt ?? '');
}

export function normalizeExpense(expense: Expense): Expense {
  return {
    ...expense,
    date: normalizeExpenseDate(expense),
  };
}
