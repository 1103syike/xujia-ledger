import { memberNetRowsForTransaction } from './transaction-member-nets';
import { Transaction } from '../models';

function advance(
  payerId: string,
  splits: Array<{ memberId: string; amount: number }>
): Transaction {
  const totalAmount = splits.reduce((s, x) => s + x.amount, 0);
  return {
    id: '1',
    accountId: 'default',
    type: 'advance',
    title: '晚餐',
    totalAmount,
    payerId,
    status: 'active',
    createdBy: payerId,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    participants: splits.map((s) => ({ memberId: s.memberId, amount: s.amount })),
  };
}

describe('transaction-member-nets', () => {
  it('advance: payer collects others share, others owe', () => {
    const tx = advance('m1', [
      { memberId: 'm1', amount: 100 },
      { memberId: 'm2', amount: 100 },
      { memberId: 'm3', amount: 100 },
      { memberId: 'm4', amount: 100 },
      { memberId: 'm5', amount: 100 },
    ]);

    const nets = memberNetRowsForTransaction(tx);
    const byId = new Map(nets.map((r) => [r.memberId, r.net]));

    expect(byId.get('m1')).toBe(400);
    expect(byId.get('m2')).toBe(-100);
    expect(byId.get('m5')).toBe(-100);
  });
});
