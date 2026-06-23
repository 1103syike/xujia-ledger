import { Transaction, TransactionParticipant } from '../models';

/** 本地時區 YYYY-MM-DD */
export function todayLocalDate(): string {
  return formatLocalDate(new Date());
}

export function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function normalizeTransactionDate(tx: {
  date?: string | null;
  createdAt?: string;
}): string {
  if (tx.date && /^\d{4}-\d{2}-\d{2}$/.test(tx.date)) {
    return tx.date;
  }
  if (tx.createdAt) {
    return tx.createdAt.slice(0, 10);
  }
  return todayLocalDate();
}

export function formatTransactionDateLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  if (!y || !m || !d) return date;
  return new Date(y, m - 1, d).toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });
}

/** @deprecated 使用 formatTransactionDateLabel */
export const formatExpenseDateLabel = formatTransactionDateLabel;

export function compareTransactionsByDate(a: Transaction, b: Transaction): number {
  const dateCmp = normalizeTransactionDate(b).localeCompare(normalizeTransactionDate(a));
  if (dateCmp !== 0) return dateCmp;
  return (b.createdAt ?? '').localeCompare(a.createdAt ?? '');
}

/** @deprecated 使用 compareTransactionsByDate */
export const compareExpensesByDate = compareTransactionsByDate;

interface LegacySplit {
  memberId: string;
  amount: number;
  items?: TransactionParticipant['lineItems'];
  note?: string | null;
  isRemainderBearer?: boolean;
  remainderAmount?: number;
  paymentStatus?: string;
}

interface LegacyExpenseDoc {
  id: string;
  title: string;
  date?: string;
  totalAmount: number;
  billTotal?: number | null;
  payerId: string;
  participantScope?: Transaction['participantScope'];
  participantIds?: string[];
  splitMode?: Transaction['splitMode'];
  note?: string | null;
  remainderBearerId?: string | null;
  remainderAmount?: number;
  status?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  splits?: LegacySplit[];
  participants?: TransactionParticipant[];
  type?: Transaction['type'];
  fromMemberId?: string | null;
  accountId?: string;
  sourceTransactionIds?: string[];
  transferEdges?: Transaction['transferEdges'];
  settledByTransferId?: string | null;
  payers?: Transaction['payers'];
  changeAmount?: number | null;
}

function legacySplitsToParticipants(
  splits: LegacySplit[],
  payerId: string
): TransactionParticipant[] {
  return splits.map((s) => ({
    memberId: s.memberId,
    amount: s.amount,
    signedAmount: s.memberId === payerId ? s.amount : -s.amount,
    role: s.memberId === payerId ? 'payer' : 'beneficiary',
    lineItems: s.items,
    note: s.note ?? null,
    isRemainderBearer: s.isRemainderBearer,
    remainderAmount: s.remainderAmount,
  }));
}

export function normalizeTransaction(raw: LegacyExpenseDoc): Transaction {
  const type = raw.type ?? 'advance';
  const status =
    raw.status === 'cancelled' || raw.status === 'void' ? 'void' : 'active';

  if (type === 'repayment') {
    return {
      id: raw.id,
      accountId: raw.accountId ?? 'default',
      type: 'repayment',
      title: raw.title || '還款',
      date: normalizeTransactionDate(raw),
      totalAmount: raw.totalAmount,
      payerId: raw.payerId,
      fromMemberId: raw.fromMemberId ?? null,
      note: raw.note ?? null,
      status,
      createdBy: raw.createdBy,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
      participants: raw.participants ?? [
        {
          memberId: raw.fromMemberId ?? '',
          amount: raw.totalAmount,
          signedAmount: -raw.totalAmount,
        },
        {
          memberId: raw.payerId,
          amount: raw.totalAmount,
          signedAmount: raw.totalAmount,
        },
      ],
    };
  }

  if (type === 'transfer') {
    return {
      id: raw.id,
      accountId: raw.accountId ?? 'default',
      type: 'transfer',
      title: raw.title || '債務轉移',
      date: normalizeTransactionDate(raw),
      totalAmount: raw.totalAmount,
      payerId: raw.payerId ?? '',
      splitMode: 'itemized',
      note: raw.note ?? null,
      status,
      createdBy: raw.createdBy,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
      participants: raw.participants ?? [],
      sourceTransactionIds: raw.sourceTransactionIds,
      transferEdges: raw.transferEdges,
      settledByTransferId: raw.settledByTransferId ?? null,
    };
  }

  const participants =
    raw.participants ??
    legacySplitsToParticipants(raw.splits ?? [], raw.payerId);

  return {
    id: raw.id,
    accountId: raw.accountId ?? 'default',
    type: 'advance',
    title: raw.title,
    date: normalizeTransactionDate(raw),
    totalAmount: raw.totalAmount,
    billTotal: raw.billTotal ?? null,
    payerId: raw.payerId,
    payers: raw.payers,
    changeAmount: raw.changeAmount ?? null,
    participantScope: raw.participantScope ?? 'all',
    participantIds: raw.participantIds,
    splitMode: raw.splitMode ?? 'equal',
    note: raw.note ?? null,
    remainderBearerId: raw.remainderBearerId ?? null,
    remainderAmount: raw.remainderAmount,
    status,
    createdBy: raw.createdBy,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    participants,
    settledByTransferId: raw.settledByTransferId ?? null,
  };
}

/** @deprecated 使用 normalizeTransaction */
export const normalizeExpense = normalizeTransaction;

export function activeTransactions(transactions: Transaction[]): Transaction[] {
  return transactions.filter((t) => t.status === 'active');
}

export function transactionTypeLabel(type: Transaction['type']): string {
  switch (type) {
    case 'advance':
      return '代墊';
    case 'repayment':
      return '還款';
    case 'adjustment':
      return '調整';
    case 'transfer':
      return '債務轉移';
    default:
      return type;
  }
}
