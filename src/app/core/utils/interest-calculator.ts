export type InterestSchemeId = 'bank' | 'shark3' | 'shark5' | 'shark10';

export interface InterestScheme {
  id: InterestSchemeId;
  label: string;
  shortLabel: string;
  type: 'annual' | 'monthly';
  rate: number;
}

export const INTEREST_SCHEMES: InterestScheme[] = [
  {
    id: 'bank',
    label: '銀行 (1.7%/年)',
    shortLabel: '銀行',
    type: 'annual',
    rate: 0.017,
  },
  {
    id: 'shark3',
    label: '高利貸 (月息3%)',
    shortLabel: '月息3%',
    type: 'monthly',
    rate: 0.03,
  },
  {
    id: 'shark5',
    label: '高利貸 (月息5%)',
    shortLabel: '月息5%',
    type: 'monthly',
    rate: 0.05,
  },
  {
    id: 'shark10',
    label: '高利貸 (月息10%)',
    shortLabel: '月息10%',
    type: 'monthly',
    rate: 0.1,
  },
];

export interface InterestPeriod {
  months: number;
  label: string;
}

/** 1 個月～10 年試算期間 */
export const INTEREST_PERIODS: InterestPeriod[] = [
  { months: 1, label: '1 個月' },
  { months: 2, label: '2 個月' },
  { months: 3, label: '3 個月' },
  { months: 6, label: '6 個月' },
  { months: 12, label: '1 年' },
  { months: 24, label: '2 年' },
  { months: 36, label: '3 年' },
  { months: 60, label: '5 年' },
  { months: 84, label: '7 年' },
  { months: 120, label: '10 年' },
];

export interface InterestTableRow {
  period: InterestPeriod;
  amounts: Record<InterestSchemeId, number>;
}

export function calcInterest(
  principal: number,
  months: number,
  scheme: InterestScheme
): number {
  if (principal <= 0 || months <= 0) return 0;
  if (scheme.type === 'annual') {
    return Math.round(principal * scheme.rate * (months / 12));
  }
  return Math.round(principal * scheme.rate * months);
}

export function interestTable(principal: number): InterestTableRow[] {
  return INTEREST_PERIODS.map((period) => {
    const amounts = {} as Record<InterestSchemeId, number>;
    for (const scheme of INTEREST_SCHEMES) {
      amounts[scheme.id] = calcInterest(principal, period.months, scheme);
    }
    return { period, amounts };
  });
}
