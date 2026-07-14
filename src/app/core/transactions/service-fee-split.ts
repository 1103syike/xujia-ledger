import {
  calculateEqualSplitAmong,
  SplitPreview,
} from './split-calculator';

/** 服務費均分給參與成員（尾差規則同均分） */
export function serviceFeeSharesByMember(
  serviceFee: number,
  payingIds: string[],
  payerId: string,
  seed: string
): Map<string, number> {
  if (serviceFee <= 0 || payingIds.length === 0) return new Map();

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
  seed: string
): SplitPreview {
  if (serviceFee <= 0) return preview;

  const shares = serviceFeeSharesByMember(
    serviceFee,
    payingIds,
    payerId,
    seed
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
  seed: string
): Record<string, number> {
  if (serviceFee <= 0) return { ...amounts };

  const shares = serviceFeeSharesByMember(
    serviceFee,
    payingIds,
    payerId,
    seed
  );
  const next: Record<string, number> = {};
  for (const [memberId, amount] of Object.entries(amounts)) {
    next[memberId] = Math.max(0, amount - (shares.get(memberId) ?? 0));
  }
  return next;
}
