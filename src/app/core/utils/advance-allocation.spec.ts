import { Transaction } from '../models';
import {
  advanceChangeAmount,
  advanceMemberBalances,
  advanceNetPaidByMember,
  advanceSettlementEdges,
  validateAdvancePayers,
} from './advance-allocation';

function multiPayerAdvance(
  payers: Array<{ memberId: string; amount: number }>,
  splits: Array<{ memberId: string; amount: number }>
): Transaction {
  const totalAmount =
    payers.reduce((s, p) => s + p.amount, 0) ||
    splits.reduce((s, p) => s + p.amount, 0);
  return {
    id: '1',
    accountId: 'default',
    type: 'advance',
    title: '晚餐',
    totalAmount,
    payerId: payers[0]?.memberId ?? '',
    payers,
    status: 'active',
    createdBy: payers[0]?.memberId ?? '',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    participants: splits.map((s) => ({ memberId: s.memberId, amount: s.amount })),
  };
}

describe('advance-allocation', () => {
  it('validates payer amounts cover bill total', () => {
    expect(validateAdvancePayers([{ memberId: 'm1', amount: 600 }], 1000)).toContain(
      '不可少於'
    );
    expect(
      validateAdvancePayers(
        [
          { memberId: 'm1', amount: 1000 },
          { memberId: 'm2', amount: 1000 },
        ],
        1486
      )
    ).toBeNull();
  });

  it('splits change proportionally when overpaid', () => {
    const tx = multiPayerAdvance(
      [
        { memberId: 'm1', amount: 1000 },
        { memberId: 'm2', amount: 1000 },
      ],
      [
        { memberId: 'm1', amount: 743 },
        { memberId: 'm2', amount: 743 },
      ]
    );
    tx.totalAmount = 1486;
    tx.participants = [
      { memberId: 'm1', amount: 743 },
      { memberId: 'm2', amount: 743 },
    ];

    expect(advanceChangeAmount(tx.payers!, 1486)).toBe(514);
    const net = advanceNetPaidByMember(tx);
    expect(net.get('m1')).toBe(743);
    expect(net.get('m2')).toBe(743);
  });

  it('allocates by net credit: A paid 600 share 200, B paid 400', () => {
    const tx = multiPayerAdvance(
      [
        { memberId: 'm1', amount: 600 },
        { memberId: 'm2', amount: 400 },
      ],
      [
        { memberId: 'm1', amount: 200 },
        { memberId: 'm2', amount: 0 },
        { memberId: 'm3', amount: 500 },
        { memberId: 'm4', amount: 300 },
      ]
    );

    const balances = advanceMemberBalances(tx);
    expect(balances.get('m1')).toBe(400);
    expect(balances.get('m2')).toBe(400);
    expect(balances.get('m3')).toBe(-500);
    expect(balances.get('m4')).toBe(-300);

    const edges = advanceSettlementEdges(tx);
    const cToA = edges.find((e) => e.fromId === 'm3' && e.toId === 'm1');
    const cToB = edges.find((e) => e.fromId === 'm3' && e.toId === 'm2');
    expect(cToA?.amount).toBe(250);
    expect(cToB?.amount).toBe(250);
  });

  it('falls back to single payerId for legacy data', () => {
    const tx: Transaction = {
      id: '1',
      accountId: 'default',
      type: 'advance',
      title: '舊資料',
      totalAmount: 300,
      payerId: 'm1',
      status: 'active',
      createdBy: 'm1',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      participants: [
        { memberId: 'm1', amount: 100 },
        { memberId: 'm2', amount: 200 },
      ],
    };

    const edges = advanceSettlementEdges(tx);
    expect(edges).toEqual([{ fromId: 'm2', toId: 'm1', amount: 200 }]);
  });
});
