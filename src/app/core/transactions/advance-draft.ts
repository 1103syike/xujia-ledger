import {
  AdvancePayer,
  CreateAdvanceInput,
  LineItem,
  Member,
  SplitMode,
  Transaction,
} from '../models';
import { advanceChangeAmount } from '../transactions/advance-allocation';
import { filterManualLineItems } from './advance-display';

/** 使用者語言：分攤規則 */
export type SplitRule = 'equal' | 'custom';

/** 自訂分攤的輸入方式（同一資料模型） */
export type CustomInputMethod = 'lineItems' | 'direct';

export interface AdvanceStickySummary {
  splitTotal: number;
  grossPaid: number;
  change: number;
  paymentShortfall: number;
}

export function splitRuleToSplitMode(rule: SplitRule): SplitMode {
  return rule === 'equal' ? 'equal' : 'itemized';
}

export function inferSplitRuleFromTransaction(tx: Transaction): {
  splitRule: SplitRule;
  customInputMethod: CustomInputMethod;
} {
  if (tx.splitMode !== 'itemized') {
    return { splitRule: 'equal', customInputMethod: 'lineItems' };
  }

  const hasLineItems = tx.participants.some(
    (p) => filterManualLineItems(p.lineItems).length > 0
  );
  return {
    splitRule: 'custom',
    customInputMethod: hasLineItems ? 'lineItems' : 'direct',
  };
}

/** 依草稿狀態推斷後端 split 模式（UI 不讓使用者選） */
export function inferSplitDraftMode(params: {
  allMemberIds: string[];
  excludedMemberIds: string[];
  totalAmount: number;
  manualAmounts: Record<string, number>;
  memberItems: Record<string, unknown[]>;
  splitLockedIds: string[];
}): { splitRule: SplitRule; customInputMethod: CustomInputMethod } {
  const hasLineItems = Object.values(params.memberItems).some(
    (items) => items.length > 0
  );
  if (hasLineItems) {
    return { splitRule: 'custom', customInputMethod: 'lineItems' };
  }

  if (params.splitLockedIds.length === 0 && params.totalAmount > 0) {
    return { splitRule: 'equal', customInputMethod: 'lineItems' };
  }

  return { splitRule: 'custom', customInputMethod: 'direct' };
}

export function computeStickySummary(
  splitTotal: number,
  payers: AdvancePayer[]
): AdvanceStickySummary {
  const grossPaid = payers.reduce((sum, p) => sum + p.amount, 0);
  const change =
    splitTotal > 0 ? advanceChangeAmount(payers, splitTotal) : 0;
  const paymentShortfall =
    splitTotal > 0 && grossPaid > 0 && grossPaid < splitTotal
      ? splitTotal - grossPaid
      : 0;

  return { splitTotal, grossPaid, change, paymentShortfall };
}

export interface BuildAdvanceInputParams {
  title: string;
  date: string;
  note: string | null;
  splitRule: SplitRule;
  customInputMethod: CustomInputMethod;
  splitTotal: number;
  chartBillTotal: number | null;
  payers: AdvancePayer[];
  members: Member[];
  excludedMemberIds: string[];
  manualAmounts: Record<string, number>;
  splitItems?: Record<string, LineItem[]>;
  remainderSeed: string;
  equalTotalAmount?: number | null;
}

/** 將 UI draft 映射為既有 CreateAdvanceInput */
export function buildAdvanceInputFromDraft(
  params: BuildAdvanceInputParams
): CreateAdvanceInput {
  const splitMode = splitRuleToSplitMode(params.splitRule);
  const hasSplitItems =
    params.splitRule === 'custom' &&
    params.customInputMethod === 'lineItems' &&
    params.splitItems &&
    Object.keys(params.splitItems).length > 0;

  return {
    title: params.title,
    date: params.date,
    totalAmount: params.splitTotal,
    billTotal: params.chartBillTotal,
    payerId: params.payers[0]?.memberId ?? '',
    payers: params.payers,
    participantScope: 'all',
    participantIds: params.members.map((m) => m.id),
    splitMode,
    note: params.note,
    splitItems: hasSplitItems ? params.splitItems : undefined,
    manualAmounts: { ...params.manualAmounts },
    excludedMemberIds: [...params.excludedMemberIds],
    remainderSeed: params.remainderSeed,
  };
}
