import { Transaction } from '../models';
import { memberRowsFromTransferEdges } from './debt-consolidation';
import { advanceMemberBalances } from './advance-allocation';

export interface MemberNetRow {
  memberId: string;
  /** 正數＝應收，負數＝應付 */
  net: number;
}

/** 交易卡片下方：每人應收（正）／應付（負） */
export function memberNetRowsForTransaction(tx: Transaction): MemberNetRow[] {
  if (tx.type === 'transfer') {
    const fromParticipants = tx.participants
      .map((p) => ({
        memberId: p.memberId,
        net: p.signedAmount ?? 0,
      }))
      .filter((r) => r.net !== 0);

    if (fromParticipants.length > 0) {
      return sortMemberNets(fromParticipants);
    }

    const edges = tx.transferEdges ?? [];
    if (edges.length === 0) return [];

    return sortMemberNets(
      memberRowsFromTransferEdges(edges).map((r) => ({
        memberId: r.memberId,
        net: r.signedAmount,
      }))
    );
  }

  if (tx.type === 'advance') {
    const rows: MemberNetRow[] = [];
    advanceMemberBalances(tx).forEach((net, memberId) => {
      if (net !== 0) rows.push({ memberId, net });
    });
    return sortMemberNets(rows);
  }

  if (tx.type === 'repayment') {
    const from = tx.fromMemberId;
    if (!from) return [];
    return sortMemberNets([
      { memberId: from, net: -tx.totalAmount },
      { memberId: tx.payerId, net: tx.totalAmount },
    ]);
  }

  return [];
}

function sortMemberNets(rows: MemberNetRow[]): MemberNetRow[] {
  return [...rows].sort((a, b) => b.net - a.net);
}
