import {
  calculateEqualSplitAmong,
  SplitPreview,
} from './split-calculator';

/** 服務費分攤：均分 or 依基礎消費比例 */
export type ServiceFeeSplitMode = 'equal' | 'proportional';

export function normalizeServiceFeeSplitMode(
  mode?: ServiceFeeSplitMode | null
): ServiceFeeSplitMode {
  return mode === 'proportional' ? 'proportional' : 'equal';
}

function readAmount(
  source: Record<string, number> | Map<string, number> | undefined,
  id: string
): number {
  if (!source) return 0;
  if (source instanceof Map) return Math.max(0, source.get(id) ?? 0);
  return Math.max(0, source[id] ?? 0);
}

/** 依權重分配整數金額（最大餘數法） */
export function allocateByWeights(
  total: number,
  weights: Array<{ id: string; amount: number }>
): Map<string, number> {
  const result = new Map<string, number>();
  if (total <= 0 || weights.length === 0) return result;

  const positive = weights.map((w) => ({
    id: w.id,
    amount: Math.max(0, w.amount),
  }));
  const sumW = positive.reduce((s, w) => s + w.amount, 0);
  if (sumW <= 0) return result;

  const rows = positive.map((w) => {
    const raw = (total * w.amount) / sumW;
    const amount = Math.floor(raw);
    return { id: w.id, amount, frac: raw - amount };
  });

  let remainder = total - rows.reduce((s, r) => s + r.amount, 0);
  for (const row of [...rows].sort((a, b) => b.frac - a.frac)) {
    if (remainder <= 0) break;
    row.amount += 1;
    remainder--;
  }

  for (const row of rows) {
    result.set(row.id, row.amount);
  }
  return result;
}

/**
 * 服務費分給參與成員。
 * - equal：大家均分（預設，相容舊資料）
 * - proportional：依 baseAmounts 比例（通常是不含服務費的基礎消費）
 */
export function serviceFeeSharesByMember(
  serviceFee: number,
  payingIds: string[],
  payerId: string,
  seed: string,
  options?: {
    mode?: ServiceFeeSplitMode | null;
    baseAmountsByMember?: Record<string, number> | Map<string, number>;
  }
): Map<string, number> {
  if (serviceFee <= 0 || payingIds.length === 0) return new Map();

  const mode = normalizeServiceFeeSplitMode(options?.mode);
  if (mode === 'proportional') {
    const weights = payingIds.map((id) => ({
      id,
      amount: readAmount(options?.baseAmountsByMember, id),
    }));
    const sumW = weights.reduce((s, w) => s + w.amount, 0);
    if (sumW <= 0) {
      // 還沒有基礎消費時退回均分
      return serviceFeeSharesByMember(serviceFee, payingIds, payerId, seed, {
        mode: 'equal',
      });
    }
    return allocateByWeights(serviceFee, weights);
  }

  const preview = calculateEqualSplitAmong(
    serviceFee,
    payingIds,
    payerId,
    seed
  );
  return new Map(preview.lines.map((line) => [line.memberId, line.amount]));
}

/** 在既有分攤預覽上疊加服務費 */
export function applyServiceFeeToSplitPreview(
  preview: SplitPreview,
  serviceFee: number,
  payingIds: string[],
  payerId: string,
  seed: string,
  mode: ServiceFeeSplitMode = 'equal'
): SplitPreview {
  if (serviceFee <= 0) return preview;

  const baseAmounts = Object.fromEntries(
    preview.lines.map((line) => [line.memberId, line.amount])
  );
  const shares = serviceFeeSharesByMember(
    serviceFee,
    payingIds,
    payerId,
    seed,
    { mode, baseAmountsByMember: baseAmounts }
  );
  const lines = preview.lines.map((line) => ({
    ...line,
    amount: line.amount + (shares.get(line.memberId) ?? 0),
  }));

  return {
    ...preview,
    lines,
    total: lines.reduce((sum, line) => sum + line.amount, 0),
  };
}

/** 從含服務費的每人金額還原基礎分攤（編輯載入用） */
export function subtractServiceFeeFromAmounts(
  amounts: Record<string, number>,
  serviceFee: number,
  payingIds: string[],
  payerId: string,
  seed: string,
  mode: ServiceFeeSplitMode = 'equal'
): Record<string, number> {
  if (serviceFee <= 0) return { ...amounts };

  // 比例分：含服務費的總額與基礎消費同比例，用當下金額當權重即可反推
  const shares = serviceFeeSharesByMember(
    serviceFee,
    payingIds,
    payerId,
    seed,
    { mode, baseAmountsByMember: amounts }
  );
  const next: Record<string, number> = {};
  for (const [memberId, amount] of Object.entries(amounts)) {
    next[memberId] = Math.max(0, amount - (shares.get(memberId) ?? 0));
  }
  return next;
}
