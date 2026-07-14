import { Transaction } from '../models';
import { COPY_RECORD_TYPE } from '../../copy';

export type RepaymentNetRow = {
  memberId: string;
  /** 正＝應收（債主），負＝應付（丐幫） */
  net: number;
};

/** 還款金額是否超過當下欠額 */
export function isRepaymentOverpay(tx: Transaction): boolean {
  if (tx.type !== 'repayment') return false;
  const owedBefore = tx.repaymentOwedBefore;
  return (
    owedBefore != null && owedBefore >= 0 && tx.totalAmount > owedBefore
  );
}

/** 列表／明細標題：超額還款（欠款/還款） */
export function formatRepaymentTitle(tx: Transaction): string {
  if (tx.type !== 'repayment') return tx.title;
  if (!isRepaymentOverpay(tx)) {
    return tx.title || COPY_RECORD_TYPE.repayment;
  }
  const owed = tx.repaymentOwedBefore ?? 0;
  return `${COPY_RECORD_TYPE.repaymentOverpay}（${owed}/${tx.totalAmount}）`;
}

/**
 * 還款卡片每人淨額：
 * - 一般還款：付款人 −、收款人 +（現金流）
 * - 超額還款：只顯示反轉殘額，付款人變債主（+）、原債主變丐幫（−）
 * 需先帶上 repaymentOwedBefore（建立時寫入，或由 enrich 回推）
 */
export function repaymentMemberNetRows(tx: Transaction): RepaymentNetRow[] {
  const from = tx.fromMemberId;
  if (!from) return [];

  const to = tx.payerId;
  const amount = tx.totalAmount;
  const owedBefore = tx.repaymentOwedBefore;

  if (isRepaymentOverpay(tx) && owedBefore != null) {
    const excess = amount - owedBefore;
    return sortByNet([
      { memberId: from, net: excess },
      { memberId: to, net: -excess },
    ]);
  }

  return sortByNet([
    { memberId: from, net: -amount },
    { memberId: to, net: amount },
  ]);
}

export function repaymentSignedImpact(
  tx: Transaction,
  memberId: string
): number {
  return (
    repaymentMemberNetRows(tx).find((row) => row.memberId === memberId)?.net ??
    0
  );
}

/** 還款後應收方（正淨額）— 用來掛金主 badge */
export function repaymentCreditorIds(tx: Transaction): string[] {
  return repaymentMemberNetRows(tx)
    .filter((row) => row.net > 0)
    .map((row) => row.memberId);
}

function sortByNet(rows: RepaymentNetRow[]): RepaymentNetRow[] {
  return [...rows].sort((a, b) => b.net - a.net);
}
