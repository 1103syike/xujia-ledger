import { Transaction } from '../models';
import { COPY_TERMS } from '../../copy';
import { getAdvancePayers } from '../transactions/advance-allocation';
import { signedImpactOnMember } from '../ledger/ledger-calculator';
import { formatOweAmount, formatOwedAmount } from '../ledger/settlement-display';

export type ViewerImpactKind = 'receivable' | 'payable' | 'neutral' | 'amount';

export interface ViewerImpactDisplay {
  kind: ViewerImpactKind;
  label: string;
  amountText: string;
}

/** 此筆記錄是否與 memberId 有帳務關係（付款人或分攤者） */
export function isViewerInvolvedInTransaction(
  tx: Transaction,
  memberId: string
): boolean {
  if (!memberId) return false;

  if (tx.type === 'repayment') {
    return tx.fromMemberId === memberId || tx.payerId === memberId;
  }

  if (tx.type === 'transfer') {
    if (
      tx.transferEdges?.some(
        (e) => e.fromId === memberId || e.toId === memberId
      )
    ) {
      return true;
    }
    return tx.participants.some((p) => {
      if (p.memberId !== memberId) return false;
      const signed = p.signedAmount ?? p.amount;
      return signed !== 0;
    });
  }

  if (tx.type === 'advance') {
    const isPayer = getAdvancePayers(tx).some((p) => p.memberId === memberId);
    const share =
      tx.participants.find((p) => p.memberId === memberId)?.amount ?? 0;
    return isPayer || share > 0;
  }

  return false;
}

/** 列表卡片右上角：這筆記錄對目前使用者的帳務影響 */
export function formatViewerImpact(
  tx: Transaction,
  memberId: string,
  allTransactions?: Transaction[]
): ViewerImpactDisplay {
  const impact = memberId
    ? signedImpactOnMember(tx, memberId, allTransactions)
    : 0;

  if (tx.type === 'transfer') {
    return {
      kind: 'amount',
      label: '金額',
      amountText: `NT$ ${tx.totalAmount}`,
    };
  }

  if (impact > 0) {
    return {
      kind: 'receivable',
      label: COPY_TERMS.oweYou,
      amountText: `+${formatOwedAmount(impact)}`,
    };
  }

  if (impact < 0) {
    return {
      kind: 'payable',
      label: COPY_TERMS.youOwe,
      amountText: formatOweAmount(-impact),
    };
  }

  if (!memberId || !isViewerInvolvedInTransaction(tx, memberId)) {
    return {
      kind: 'neutral',
      label: COPY_TERMS.unrelated,
      amountText: '',
    };
  }

  return {
    kind: 'neutral',
    label: COPY_TERMS.offset,
    amountText: '',
  };
}
