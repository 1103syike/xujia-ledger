import { AdvancePayer, BalanceEdge, Transaction } from '../models';
import { COPY_ERRORS } from '../../copy';

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

/** 依實付比例分配找零（各代墊者應退回的金額） */
export function advanceChangeShareByMember(
  tx: Transaction
): Map<string, number> {
  const payers = getAdvancePayers(tx);
  const grossTotal = advanceGrossPaidTotal(payers);
  const change = advanceChangeAmount(payers, tx.totalAmount);
  const shares = new Map<string, number>();

  if (change <= 0 || grossTotal <= 0) return shares;

  for (const p of payers) {
    shares.set(p.memberId, Math.round((change * p.amount) / grossTotal));
  }

  const sum = [...shares.values()].reduce((s, v) => s + v, 0);
  const diff = change - sum;
  if (diff !== 0) {
    const top = [...payers].sort((a, b) => b.amount - a.amount)[0];
    if (top) shares.set(top.memberId, (shares.get(top.memberId) ?? 0) + diff);
  }

  return shares;
}

/**
 * 計入結算的實際代墊：實付 − 依比例分回的找零
 * 例：帳單 1486，各付 1000 → 找零 514，每人淨代墊 743
 */
export function advanceNetPaidByMember(tx: Transaction): Map<string, number> {
  const payers = getAdvancePayers(tx);
  const changeShares = advanceChangeShareByMember(tx);
  const net = new Map<string, number>();

  if (advanceGrossPaidTotal(payers) <= 0) return net;

  for (const p of payers) {
    net.set(p.memberId, p.amount - (changeShares.get(p.memberId) ?? 0));
  }

  const change = advanceChangeAmount(payers, tx.totalAmount);
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

/**
 * 分攤明細顯示用淨額（結算邏輯不變）
 * 免分攤代墊者：顯示實付全額收回（找錢另列明細）
 */
export function memberNetDisplayAmount(
  tx: Transaction,
  memberId: string
): number {
  const settlementNet = advanceMemberBalances(tx).get(memberId) ?? 0;
  if (tx.type !== 'advance' || settlementNet <= 0) return settlementNet;

  const payer = getAdvancePayers(tx).find((p) => p.memberId === memberId);
  if (!payer) return settlementNet;

  const share = advanceSharesByMember(tx).get(memberId) ?? 0;
  const changeShare = advanceChangeShareByMember(tx).get(memberId) ?? 0;
  if (changeShare <= 0 || share > 0) return settlementNet;

  return payer.amount;
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
  if (payers.length === 0) return COPY_ERRORS.payerRequired;
  const ids = new Set<string>();
  let sum = 0;
  for (const p of payers) {
    if (!p.memberId) return COPY_ERRORS.payerPick;
    if (ids.has(p.memberId)) return COPY_ERRORS.payerDuplicate;
    ids.add(p.memberId);
    if (p.amount <= 0) return COPY_ERRORS.payerAmountPositive;
    sum += p.amount;
  }
  if (sum < totalAmount) {
    return COPY_ERRORS.payerTotalShort(sum, totalAmount);
  }
  return null;
}

export function primaryPayerId(payers: AdvancePayer[]): string {
  return payers[0]?.memberId ?? '';
}
