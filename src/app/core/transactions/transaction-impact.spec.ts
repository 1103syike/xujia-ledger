import {
  formatViewerImpact,
  isViewerInvolvedInTransaction,
} from './transaction-impact';

function advance(overrides: Partial<import('../models').Transaction> = {}): import('../models').Transaction {
  return {
    id: '1',
    accountId: 'default',
    type: 'advance',
    title: '品瑜雜款',
    totalAmount: 3500,
    payerId: 'm4',
    payers: [{ memberId: 'm4', amount: 3500 }],
    splitMode: 'equal',
    status: 'active',
    createdBy: 'm4',
    createdAt: '',
    updatedAt: '',
    participants: [
      { memberId: 'm4', amount: 3500 },
      { memberId: 'm1', amount: 0 },
      { memberId: 'm2', amount: 0 },
      { memberId: 'm3', amount: 0 },
      { memberId: 'm5', amount: 0 },
    ],
    ...overrides,
  };
}

describe('transaction-impact', () => {
  it('marks unrelated members as 跟你無關', () => {
    const tx = advance({
      participants: [
        { memberId: 'm4', amount: 0 },
        { memberId: 'm5', amount: 3500 },
      ],
    });

    expect(isViewerInvolvedInTransaction(tx, 'm2')).toBe(false);
    expect(formatViewerImpact(tx, 'm2')).toEqual({
      kind: 'neutral',
      label: '跟你無關',
      amountText: '',
    });
  });

  it('shows receivable for payer when only another member shares', () => {
    const tx = advance({
      participants: [
        { memberId: 'm4', amount: 0 },
        { memberId: 'm5', amount: 3500 },
      ],
    });

    expect(formatViewerImpact(tx, 'm4')).toEqual({
      kind: 'receivable',
      label: '欠你',
      amountText: '+$3500',
    });
    expect(formatViewerImpact(tx, 'm5')).toEqual({
      kind: 'payable',
      label: '你欠',
      amountText: '-$3500',
    });
  });

  it('shows 剛好抵銷 when payer is the sole sharer', () => {
    const tx = advance();

    expect(isViewerInvolvedInTransaction(tx, 'm4')).toBe(true);
    expect(formatViewerImpact(tx, 'm4')).toEqual({
      kind: 'neutral',
      label: '剛好抵銷',
      amountText: '',
    });
  });

  it('shows 欠你 for overpay residual to original payer', () => {
    const tx = {
      id: 'r1',
      accountId: 'default',
      type: 'repayment' as const,
      title: '還款',
      totalAmount: 954,
      payerId: 'lin',
      fromMemberId: 'zheng',
      repaymentOwedBefore: 754,
      status: 'active' as const,
      createdBy: 'zheng',
      createdAt: '',
      updatedAt: '',
      participants: [
        { memberId: 'zheng', amount: 954, signedAmount: 200 },
        { memberId: 'lin', amount: 954, signedAmount: -200 },
      ],
    };

    expect(formatViewerImpact(tx, 'zheng')).toEqual({
      kind: 'receivable',
      label: '欠你',
      amountText: '+$200',
    });
    expect(formatViewerImpact(tx, 'lin')).toEqual({
      kind: 'payable',
      label: '你欠',
      amountText: '-$200',
    });
  });
});
