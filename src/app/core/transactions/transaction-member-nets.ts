import { Transaction } from '../models';
import { memberRowsFromTransferEdges } from '../consolidation/debt-consolidation';
import {
  advanceMemberBalances,
  memberNetDisplayAmount,
} from '../transactions/advance-allocation';
import { enrichRepaymentOwedBefore } from '../ledger/ledger-calculator';
import { repaymentMemberNetRows } from './repayment-display';

export interface MemberNetRow {
  memberId: string;
  /** 正數＝應收，負數＝應付（結算用） */
  net: number;
  /** 分攤明細顯示用；與 net 不同時優先顯示 */
  displayNet?: number;
}

/**
 * 交易卡片下方：每人應收（正）／應付（負）
 * @param allTransactions 可選，還款超額時用來回推當時欠額（舊資料沒存 repaymentOwedBefore）
 */
export function memberNetRowsForTransaction(
  tx: Transaction,
  allTransactions?: Transaction[]
): MemberNetRow[] {
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
      if (net === 0) return;
      const displayNet = memberNetDisplayAmount(tx, memberId);
      rows.push({
        memberId,
        net,
        displayNet: displayNet !== net ? displayNet : undefined,
      });
    });
    return sortMemberNets(rows);
  }

  if (tx.type === 'repayment') {
    return sortMemberNets(
      repaymentMemberNetRows(enrichRepaymentOwedBefore(tx, allTransactions))
    );
  }

  return [];
}

function sortMemberNets(rows: MemberNetRow[]): MemberNetRow[] {
  return [...rows].sort(
    (a, b) => (b.displayNet ?? b.net) - (a.displayNet ?? a.net)
  );
}
