import {
  LineItem,
  Transaction,
  TransactionParticipant,
  TransferEdge,
} from '../models';
import { COPY_ERRORS, COPY_RECORD_TYPE } from '../../copy';
import { advanceSettlementEdges } from '../transactions/advance-allocation';

export interface MemberConsolidationRow {
  memberId: string;
  signedAmount: number;
  lineItems: LineItem[];
}

export interface ConsolidationPreview {
  edges: TransferEdge[];
  members: MemberConsolidationRow[];
  totalTransferVolume: number;
  hasDebts: boolean;
}

const TRANSFER_ITEM_NOTE = COPY_RECORD_TYPE.consolidate;

export function isConsolidatable(tx: Transaction): boolean {
  return (
    tx.status === 'active' &&
    tx.type === 'advance' &&
    !tx.settledByTransferId
  );
}

/** 每人淨額：正數＝應收，負數＝應付（僅計勾選的代墊） */
export function memberNetBalances(transactions: Transaction[]): Map<string, number> {
  const nets = new Map<string, number>();

  for (const tx of transactions) {
    if (!isConsolidatable(tx)) continue;

    for (const e of advanceSettlementEdges(tx)) {
      nets.set(e.fromId, (nets.get(e.fromId) ?? 0) - e.amount);
      nets.set(e.toId, (nets.get(e.toId) ?? 0) + e.amount);
    }
  }

  return nets;
}

/**
 * 將淨額壓成最少筆轉帳（貪婪配對，最多 n−1 筆）
 * from 付給 to
 */
export function minimizeTransfers(nets: Map<string, number>): TransferEdge[] {
  const debtors: Array<{ id: string; remaining: number }> = [];
  const creditors: Array<{ id: string; remaining: number }> = [];

  nets.forEach((net, id) => {
    if (net < 0) debtors.push({ id, remaining: -net });
    else if (net > 0) creditors.push({ id, remaining: net });
  });

  debtors.sort((a, b) => b.remaining - a.remaining);
  creditors.sort((a, b) => b.remaining - a.remaining);

  const edges: TransferEdge[] = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].remaining, creditors[j].remaining);
    if (pay > 0) {
      edges.push({
        fromId: debtors[i].id,
        toId: creditors[j].id,
        amount: pay,
      });
    }
    debtors[i].remaining -= pay;
    creditors[j].remaining -= pay;
    if (debtors[i].remaining === 0) i++;
    if (creditors[j].remaining === 0) j++;
  }

  return edges.sort((a, b) => b.amount - a.amount);
}

export function buildConsolidationPreview(
  selected: Transaction[],
  _allMemberIds: string[]
): ConsolidationPreview {
  const nets = memberNetBalances(selected);
  const transferEdges = minimizeTransfers(nets);

  const payLines = new Map<string, LineItem[]>();
  const receiveLines = new Map<string, LineItem[]>();

  for (const e of transferEdges) {
    const payList = payLines.get(e.fromId) ?? [];
    payList.push({
      note: TRANSFER_ITEM_NOTE,
      amount: e.amount,
      counterpartyId: e.toId,
      direction: 'pay',
    });
    payLines.set(e.fromId, payList);

    const recvList = receiveLines.get(e.toId) ?? [];
    recvList.push({
      note: TRANSFER_ITEM_NOTE,
      amount: e.amount,
      counterpartyId: e.fromId,
      direction: 'receive',
    });
    receiveLines.set(e.toId, recvList);
  }

  const involved = new Set<string>();
  for (const e of transferEdges) {
    involved.add(e.fromId);
    involved.add(e.toId);
  }

  const members: MemberConsolidationRow[] = [...involved].map((memberId) => {
    const pays = payLines.get(memberId) ?? [];
    const receives = receiveLines.get(memberId) ?? [];
    return {
      memberId,
      signedAmount: nets.get(memberId) ?? 0,
      lineItems: [...pays, ...receives],
    };
  });

  members.sort((a, b) => b.signedAmount - a.signedAmount);

  const totalTransferVolume = transferEdges.reduce((s, e) => s + e.amount, 0);

  return {
    edges: transferEdges,
    members,
    totalTransferVolume,
    hasDebts: transferEdges.length > 0,
  };
}

export function memberRowsFromTransferEdges(
  edges: TransferEdge[]
): MemberConsolidationRow[] {
  const nets = new Map<string, number>();
  const payLines = new Map<string, LineItem[]>();
  const receiveLines = new Map<string, LineItem[]>();

  for (const e of edges) {
    nets.set(e.fromId, (nets.get(e.fromId) ?? 0) - e.amount);
    nets.set(e.toId, (nets.get(e.toId) ?? 0) + e.amount);

    const payList = payLines.get(e.fromId) ?? [];
    payList.push({
      note: TRANSFER_ITEM_NOTE,
      amount: e.amount,
      counterpartyId: e.toId,
      direction: 'pay',
    });
    payLines.set(e.fromId, payList);

    const recvList = receiveLines.get(e.toId) ?? [];
    recvList.push({
      note: TRANSFER_ITEM_NOTE,
      amount: e.amount,
      counterpartyId: e.fromId,
      direction: 'receive',
    });
    receiveLines.set(e.toId, recvList);
  }

  const involved = new Set<string>();
  for (const e of edges) {
    involved.add(e.fromId);
    involved.add(e.toId);
  }

  return [...involved]
    .map((memberId) => ({
      memberId,
      signedAmount: nets.get(memberId) ?? 0,
      lineItems: [
        ...(payLines.get(memberId) ?? []),
        ...(receiveLines.get(memberId) ?? []),
      ],
    }))
    .sort((a, b) => b.signedAmount - a.signedAmount);
}

export function consolidationToParticipants(
  preview: ConsolidationPreview
): TransactionParticipant[] {
  return preview.members.map((row) => ({
    memberId: row.memberId,
    amount: Math.abs(row.signedAmount),
    signedAmount: row.signedAmount,
    lineItems: row.lineItems,
  }));
}

export function transferLineLabel(
  item: LineItem,
  memberName: (id: string) => string
): string {
  const who = item.counterpartyId ? memberName(item.counterpartyId) : '—';
  if (item.direction === 'pay') return `付給 ${who}`;
  if (item.direction === 'receive') return `收自 ${who}`;
  return item.note;
}

export function validateConsolidationInput(
  sourceIds: string[],
  allTransactions: Transaction[],
  allMemberIds: string[]
): string | null {
  if (sourceIds.length === 0) return COPY_ERRORS.consolidatePickOne;
  const byId = new Map(allTransactions.map((t) => [t.id, t]));
  for (const id of sourceIds) {
    const tx = byId.get(id);
    if (!tx) return COPY_ERRORS.consolidateNotFound;
    if (!isConsolidatable(tx)) return COPY_ERRORS.consolidateOnlyActive;
  }
  const selected = sourceIds.map((id) => byId.get(id)!);
  const preview = buildConsolidationPreview(selected, allMemberIds);
  if (!preview.hasDebts) return COPY_ERRORS.consolidateNoDebt;
  return null;
}
