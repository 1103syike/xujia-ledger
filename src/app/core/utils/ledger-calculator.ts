import { BalanceEdge, SettlementEntry, Transaction } from '../models';
import { advanceMemberBalances, advanceSettlementEdges, getAdvancePayers } from './advance-allocation';

function edgeKey(from: string, to: string): string {
  return `${from}->${to}`;
}

function addEdge(
  matrix: Map<string, number>,
  from: string,
  to: string,
  amount: number
): void {
  if (from === to || amount === 0) return;
  const key = edgeKey(from, to);
  matrix.set(key, (matrix.get(key) ?? 0) + amount);
}

function isBalanceRelevant(tx: Transaction): boolean {
  if (tx.status !== 'active') return false;
  if (tx.settledByTransferId) return false;
  return true;
}

/** 原始 pairwise 欠款（未軋差） */
export function computeBalances(transactions: Transaction[]): BalanceEdge[] {
  const matrix = new Map<string, number>();

  for (const tx of transactions) {
    if (!isBalanceRelevant(tx)) continue;

    if (tx.type === 'advance') {
      for (const e of advanceSettlementEdges(tx)) {
        addEdge(matrix, e.fromId, e.toId, e.amount);
      }
    } else if (tx.type === 'repayment') {
      const from = tx.fromMemberId ?? tx.payerId;
      const to = tx.payerId;
      if (from && to && tx.totalAmount > 0) {
        addEdge(matrix, from, to, -tx.totalAmount);
      }
    } else if (tx.type === 'transfer') {
      for (const e of tx.transferEdges ?? []) {
        if (e.amount > 0) {
          addEdge(matrix, e.fromId, e.toId, e.amount);
        }
      }
    }
  }

  const edges: BalanceEdge[] = [];
  matrix.forEach((amount, key) => {
    if (amount === 0) return;
    const [fromId, toId] = key.split('->');
    if (amount > 0) {
      edges.push({ fromId, toId, amount });
    } else {
      edges.push({ fromId: toId, toId: fromId, amount: -amount });
    }
  });

  return edges.sort((a, b) => b.amount - a.amount);
}

