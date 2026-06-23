export type ParticipantScope = 'all' | 'specific';
export type SplitMode = 'equal' | 'itemized';
export type TransactionType = 'advance' | 'repayment' | 'adjustment' | 'transfer';
export type TransactionStatus = 'active' | 'void';

export type {
  AvatarChoice,
  AvatarSlotId,
  AvatarSlotTimestamps,
  ChibiId,
  DisplayMember,
  MemberColorOption,
  MemberProfile,
  ThemeColors,
  ThemePreset,
  ThemePresetId,
} from './member-profile';
export {
  AVATAR_SLOT_IDS,
  CHIBI_IDS,
  DEFAULT_THEME,
  DEFAULT_THEME_PRESET_ID,
  defaultAvatarChoice,
  defaultChibiForMember,
  displayNameOf,
  effectiveChibiId,
  FIREBASE_INTERNAL_PASSWORD,
  getThemePreset,
  memberColorLabel,
  MEMBER_COLOR_OPTIONS,
  normalizeThemePresetId,
  resolveAvatarChoice,
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

export interface LineItem {
  note: string;
  amount: number;
}

export interface TransactionParticipant {
  memberId: string;
  /** 分攤金額（代墊時 ≥ 0） */
  amount: number;
  signedAmount?: number;
  role?: 'payer' | 'beneficiary';
  lineItems?: LineItem[];
  note?: string | null;
  isRemainderBearer?: boolean;
  remainderAmount?: number;
}

export interface Transaction {
  id: string;
  accountId: string;
  type: TransactionType;
  title: string;
  /** 交易日期 YYYY-MM-DD（本地） */
  date?: string;
  totalAmount: number;
  billTotal?: number | null;
  /** 代墊者（advance）或還款收款人（repayment） */
  payerId: string;
  /** 還款付款人（repayment only） */
  fromMemberId?: string | null;
  participantScope?: ParticipantScope;
  participantIds?: string[];
  splitMode?: SplitMode;
  note?: string | null;
  remainderBearerId?: string | null;
  remainderAmount?: number;
  status: TransactionStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  participants: TransactionParticipant[];
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

export interface SettlementEntry {
  otherId: string;
  direction: 'owe' | 'owed';
  amount: number;
}

export interface CreateAdvanceInput {
  title: string;
  date: string;
  totalAmount: number;
  billTotal?: number | null;
  payerId: string;
  participantScope: ParticipantScope;
  participantIds: string[];
  splitMode: SplitMode;
  note?: string | null;
  splitItems?: Record<string, LineItem[]>;
  manualAmounts?: Record<string, number>;
  splitNotes?: Record<string, string | null>;
  excludedMemberIds?: string[];
  remainderSeed?: string;
}

export interface CreateRepaymentInput {
  fromMemberId: string;
  toMemberId: string;
  amount: number;
  date: string;
  note?: string | null;
}

/** @deprecated 使用 CreateAdvanceInput */
export type CreateExpenseInput = CreateAdvanceInput;

/** @deprecated 使用 LineItem */
export type ExpenseLineItem = LineItem;

/** @deprecated 使用 TransactionParticipant */
export type ExpenseSplit = TransactionParticipant;

/** @deprecated 使用 Transaction */
export type Expense = Transaction;

export const DEFAULT_ACCOUNT_ID = 'default';

export const DEFAULT_MEMBERS: Member[] = [
  { id: 'm1', name: '林庭郁', emoji: '🌸', color: '#FFB5A7', loginEmail: 'm1@xujia-ledger.app' },
  { id: 'm2', name: '鄭丞恩', emoji: '🌿', color: '#B8E8D1', loginEmail: 'm2@xujia-ledger.app' },
  { id: 'm3', name: '林榆凱', emoji: '💜', color: '#D4C1EC', loginEmail: 'm3@xujia-ledger.app' },
  { id: 'm4', name: '許育愷', emoji: '⭐', color: '#FFD6A5', loginEmail: 'm4@xujia-ledger.app' },
  { id: 'm5', name: '黃品瑜', emoji: '🫧', color: '#A0C4FF', loginEmail: 'm5@xujia-ledger.app' },
];
