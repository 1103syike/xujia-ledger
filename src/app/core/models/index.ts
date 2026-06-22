export type ParticipantScope = 'all' | 'specific';
export type SplitMode = 'equal' | 'itemized';
export type ExpenseStatus = 'open' | 'cancelled';
export type PaymentStatus = 'unpaid' | 'marked' | 'confirmed';

export type { DisplayMember, MemberProfile, ThemeColors, ThemePreset, ThemePresetId } from './member-profile';
export {
  DEFAULT_THEME,
  DEFAULT_THEME_PRESET_ID,
  displayNameOf,
  FIREBASE_INTERNAL_PASSWORD,
  getThemePreset,
  resolveThemeColors,
  THEME_PRESETS,
} from './member-profile';

export interface Member {
  id: string;
  name: string;
  emoji: string;
  color: string;
  loginEmail: string;
}

export interface ExpenseLineItem {
  note: string;
  amount: number;
}

export interface ExpenseSplit {
  memberId: string;
  amount: number;
  items?: ExpenseLineItem[];
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
  billTotal?: number | null;
  payerId: string;
  participantScope: ParticipantScope;
  participantIds: string[];
  splitMode: SplitMode;
  note?: string | null;
  lineItems?: ExpenseLineItem[];
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
  billTotal?: number | null;
  payerId: string;
  participantScope: ParticipantScope;
  participantIds: string[];
  splitMode: SplitMode;
  note?: string | null;
  splitItems?: Record<string, ExpenseLineItem[]>;
  manualAmounts?: Record<string, number>;
  splitNotes?: Record<string, string | null>;
  excludedMemberIds?: string[];
  remainderSeed?: string;
}

export const DEFAULT_MEMBERS: Member[] = [
  { id: 'm1', name: '林庭郁', emoji: '🌸', color: '#FFB5A7', loginEmail: 'm1@xujia-ledger.app' },
  { id: 'm2', name: '鄭丞恩', emoji: '🌿', color: '#B8E8D1', loginEmail: 'm2@xujia-ledger.app' },
  { id: 'm3', name: '林榆凱', emoji: '💜', color: '#D4C1EC', loginEmail: 'm3@xujia-ledger.app' },
  { id: 'm4', name: '許育愷', emoji: '⭐', color: '#FFD6A5', loginEmail: 'm4@xujia-ledger.app' },
  { id: 'm5', name: '黃品瑜', emoji: '🫧', color: '#A0C4FF', loginEmail: 'm5@xujia-ledger.app' },
];
