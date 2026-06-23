import {
  buildAdvanceInputFromDraft,
  computeStickySummary,
  inferSplitRuleFromTransaction,
} from './advance-draft';
import { Transaction } from '../models';

describe('advance-draft', () => {
  it('maps equal rule to splitMode equal', () => {
    const input = buildAdvanceInputFromDraft({
      title: '火鍋',
      date: '2026-06-20',
      note: null,
      splitRule: 'equal',
      customInputMethod: 'lineItems',
      splitTotal: 2500,
      chartBillTotal: 2500,
      payers: [{ memberId: 'm1', amount: 2500 }],
      members: [{ id: 'm1', name: 'A', emoji: '', color: '', loginEmail: '' }],
      excludedMemberIds: [],
      manualAmounts: {},
      remainderSeed: 'seed',
    });

    expect(input.splitMode).toBe('equal');
    expect(input.totalAmount).toBe(2500);
  });

  it('computes sticky summary with change', () => {
    const summary = computeStickySummary(1486, [
      { memberId: 'm1', amount: 1000 },
      { memberId: 'm2', amount: 1000 },
    ]);
    expect(summary.splitTotal).toBe(1486);
    expect(summary.grossPaid).toBe(2000);
    expect(summary.change).toBe(514);
    expect(summary.paymentShortfall).toBe(0);
  });

  it('infers custom direct when itemized without line items', () => {
    const tx: Transaction = {
      id: '1',
      accountId: 'default',
      type: 'advance',
      title: '電影',
      totalAmount: 1800,
      payerId: 'm1',
      splitMode: 'itemized',
      status: 'active',
      createdBy: 'm1',
      createdAt: '',
      updatedAt: '',
      participants: [
        { memberId: 'm1', amount: 300 },
        { memberId: 'm2', amount: 450 },
      ],
    };

    expect(inferSplitRuleFromTransaction(tx)).toEqual({
      splitRule: 'custom',
      customInputMethod: 'direct',
    });
  });
});
