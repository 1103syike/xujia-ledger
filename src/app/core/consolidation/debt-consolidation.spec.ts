import {
  buildConsolidationPreview,
  memberNetBalances,
  minimizeTransfers,
} from '../consolidation/debt-consolidation';
import { Transaction } from '../models';

function advance(
  id: string,
  payerId: string,
  splits: Array<{ memberId: string; amount: number }>
): Transaction {
  const totalAmount = splits.reduce((s, x) => s + x.amount, 0);
  return {
    id,
    accountId: 'default',
    type: 'advance',
    title: `代墊 ${id}`,
    totalAmount,
    payerId,
    status: 'active',
    createdBy: payerId,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    participants: splits.map((s) => ({ memberId: s.memberId, amount: s.amount })),
  };
}

describe('debt-consolidation', () => {
  it('minimizes transfers to fewest payments (ABC example)', () => {
    const txs: Transaction[] = [
      advance('1', 'm1', [
        { memberId: 'm1', amount: 100 },
        { memberId: 'm2', amount: 100 },
        { memberId: 'm3', amount: 100 },
      ]),
      advance('2', 'm2', [
        { memberId: 'm2', amount: 200 },
        { memberId: 'm3', amount: 200 },
      ]),
      advance('3', 'm3', [
        { memberId: 'm3', amount: 100 },
        { memberId: 'm1', amount: 100 },
      ]),
      advance('4', 'm1', [
        { memberId: 'm1', amount: 200 },
        { memberId: 'm2', amount: 200 },
      ]),
    ];

    const preview = buildConsolidationPreview(txs, ['m1', 'm2', 'm3']);

    expect(preview.edges.length).toBe(1);
    expect(preview.edges[0]).toEqual({
      fromId: 'm2',
      toId: 'm1',
      amount: 100,
    });

    const nets = memberNetBalances(txs);
    expect(nets.get('m1')).toBe(100);
    expect(nets.get('m2')).toBe(-100);
    expect(nets.get('m3')).toBe(0);
  });

  it('minimizeTransfers uses at most n-1 edges', () => {
    const txs: Transaction[] = [
      advance('1', 'm1', [
        { memberId: 'm1', amount: 100 },
        { memberId: 'm2', amount: 100 },
        { memberId: 'm3', amount: 100 },
        { memberId: 'm4', amount: 100 },
        { memberId: 'm5', amount: 100 },
      ]),
    ];
    const nets = memberNetBalances(txs);
    const edges = minimizeTransfers(nets);
    expect(edges.length).toBeLessThanOrEqual(4);
    expect(edges.length).toBe(4);
    const totalPaid = edges.reduce((s, e) => s + e.amount, 0);
    expect(totalPaid).toBe(400);
  });
});
