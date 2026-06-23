import { AdvancePayer, BalanceEdge, Transaction } from '../models';

/** 讀取代墊者（相容舊資料的單一 payerId） */
export function getAdvancePayers(tx: Transaction): AdvancePayer[] {
  if (tx.payers?.length) {
    return tx.payers.filter((p) => p.amount > 0);
  }
  if (tx.payerId && tx.totalAmount > 0) {
    return [{ memberId: tx.payerId, amount: tx.totalAmount }];
  }
  return [];
}

export function advanceGrossPaidTotal(payers: AdvancePayer[]): number {
  return payers.reduce((sum, p) => sum + p.amount, 0);
}

/** 實付超過帳單／分攤總額的找零 */
export function advanceChangeAmount(
  payers: AdvancePayer[],
  billTotal: number
): number {
  if (billTotal <= 0) return 0;
  return Math.max(0, advanceGrossPaidTotal(payers) - billTotal);
}

/**
 * 計入結算的實際代墊：實付 − 依比例分回的找零
 * 例：帳單 1486，各付 1000 → 找零 514，每人淨代墊 743
 */
export function advanceNetPaidByMember(tx: Transaction): Map<string, number> {
  const payers = getAdvancePayers(tx);
  const grossTotal = advanceGrossPaidTotal(payers);
  const change = advanceChangeAmount(payers, tx.totalAmount);
  const net = new Map<string, number>();

  if (grossTotal <= 0) return net;

  for (const p of payers) {
    const changeShare =
      change > 0 ? Math.round((change * p.amount) / grossTotal) : 0;
    net.set(p.memberId, p.amount - changeShare);
  }

  if (change > 0) {
    const netSum = [...net.values()].reduce((s, v) => s + v, 0);
    const diff = tx.totalAmount - netSum;
    if (diff !== 0) {
      const top = [...payers].sort((a, b) => b.amount - a.amount)[0];
      if (top) net.set(top.memberId, (net.get(top.memberId) ?? 0) + diff);
    }
  }

  return net;
}

/** 每人分攤金額 */
export function advanceSharesByMember(tx: Transaction): Map<string, number> {
  const shares = new Map<string, number>();
  for (const p of tx.participants) {
    if (p.amount <= 0) continue;
    shares.set(p.memberId, (shares.get(p.memberId) ?? 0) + p.amount);
  }
  return shares;
}

/** 每人淨額：淨代墊 − 分攤（正＝應收，負＝應付） */
export function advanceMemberBalances(tx: Transaction): Map<string, number> {
  const balances = new Map<string, number>();
  const netPaid = advanceNetPaidByMember(tx);
  const shares = advanceSharesByMember(tx);
  const members = new Set([...netPaid.keys(), ...shares.keys()]);

  for (const id of members) {
    const paid = netPaid.get(id) ?? 0;
    const share = shares.get(id) ?? 0;
    balances.set(id, paid - share);
  }

  return balances;
}

/** 將負債依債權人淨應收比例分配成 pairwise 邊 */
export function advanceSettlementEdges(tx: Transaction): BalanceEdge[] {
  const balances = advanceMemberBalances(tx);
  const debtors: Array<{ id: string; amount: number }> = [];
  const creditors: Array<{ id: string; amount: number }> = [];

  balances.forEach((bal, id) => {
    if (bal < 0) debtors.push({ id, amount: -bal });
    else if (bal > 0) creditors.push({ id, amount: bal });
  });

  if (debtors.length === 0 || creditors.length === 0) return [];

  const totalCredit = creditors.reduce((s, c) => s + c.amount, 0);
  if (totalCredit <= 0) return [];

  const edges: BalanceEdge[] = [];
  for (const debtor of debtors) {
    for (const alloc of allocateProportional(
      debtor.amount,
      creditors,
      totalCredit
    )) {
      if (alloc.amount > 0) {
        edges.push({
          fromId: debtor.id,
          toId: alloc.creditorId,
          amount: alloc.amount,
        });
      }
    }
  }

  return mergeBalanceEdges(edges);
}

function allocateProportional(
  debt: number,
  creditors: Array<{ id: string; amount: number }>,
  totalCredit: number
): Array<{ creditorId: string; amount: number }> {
  const exact = creditors.map((c) => ({
    creditorId: c.id,
    raw: (debt * c.amount) / totalCredit,
  }));
  const result = exact.map((e) => ({
    creditorId: e.creditorId,
    amount: Math.floor(e.raw),
    frac: e.raw - Math.floor(e.raw),
  }));

  let remainder = debt - result.reduce((s, r) => s + r.amount, 0);
  const order = [...result].sort((a, b) => b.frac - a.frac);
  for (const row of order) {
    if (remainder <= 0) break;
    row.amount += 1;
    remainder--;
  }

  return result.map((r) => ({ creditorId: r.creditorId, amount: r.amount }));
}

function mergeBalanceEdges(edges: BalanceEdge[]): BalanceEdge[] {
  const map = new Map<string, number>();
  for (const e of edges) {
    const key = `${e.fromId}->${e.toId}`;
    map.set(key, (map.get(key) ?? 0) + e.amount);
  }
  return [...map.entries()]
    .filter(([, amount]) => amount > 0)
    .map(([key, amount]) => {
      const [fromId, toId] = key.split('->');
      return { fromId, toId, amount };
    });
}

export function validateAdvancePayers(
  payers: AdvancePayer[],
  totalAmount: number
): string | null {
  if (payers.length === 0) return '請至少選擇一位代墊者';
  const ids = new Set<string>();
  let sum = 0;
  for (const p of payers) {
    if (!p.memberId) return '請選擇代墊者';
    if (ids.has(p.memberId)) return '代墊者不可重複';
    ids.add(p.memberId);
    if (p.amount <= 0) return '代墊金額必須大於 0';
    sum += p.amount;
  }
  if (sum < totalAmount) {
    return `代墊合計（NT$ ${sum}）不可少於分攤總額（NT$ ${totalAmount}）`;
  }
  return null;
}

export function primaryPayerId(payers: AdvancePayer[]): string {
  return payers[0]?.memberId ?? '';
}
