import {
  formatRepaymentTitle,
  repaymentCreditorIds,
  repaymentMemberNetRows,
} from './repayment-display';
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
    // 原本欠 754、還 954 → 多還 200：付款人變債主
    const tx = repayment({ repaymentOwedBefore: 754 });
    const byId = new Map(
      repaymentMemberNetRows(tx).map((row) => [row.memberId, row.net])
    );

    expect(byId.get('zheng')).toBe(200);
    expect(byId.get('lin')).toBe(-200);
    expect(repaymentCreditorIds(tx)).toEqual(['zheng']);
  });

  it('formats overpay title as 超額還款（還款/欠款,+超額）', () => {
    const tx = repayment({ repaymentOwedBefore: 754 });
    expect(formatRepaymentTitle(tx)).toBe('超額還款（954/754,+200）');
  });

  it('formats normal repayment title as 還款', () => {
    const tx = repayment({ repaymentOwedBefore: 954 });
    expect(formatRepaymentTitle(tx)).toBe('還款');
  });
});
