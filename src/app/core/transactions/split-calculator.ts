import {
  CreateAdvanceInput,
  LineItem,
  Member,
  TransactionParticipant,
} from '../models';
import { COPY_ERRORS } from '../../copy';
import { primaryPayerId, validateAdvancePayers } from '../transactions/advance-allocation';
import {
  applyServiceFeeToSplitPreview,
  normalizeServiceFeeSplitMode,
} from './service-fee-split';

export interface SplitPreviewLine {
  memberId: string;
  amount: number;
  isRemainderBearer: boolean;
  remainderAmount: number;
}

export interface SplitPreview {
  lines: SplitPreviewLine[];
  total: number;
  remainderBearerId: string | null;
  remainderAmount: number;
}

function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFromString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

function pickRemainderBearer(
  participantIds: string[],
  payerId: string,
  seed: string
): string | null {
  const candidates = participantIds.filter((id) => id !== payerId);
  if (candidates.length === 0) {
    return null;
  }
  if (candidates.length === 1) {
    return candidates[0];
  }
  const rng = mulberry32(seedFromString(seed));
  const index = Math.floor(rng() * candidates.length);
  return candidates[index];
}

export function calculateEqualSplitAmong(
  totalAmount: number,
  payingIds: string[],
  payerId: string,
  seed: string
): SplitPreview {
  const n = payingIds.length;
  if (n === 0) {
    return { lines: [], total: 0, remainderBearerId: null, remainderAmount: 0 };
  }

  const base = Math.floor(totalAmount / n);
  const remainder = totalAmount - base * n;
  const bearerId =
    remainder > 0 ? pickRemainderBearer(payingIds, payerId, seed) : null;

  const lines: SplitPreviewLine[] = payingIds.map((memberId) => {
    const extra = bearerId && memberId === bearerId ? remainder : 0;
    return {
      memberId,
      amount: base + extra,
      isRemainderBearer: memberId === bearerId && remainder > 0,
      remainderAmount: memberId === bearerId ? remainder : 0,
    };
  });

  return {
    lines,
    total: lines.reduce((sum, line) => sum + line.amount, 0),
    remainderBearerId: bearerId,
    remainderAmount: remainder,
  };
}

export function calculateEqualSplit(
  totalAmount: number,
  allParticipantIds: string[],
  payerId: string,
  seed: string,
  excludedIds: Set<string> = new Set()
): SplitPreview {
  const payingIds = allParticipantIds.filter((id) => !excludedIds.has(id));
  const payingPreview = calculateEqualSplitAmong(
    totalAmount,
    payingIds,
    payerId,
    seed
  );
  const payingMap = new Map(
    payingPreview.lines.map((line) => [line.memberId, line])
  );

  const lines: SplitPreviewLine[] = allParticipantIds.map((memberId) => {
    if (excludedIds.has(memberId)) {
      return {
        memberId,
        amount: 0,
        isRemainderBearer: false,
        remainderAmount: 0,
      };
    }
    return (
      payingMap.get(memberId) ?? {
        memberId,
        amount: 0,
        isRemainderBearer: false,
        remainderAmount: 0,
      }
    );
  });

  return {
    lines,
    total: payingPreview.total,
    remainderBearerId: payingPreview.remainderBearerId,
    remainderAmount: payingPreview.remainderAmount,
  };
}

export function calculateItemizedSplit(
  totalAmount: number,
  participantIds: string[],
  manualAmounts: Record<string, number>,
  excludedIds: Set<string> = new Set()
): SplitPreview {
  const lines: SplitPreviewLine[] = participantIds.map((memberId) => ({
    memberId,
    amount: excludedIds.has(memberId) ? 0 : manualAmounts[memberId] ?? 0,
    isRemainderBearer: false,
    remainderAmount: 0,
  }));

  return {
    lines,
    total: lines.reduce((sum, line) => sum + line.amount, 0),
    remainderBearerId: null,
    remainderAmount: 0,
  };
}

