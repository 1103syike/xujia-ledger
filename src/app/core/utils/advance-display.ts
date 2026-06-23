import { Transaction } from '../models';
import {
  advanceChangeAmount,
  advanceNetPaidByMember,
  getAdvancePayers,
} from './advance-allocation';

/** 代墊者顯示：單人「林庭郁」、多人「林庭郁、鄭丞恩」 */
export function formatAdvancePayerNames(
  tx: Transaction,
  nameOf: (id: string) => string
): string {
  const payers = getAdvancePayers(tx);
  if (payers.length === 0) return '—';
  return payers.map((p) => nameOf(p.memberId)).join('、');
}

/** 代墊者＋金額（詳情用） */
export function formatAdvancePayersDetail(
  tx: Transaction,
  nameOf: (id: string) => string
): string {
  const payers = getAdvancePayers(tx);
  if (payers.length === 0) return '—';

  const grossParts = payers.map(
    (p) => `${nameOf(p.memberId)} 實付 NT$ ${p.amount}`
  );
  const change =
    tx.changeAmount ??
    advanceChangeAmount(payers, tx.totalAmount);

  if (change <= 0) {
    if (payers.length === 1) {
      return `${nameOf(payers[0].memberId)}（NT$ ${payers[0].amount}）`;
    }
    return payers
      .map((p) => `${nameOf(p.memberId)} NT$ ${p.amount}`)
      .join('、');
  }

  const netPaid = advanceNetPaidByMember(tx);
  const netParts = payers.map((p) => {
    const net = netPaid.get(p.memberId) ?? p.amount;
    return `${nameOf(p.memberId)} 淨 NT$ ${net}`;
  });

  return `${grossParts.join('、')} · 找零 NT$ ${change} · ${netParts.join('、')}`;
}
