import { LineItem } from '../models';

export type CreateFormMode = 'advance' | 'repayment' | 'transfer';

export interface PayerRowSnapshot {
  memberId: string;
  amount: string;
  locked: boolean;
}

export interface CreateFormSnapshot {
  mode: CreateFormMode;
  advance: {
    title: string;
    date: string;
    totalAmount: number | null;
    serviceFee: number | null;
    serviceFeeSplitMode: 'equal' | 'proportional';
    billTotal: number | null;
    skippedMembers: string[];
    noCommonShareMembers: string[];
    memberItems: Record<string, LineItem[]>;
    manualAmounts: Record<string, number>;
    splitAmountInputs: Record<string, string>;
    splitLocked: string[];
    payerRows: PayerRowSnapshot[];
    remainderSeed: string;
    activeParticipantKey: string;
  };
  repayment: {
    toMemberId: string;
    amount: number | null;
    date: string;
  };
  transfer: {
    selectedSourceIds: string[];
  };
}

function sortStrings(values: string[]): string[] {
  return [...values].sort();
}

function sortRecord<T>(record: Record<string, T>): Record<string, T> {
  return Object.fromEntries(
    Object.entries(record).sort(([a], [b]) => a.localeCompare(b))
  );
}

function normalizeLineItems(
  items: Record<string, LineItem[]>
): Record<string, LineItem[]> {
  const out: Record<string, LineItem[]> = {};
  for (const key of Object.keys(items).sort()) {
    out[key] = items[key].map((item) => ({
      note: item.note,
      amount: item.amount,
    }));
  }
  return out;
}

/** 穩定序列化，供 baseline 比對 */
export function serializeCreateFormSnapshot(
  snapshot: CreateFormSnapshot
): string {
  const normalized = {
    mode: snapshot.mode,
    advance: {
      title: snapshot.advance.title.trim(),
      date: snapshot.advance.date,
      totalAmount: snapshot.advance.totalAmount,
      serviceFee: snapshot.advance.serviceFee,
      serviceFeeSplitMode: snapshot.advance.serviceFeeSplitMode,
      billTotal: snapshot.advance.billTotal,
      skippedMembers: sortStrings(snapshot.advance.skippedMembers),
      noCommonShareMembers: sortStrings(snapshot.advance.noCommonShareMembers),
      memberItems: normalizeLineItems(snapshot.advance.memberItems),
      manualAmounts: sortRecord(snapshot.advance.manualAmounts),
      splitAmountInputs: sortRecord(snapshot.advance.splitAmountInputs),
      splitLocked: sortStrings(snapshot.advance.splitLocked),
      payerRows: snapshot.advance.payerRows.map((row) => ({
        memberId: row.memberId,
        amount: row.amount,
        locked: row.locked,
      })),
      remainderSeed: snapshot.advance.remainderSeed,
      activeParticipantKey: snapshot.advance.activeParticipantKey,
    },
    repayment: {
      toMemberId: snapshot.repayment.toMemberId,
      amount: snapshot.repayment.amount,
      date: snapshot.repayment.date,
    },
    transfer: {
      selectedSourceIds: sortStrings(snapshot.transfer.selectedSourceIds),
    },
  };
  return JSON.stringify(normalized);
}

export function createFormSnapshotsEqual(a: string, b: string): boolean {
  return a === b;
}
