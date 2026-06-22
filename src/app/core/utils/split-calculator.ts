import {
  CreateExpenseInput,
  ExpenseLineItem,
  ExpenseSplit,
  Member,
} from '../models';

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

/** 在指定成員中平分（不含被排除者） */
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
  manualAmounts: Record<string, number>
): SplitPreview {
  const lines: SplitPreviewLine[] = participantIds.map((memberId) => ({
    memberId,
    amount: manualAmounts[memberId] ?? 0,
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
  input: CreateExpenseInput,
  members: Member[]
): SplitPreview {
  const allParticipantIds =
    input.participantScope === 'all'
      ? members.map((m) => m.id)
      : input.participantIds;
  const excluded = new Set(input.excludedMemberIds ?? []);

  if (input.splitMode === 'equal') {
    const seed = input.remainderSeed ?? `${input.title}-${Date.now()}`;
    return calculateEqualSplit(
      input.totalAmount,
      allParticipantIds,
      input.payerId,
      seed,
      excluded
    );
  }

  return calculateItemizedSplit(
    input.totalAmount,
    allParticipantIds,
    input.manualAmounts ?? {}
  );
}

/** 編輯帳款時，若成員與金額未變則保留付款狀態 */
export function mergeSplitsPreservingPayment(
  existing: ExpenseSplit[],
  incoming: ExpenseSplit[]
): ExpenseSplit[] {
  const byMember = new Map(existing.map((s) => [s.memberId, s]));

  return incoming.map((split) => {
    const prev = byMember.get(split.memberId);
    if (!prev || prev.amount !== split.amount || prev.paymentStatus === 'unpaid') {
      return split;
    }
    return {
      ...split,
      paymentStatus: prev.paymentStatus,
      markedAt: prev.markedAt ?? null,
      confirmedAt: prev.confirmedAt ?? null,
    };
  });
}

export function previewToSplits(
  preview: SplitPreview,
  splitNotes?: Record<string, string | null>,
  splitItems?: Record<string, ExpenseLineItem[]>
): ExpenseSplit[] {
  return preview.lines.map((line) => {
    const items = splitItems?.[line.memberId];
    const split: ExpenseSplit = {
      memberId: line.memberId,
      amount: line.amount,
      note: splitNotes?.[line.memberId] ?? null,
      paymentStatus: 'unpaid',
      markedAt: null,
      confirmedAt: null,
    };

    if (items?.length) {
      split.items = items;
    }
    if (line.isRemainderBearer && line.remainderAmount > 0) {
      split.isRemainderBearer = true;
      split.remainderAmount = line.remainderAmount;
    }

    return split;
  });
}

export function validateCreateInput(
  input: CreateExpenseInput,
  members: Member[]
): string | null {
  if (!input.title.trim()) {
    return '請填寫項目名稱';
  }
  if (!input.date?.trim()) {
    return '請選擇日期';
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    return '日期格式不正確';
  }
  if (input.totalAmount <= 0) {
    return '總金額必須大於 0';
  }
  if (!input.payerId) {
    return '請選擇代墊者';
  }

  const allParticipantIds =
    input.participantScope === 'all'
      ? members.map((m) => m.id)
      : input.participantIds;

  if (allParticipantIds.length === 0) {
    return '請至少選擇一位分攤成員';
  }

  const excluded = new Set(input.excludedMemberIds ?? []);
  const payingCount = allParticipantIds.filter((id) => !excluded.has(id)).length;

  if (payingCount === 0) {
    return '至少需要一位成員參與分攤';
  }

  const preview = buildSplitPreview(input, members);

  if (input.splitMode === 'equal') {
    if (preview.remainderAmount > 0 && !preview.remainderBearerId) {
      return '僅代墊者一人分攤時無法分配零頭，請標記其他成員免分攤';
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
