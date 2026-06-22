import {
  CreateExpenseInput,
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

export function calculateEqualSplit(
  totalAmount: number,
  participantIds: string[],
  payerId: string,
  seed: string
): SplitPreview {
  const n = participantIds.length;
  if (n === 0) {
    return { lines: [], total: 0, remainderBearerId: null, remainderAmount: 0 };
  }

  const base = Math.floor(totalAmount / n);
  const remainder = totalAmount - base * n;
  const bearerId =
    remainder > 0 ? pickRemainderBearer(participantIds, payerId, seed) : null;

  const lines: SplitPreviewLine[] = participantIds.map((memberId) => {
    const extra =
      bearerId && memberId === bearerId ? remainder : 0;
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
  const participantIds =
    input.participantScope === 'all'
      ? members.map((m) => m.id)
      : input.participantIds;

  if (input.splitMode === 'equal') {
    const seed = input.remainderSeed ?? `${input.title}-${Date.now()}`;
    return calculateEqualSplit(
      input.totalAmount,
      participantIds,
      input.payerId,
      seed
    );
  }

  return calculateItemizedSplit(
    input.totalAmount,
    participantIds,
    input.manualAmounts ?? {}
  );
}

export function previewToSplits(
  preview: SplitPreview,
  splitNotes?: Record<string, string | null>
): ExpenseSplit[] {
  return preview.lines.map((line) => ({
    memberId: line.memberId,
    amount: line.amount,
    note: splitNotes?.[line.memberId] ?? null,
    paymentStatus: 'unpaid' as const,
    isRemainderBearer: line.isRemainderBearer,
    remainderAmount: line.remainderAmount,
    markedAt: null,
    confirmedAt: null,
  }));
}

export function validateCreateInput(
  input: CreateExpenseInput,
  members: Member[]
): string | null {
  if (!input.title.trim()) {
    return '請填寫項目名稱';
  }
  if (input.totalAmount <= 0) {
    return '總金額需大於 0';
  }
  if (!input.payerId) {
    return '請選擇代墊者';
  }

  const participantIds =
    input.participantScope === 'all'
      ? members.map((m) => m.id)
      : input.participantIds;

  if (participantIds.length === 0) {
    return '至少選一位分攤者';
  }

  const preview = buildSplitPreview(input, members);

  if (input.splitMode === 'equal') {
    if (preview.remainderAmount > 0 && !preview.remainderBearerId) {
      return '平分僅有代墊者一人時無法分配零頭，請改細分或調整人數';
    }
  }

  if (input.splitMode === 'itemized') {
    if (preview.total !== input.totalAmount) {
      return `細分加總 ${preview.total} 需等於總額 ${input.totalAmount}`;
    }
  }

  return null;
}
