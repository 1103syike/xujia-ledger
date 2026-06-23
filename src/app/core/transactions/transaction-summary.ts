import { Transaction } from '../models';
import { COPY_SPLIT } from '../../copy';
import {
  advanceChangeAmount,
  getAdvancePayers,
} from '../transactions/advance-allocation';
import { filterManualLineItems, formatAdvancePayerNames } from './advance-display';

/** @deprecated 使用 formatTransactionStoryLine */
export const formatTransactionSummaryLine = formatTransactionStoryLine;

/** 帳本列表副標：林庭郁 付款 · 五人均分 */
export function formatTransactionStoryLine(
  tx: Transaction,
  nameOf: (id: string) => string
): string {
  if (tx.type === 'advance') {
    const payers = getAdvancePayers(tx);
    const payerNames = formatAdvancePayerNames(tx, nameOf);
    const payerPart = `${payerNames} 付款`;
    const splitPart = describeSplit(tx, nameOf);
    const change = tx.changeAmount ?? advanceChangeAmount(payers, tx.totalAmount);
    const parts = [payerPart];
    if (splitPart) parts.push(splitPart);
    if (change > 0) parts.push(`找零 NT$ ${change}`);
    return parts.join(' · ');
  }

  if (tx.type === 'repayment') {
    const from = nameOf(tx.fromMemberId ?? '');
    const to = nameOf(tx.payerId);
    return `${from} 還給 ${to}`;
  }

  if (tx.type === 'transfer') {
    const n = tx.sourceTransactionIds?.length ?? 0;
    return `整合了 ${n} 筆記錄`;
  }

  return '';
}

/** 展開區：分攤描述 */
export function formatTransactionSplitDetail(
  tx: Transaction,
  nameOf: (id: string) => string
): string {
  if (tx.type !== 'advance') return '';
  const split = describeSplit(tx, nameOf);
  return split ? `NT$ ${tx.totalAmount} · ${split}` : `NT$ ${tx.totalAmount}`;
}

/** 展開區：付款描述 */
export function formatTransactionPaymentDetail(
  tx: Transaction,
  nameOf: (id: string) => string
): string {
  if (tx.type === 'advance') {
    const payers = getAdvancePayers(tx);
    if (payers.length === 0) return '—';
    if (payers.length === 1) {
      return `${nameOf(payers[0].memberId)} 實付 NT$ ${payers[0].amount}`;
    }
    return payers
      .map((p) => `${nameOf(p.memberId)} NT$ ${p.amount}`)
      .join('、');
  }

  if (tx.type === 'repayment') {
    return `${nameOf(tx.fromMemberId ?? '')} → ${nameOf(tx.payerId)} · NT$ ${tx.totalAmount}`;
  }

  return '';
}

function describeSplit(
  tx: Transaction,
  nameOf: (id: string) => string
): string {
  const shares = tx.participants.filter((p) => p.amount > 0);
  if (shares.length === 0) return '';

  if (tx.splitMode === 'equal' || isEqualShares(shares)) {
    if (shares.length === 1) {
      return COPY_SPLIT.bears(nameOf(shares[0].memberId));
    }
    return COPY_SPLIT.nPeople(shares.length);
  }

  const itemNames = collectItemNames(tx);
  if (itemNames.length > 0) {
    if (itemNames.length === 1) return itemNames[0];
    if (itemNames.length === 2) return `${itemNames[0]}、${itemNames[1]}`;
    return `${itemNames[0]}、${itemNames[1]} 等`;
  }

  if (shares.length === 1) {
    return `${nameOf(shares[0].memberId)} NT$ ${shares[0].amount}`;
  }

  return '每人金額不同';
}

function isEqualShares(
  shares: Array<{ amount: number }>
): boolean {
  if (shares.length <= 1) return true;
  const first = shares[0].amount;
  return shares.every((s) => s.amount === first);
}

function collectItemNames(tx: Transaction): string[] {
  const names: string[] = [];
  for (const p of tx.participants) {
    for (const item of filterManualLineItems(p.lineItems)) {
      if (item.note.trim()) names.push(item.note.trim());
    }
  }
  return names;
}
