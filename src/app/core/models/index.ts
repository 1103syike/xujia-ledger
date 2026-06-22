export type ParticipantScope = 'all' | 'specific';
export type SplitMode = 'equal' | 'itemized';
export type ExpenseStatus = 'open' | 'cancelled';
export type PaymentStatus = 'unpaid' | 'marked' | 'confirmed';

export interface Member {
  id: string;
  name: string;
  emoji: string;
  color: string;
}

export interface ExpenseSplit {
  memberId: string;
  amount: number;
  note?: string | null;
  paymentStatus: PaymentStatus;
  isRemainderBearer?: boolean;
  remainderAmount?: number;
  markedAt?: string | null;
  confirmedAt?: string | null;
}

export interface Expense {
  id: string;
  title: string;
  totalAmount: number;
  payerId: string;
  participantScope: ParticipantScope;
  participantIds: string[];
  splitMode: SplitMode;
  note?: string | null;
  remainderBearerId?: string | null;
  remainderAmount?: number;
  status: ExpenseStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  splits: ExpenseSplit[];
}

export interface AuditLog {
  id: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface BalanceEdge {
  fromId: string;
  toId: string;
  amount: number;
}

export interface CreateExpenseInput {
  title: string;
  totalAmount: number;
  payerId: string;
  participantScope: ParticipantScope;
  participantIds: string[];
  splitMode: SplitMode;
  note?: string | null;
  manualAmounts?: Record<string, number>;
  splitNotes?: Record<string, string | null>;
  remainderSeed?: string;
}

export const DEFAULT_MEMBERS: Member[] = [
  { id: 'm1', name: '成員一', emoji: '🌸', color: '#FFB5A7' },
  { id: 'm2', name: '成員二', emoji: '🌿', color: '#B8E8D1' },
  { id: 'm3', name: '成員三', emoji: '💜', color: '#D4C1EC' },
  { id: 'm4', name: '成員四', emoji: '⭐', color: '#FFD6A5' },
  { id: 'm5', name: '成員五', emoji: '🫧', color: '#A0C4FF' },
];
