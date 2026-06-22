import { Expense, ExpenseSplit, BalanceEdge } from '../models';

export function computeBalances(expenses: Expense[]): BalanceEdge[] {
  const matrix = new Map<string, number>();

  const key = (from: string, to: string) => `${from}->${to}`;
  const add = (from: string, to: string, amount: number) => {
    if (from === to || amount <= 0) return;
    matrix.set(key(from, to), (matrix.get(key(from, to)) ?? 0) + amount);
  };

  for (const expense of expenses) {
    if (expense.status !== 'open') continue;

    for (const split of expense.splits) {
      if (split.memberId === expense.payerId) continue;
      if (split.paymentStatus === 'confirmed') continue;

      add(split.memberId, expense.payerId, split.amount);
    }
  }

  const edges: BalanceEdge[] = [];
  matrix.forEach((amount, k) => {
    const [fromId, toId] = k.split('->');
    edges.push({ fromId, toId, amount });
  });

  return edges.sort((a, b) => b.amount - a.amount);
}

export function netBalances(expenses: Expense[]): BalanceEdge[] {
  const raw = computeBalances(expenses);
  const pairKey = (a: string, b: string) => [a, b].sort().join('|');
  const pairs = new Map<string, { a: string; b: string; ab: number; ba: number }>();

  for (const edge of raw) {
    const pk = pairKey(edge.fromId, edge.toId);
    const entry = pairs.get(pk) ?? {
      a: edge.fromId,
      b: edge.toId,
      ab: 0,
      ba: 0,
    };
    if (edge.fromId === entry.a) {
      entry.ab += edge.amount;
    } else {
      entry.ba += edge.amount;
    }
    pairs.set(pk, entry);
  }

  const result: BalanceEdge[] = [];
  pairs.forEach(({ a, b, ab, ba }) => {
    if (ab > ba) {
      result.push({ fromId: a, toId: b, amount: ab - ba });
    } else if (ba > ab) {
      result.push({ fromId: b, toId: a, amount: ba - ab });
    }
  });

  return result.sort((x, y) => y.amount - x.amount);
}

export function pendingConfirmationsFor(
  expenses: Expense[],
  memberId: string
): { expense: Expense; split: ExpenseSplit }[] {
  const items: { expense: Expense; split: ExpenseSplit }[] = [];

  for (const expense of expenses) {
    if (expense.status !== 'open') continue;
    if (expense.payerId !== memberId) continue;

    for (const split of expense.splits) {
      if (split.memberId === memberId) continue;
      if (split.paymentStatus === 'marked') {
        items.push({ expense, split });
      }
    }
  }

  return items;
}

export function myDebts(
  expenses: Expense[],
  memberId: string
): { expense: Expense; split: ExpenseSplit }[] {
  const items: { expense: Expense; split: ExpenseSplit }[] = [];

  for (const expense of expenses) {
    if (expense.status !== 'open') continue;

    for (const split of expense.splits) {
      if (split.memberId !== memberId) continue;
      if (split.memberId === expense.payerId) continue;
      if (split.paymentStatus === 'confirmed') continue;
      items.push({ expense, split });
    }
  }

  return items;
}