export function buildSplitPreview(
  input: CreateAdvanceInput,
  members: Member[]
): SplitPreview {
  const allParticipantIds =
    input.participantScope === 'all'
      ? members.map((m) => m.id)
      : input.participantIds;
  const excluded = new Set(input.excludedMemberIds ?? []);
  const payingIds = allParticipantIds.filter((id) => !excluded.has(id));
  const payers =
    input.payers?.length ?
      input.payers
    : input.payerId ?
      [{ memberId: input.payerId, amount: input.totalAmount }]
    : [];
  const primaryPayer = primaryPayerId(payers);
  const seed = input.remainderSeed ?? `${input.title}-${Date.now()}`;
  const serviceFee = Math.max(0, input.serviceFee ?? 0);
  const subtotal = Math.max(0, input.totalAmount - serviceFee);

  let preview: SplitPreview;
  if (input.splitMode === 'equal') {
    preview = calculateEqualSplit(
      subtotal,
      allParticipantIds,
      primaryPayer,
      seed,
      excluded
    );
  } else {
    preview = calculateItemizedSplit(
      subtotal,
      allParticipantIds,
      input.manualAmounts ?? {},
      excluded
    );
  }

  if (serviceFee > 0) {
    preview = applyServiceFeeToSplitPreview(
      preview,
      serviceFee,
      payingIds,
      primaryPayer,
      seed,
      normalizeServiceFeeSplitMode(input.serviceFeeSplitMode)
    );
  }

  return preview;
}

export function previewToParticipants(
  preview: SplitPreview,
  payerId: string,
  payerIds: string[] = [payerId],
  splitNotes?: Record<string, string | null>,
  splitItems?: Record<string, LineItem[]>
): TransactionParticipant[] {
  const payerSet = new Set(payerIds);
  return preview.lines.map((line) => {
    const items = splitItems?.[line.memberId];
    const participant: TransactionParticipant = {
      memberId: line.memberId,
      amount: line.amount,
      signedAmount: line.amount,
      role: payerSet.has(line.memberId) ? 'payer' : 'beneficiary',
      note: splitNotes?.[line.memberId] ?? null,
    };

    if (items?.length) {
      participant.lineItems = items;
    }
    if (line.isRemainderBearer && line.remainderAmount > 0) {
      participant.isRemainderBearer = true;
      participant.remainderAmount = line.remainderAmount;
    }

    return participant;
  });
}

/** @deprecated 使用 previewToParticipants */
export const previewToSplits = previewToParticipants;

export function validateCreateInput(
  input: CreateAdvanceInput,
  members: Member[]
): string | null {
  if (!input.title.trim()) {
    return COPY_ERRORS.titleRequired;
  }
  if (!input.date?.trim()) {
    return COPY_ERRORS.dateRequired;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    return COPY_ERRORS.dateInvalid;
  }
  if (input.totalAmount <= 0) {
    return COPY_ERRORS.amountPositive;
  }

  const payers =
    input.payers?.length ?
      input.payers
    : input.payerId ?
      [{ memberId: input.payerId, amount: input.totalAmount }]
    : [];
  const payerError = validateAdvancePayers(payers, input.totalAmount);
  if (payerError) return payerError;

  const allParticipantIds =
    input.participantScope === 'all'
      ? members.map((m) => m.id)
      : input.participantIds;

  if (allParticipantIds.length === 0) {
    return COPY_ERRORS.splitMemberRequired;
  }

  const excluded = new Set(input.excludedMemberIds ?? []);
  const payingCount = allParticipantIds.filter((id) => !excluded.has(id)).length;

  if (payingCount === 0) {
    return COPY_ERRORS.splitParticipantRequired;
  }

  const preview = buildSplitPreview(input, members);

  if (input.splitMode === 'equal') {
    if (preview.remainderAmount > 0 && !preview.remainderBearerId) {
      return COPY_ERRORS.solePayerRemainder;
    }
  }

  if (input.splitMode === 'itemized') {
    const amounts = input.manualAmounts ?? {};
    if (Object.values(amounts).some((a) => a < 0)) {
      return '金額不可為負數';
    }
    if (!preview.lines.some((line) => line.amount > 0)) {
      return '請至少為一位成員新增消費項目';
    }
  }

  return null;
}

export function validateRepaymentInput(
  fromMemberId: string,
  toMemberId: string,
  amount: number
): string | null {
  if (!fromMemberId || !toMemberId) {
    return COPY_ERRORS.repaymentTargetRequired;
  }
  if (fromMemberId === toMemberId) {
    return COPY_ERRORS.repaymentSelf;
  }
  if (amount <= 0) {
    return COPY_ERRORS.repaymentAmountPositive;
  }
  return null;
}