export function netBalances(transactions: Transaction[]): BalanceEdge[] {
  const raw = computeBalances(transactions);
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

/**  viewer 視角：與各成員的結算 */
export function settlementsForMember(
  transactions: Transaction[],
  viewerId: string
): SettlementEntry[] {
  return netBalances(transactions)
    .filter((e) => e.fromId === viewerId || e.toId === viewerId)
    .map((e) => {
      if (e.fromId === viewerId) {
        return { otherId: e.toId, direction: 'owe' as const, amount: e.amount };
      }
      return { otherId: e.fromId, direction: 'owed' as const, amount: e.amount };
    })
    .sort((a, b) => b.amount - a.amount);
}

/** viewer 欠 other 的淨額（正數表示 viewer 欠 other） */
export function amountViewerOwesOther(
  transactions: Transaction[],
  viewerId: string,
  otherId: string
): number {
  const edge = netBalances(transactions).find(
    (e) =>
      (e.fromId === viewerId && e.toId === otherId) ||
      (e.fromId === otherId && e.toId === viewerId)
  );
  if (!edge) return 0;
  if (edge.fromId === viewerId) return edge.amount;
  return -edge.amount;
}

/** 與指定成員的 pairwise 結算（fromId 欠 toId） */
export function pairwiseSettlement(
  transactions: Transaction[],
  memberA: string,
  memberB: string
): BalanceEdge | null {
  const edge = netBalances(transactions).find(
    (e) =>
      (e.fromId === memberA && e.toId === memberB) ||
      (e.fromId === memberB && e.toId === memberA)
  );
  return edge ?? null;
}

/** 交易是否涉及指定成員 */
export function transactionInvolvesMember(
  tx: Transaction,
  memberId: string
): boolean {
  if (!isBalanceRelevant(tx)) return false;
  if (tx.type === 'transfer') {
    return (
      tx.participants.some((p) => p.memberId === memberId) ||
      (tx.transferEdges?.some(
        (e) => e.fromId === memberId || e.toId === memberId
      ) ??
        false)
    );
  }
  if (tx.type === 'repayment') {
    const from = tx.fromMemberId ?? '';
    return from === memberId || tx.payerId === memberId;
  }
  if (tx.type === 'advance') {
    return (
      getAdvancePayers(tx).some((p) => p.memberId === memberId) ||
      tx.participants.some((p) => p.memberId === memberId && p.amount > 0)
    );
  }
  return false;
}

/** 交易是否影響兩人 pairwise 結算（代墊＋分攤，或還款） */
export function transactionAffectsPair(
  tx: Transaction,
  memberA: string,
  memberB: string
): boolean {
  if (tx.status !== 'active' || memberA === memberB) return false;
  if (tx.settledByTransferId) return false;

  if (tx.type === 'repayment') {
    const from = tx.fromMemberId ?? '';
    return (
      (from === memberA && tx.payerId === memberB) ||
      (from === memberB && tx.payerId === memberA)
    );
  }

  if (tx.type === 'transfer') {
    return tx.transferEdges?.some(
      (e) =>
        (e.fromId === memberA && e.toId === memberB) ||
        (e.fromId === memberB && e.toId === memberA)
    ) ?? false;
  }

  if (tx.type === 'advance') {
    return advanceSettlementEdges(tx).some(
      (e) =>
        (e.fromId === memberA && e.toId === memberB) ||
        (e.fromId === memberB && e.toId === memberA)
    );
  }

  return false;
}

/** 兩人之間的相關交易（須同時影響雙方結算） */
export function transactionsBetweenMembers(
  transactions: Transaction[],
  memberA: string,
  memberB: string
): Transaction[] {
  return transactions.filter((tx) =>
    transactionAffectsPair(tx, memberA, memberB)
  );
}

/** @deprecated 使用 transactionsBetweenMembers */
export function transactionsForMember(
  transactions: Transaction[],
  memberId: string
): Transaction[] {
  return transactions.filter((tx) => transactionInvolvesMember(tx, memberId));
}

/** 成員淨待結算（負＝整體尚欠，正＝整體應收） */
export function memberNetBalance(
  transactions: Transaction[],
  memberId: string
): number {
  let net = 0;
  for (const edge of netBalances(transactions)) {
    if (edge.fromId === memberId) net -= edge.amount;
    if (edge.toId === memberId) net += edge.amount;
  }
  return net;
}

/** 成員欠各債主的淨額明細（軋差後） */
export function creditorsOwedByMember(
  transactions: Transaction[],
  debtorId: string
): BalanceEdge[] {
  return netBalances(transactions)
    .filter((edge) => edge.fromId === debtorId)
    .sort((a, b) => b.amount - a.amount);
}

/** 成員欠各債主的原始明細（未軋差，與排行合計一致） */
export function grossCreditorsOwedByMember(
  transactions: Transaction[],
  debtorId: string
): BalanceEdge[] {
  return computeBalances(transactions)
    .filter((edge) => edge.fromId === debtorId)
    .sort((a, b) => b.amount - a.amount);
}

/** 兩人相關交易中最早的日期（用於利息試算） */
export function oldestPairTransactionDate(
  transactions: Transaction[],
  memberA: string,
  memberB: string
): string | null {
  const dates = transactionsBetweenMembers(transactions, memberA, memberB)
    .filter((tx) => tx.status === 'active')
    .map((tx) => tx.date ?? tx.createdAt?.slice(0, 10))
    .filter((d): d is string => Boolean(d && /^\d{4}-\d{2}-\d{2}$/.test(d)))
    .sort();

  return dates[0] ?? null;
}

/** 交易對 memberId 的 signed 影響（正=應收回，負=應付） */
export function signedImpactOnMember(
  tx: Transaction,
  memberId: string
): number {
  if (!isBalanceRelevant(tx)) return 0;

  if (tx.type === 'transfer') {
    const p = tx.participants.find((x) => x.memberId === memberId);
    if (p?.signedAmount !== undefined) return p.signedAmount;

    let net = 0;
    for (const e of tx.transferEdges ?? []) {
      if (e.fromId === memberId) net -= e.amount;
      if (e.toId === memberId) net += e.amount;
    }
    return net;
  }

  if (tx.type === 'repayment') {
    const from = tx.fromMemberId ?? '';
    if (from === memberId) return -tx.totalAmount;
    if (tx.payerId === memberId) return tx.totalAmount;
    return 0;
  }

  if (tx.type === 'advance') {
    return advanceMemberBalances(tx).get(memberId) ?? 0;
  }

  return 0;
}

/**
 * 交易對 memberId 與 otherId 之間的 signed 影響（僅計雙方往來）
 * 用於待結算明細：債務轉移只顯示與該對象相關的金額
 */
export function signedImpactOnPair(
  tx: Transaction,
  memberId: string,
  otherId: string
): number {
  if (!isBalanceRelevant(tx) || memberId === otherId) return 0;
  if (!transactionAffectsPair(tx, memberId, otherId)) return 0;

  if (tx.type === 'transfer') {
    let net = 0;
    for (const e of tx.transferEdges ?? []) {
      if (e.fromId === memberId && e.toId === otherId) net -= e.amount;
      if (e.fromId === otherId && e.toId === memberId) net += e.amount;
    }
    return net;
  }

  if (tx.type === 'advance') {
    const edges = advanceSettlementEdges(tx);
    let net = 0;
    for (const e of edges) {
      if (e.fromId === memberId && e.toId === otherId) net -= e.amount;
      if (e.fromId === otherId && e.toId === memberId) net += e.amount;
    }
    return net;
  }

  return signedImpactOnMember(tx, memberId);
}
