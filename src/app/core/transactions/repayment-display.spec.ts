import {
  inferRepaymentOwedBeforeFromParticipants,
  repaymentStoryAmountSuffix,
  repaymentCreditorIds,
  repaymentMemberNetRows,
  formatRepaymentTitle,
} from './repayment-display';
import { enrichRepaymentOwedBefore } from '../ledger/ledger-calculator';
import { coerceIsoTimestamp, normalizeTransaction } from './transaction-date';
import { Transaction } from '../models';

function repayment(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'r1',
    accountId: 'default',
    type: 'repayment',
    title: '還款',
    totalAmount: 954,
    payerId: 'lin',
    fromMemberId: 'zheng',
    status: 'active',
    createdBy: 'zheng',
    createdAt: '2026-07-13T12:12:00.000Z',
    updatedAt: '2026-07-13T12:12:00.000Z',
    participants: [
      { memberId: 'zheng', amount: 954, signedAmount: -954 },
      { memberId: 'lin', amount: 954, signedAmount: 954 },
    ],
    ...overrides,
  };
}

describe('repayment-display', () => {
  it('shows cashflow nets for normal repayment', () => {
    const tx = repayment({ repaymentOwedBefore: 954 });
    const byId = new Map(
      repaymentMemberNetRows(tx).map((row) => [row.memberId, row.net])
    );

    expect(byId.get('zheng')).toBe(-954);
    expect(byId.get('lin')).toBe(954);
    expect(repaymentCreditorIds(tx)).toEqual(['lin']);
  });

  it('shows reverse residual when repayment exceeds debt', () => {
    const tx = repayment({ repaymentOwedBefore: 754 });
    const byId = new Map(
      repaymentMemberNetRows(tx).map((row) => [row.memberId, row.net])
    );

    expect(byId.get('zheng')).toBe(200);
    expect(byId.get('lin')).toBe(-200);
    expect(repaymentCreditorIds(tx)).toEqual(['zheng']);
  });

  it('uses 超額還款 title and story suffix 還款／欠款（+超額）', () => {
    const tx = repayment({ repaymentOwedBefore: 754 });
    expect(formatRepaymentTitle(tx)).toBe('超額還款');
    expect(repaymentStoryAmountSuffix(tx)).toBe('954／754（+200）');
  });

  it('formats normal repayment title as 還款 without suffix', () => {
    const tx = repayment({ repaymentOwedBefore: 954 });
    expect(formatRepaymentTitle(tx)).toBe('還款');
    expect(repaymentStoryAmountSuffix(tx)).toBeNull();
  });

  it('infers owedBefore from overpay participants so later bills cannot drift', () => {
    const tx = repayment({
      participants: [
        { memberId: 'zheng', amount: 954, signedAmount: 200 },
        { memberId: 'lin', amount: 954, signedAmount: -200 },
      ],
    });

    expect(inferRepaymentOwedBeforeFromParticipants(tx)).toBe(754);

    const laterAdvance: Transaction = {
      id: 'a-later',
      accountId: 'default',
      type: 'advance',
      title: '後來才記的帳',
      totalAmount: 162,
      payerId: 'lin',
      status: 'active',
      createdBy: 'lin',
      createdAt: '2026-07-14T10:00:00.000Z',
      updatedAt: '2026-07-14T10:00:00.000Z',
      participants: [
        { memberId: 'zheng', amount: 162, signedAmount: -162 },
        { memberId: 'lin', amount: 162, signedAmount: 162 },
      ],
    };

    const enriched = enrichRepaymentOwedBefore(tx, [tx, laterAdvance]);
    expect(enriched.repaymentOwedBefore).toBe(754);
    expect(repaymentStoryAmountSuffix(enriched)).toBe('954／754（+200）');
  });
});

describe('normalizeTransaction repayment freeze', () => {
  it('keeps repaymentOwedBefore when loading from Firestore', () => {
    const tx = normalizeTransaction({
      id: 'r1',
      title: '超額還款',
      type: 'repayment',
      totalAmount: 954,
      payerId: 'lin',
      fromMemberId: 'zheng',
      repaymentOwedBefore: 754,
      status: 'active',
      createdBy: 'zheng',
      createdAt: '2026-07-13T12:12:00.000Z',
      updatedAt: '2026-07-13T12:12:00.000Z',
      participants: [
        { memberId: 'zheng', amount: 954, signedAmount: 200 },
        { memberId: 'lin', amount: 954, signedAmount: -200 },
      ],
    });

    expect(tx.repaymentOwedBefore).toBe(754);
    expect(repaymentStoryAmountSuffix(tx)).toBe('954／754（+200）');
  });

  it('coerces Firestore Timestamp-like createdAt to ISO string', () => {
    expect(
      coerceIsoTimestamp({
        seconds: 1_720_828_800,
        nanoseconds: 0,
        toDate: () => new Date('2024-07-13T00:00:00.000Z'),
      })
    ).toBe('2024-07-13T00:00:00.000Z');
  });
});
