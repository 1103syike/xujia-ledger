import { Transaction } from '../models';
import { computeBalances, netBalances, transactionsBetweenMembers } from './ledger-calculator';

function advance(
  id: string,
  payerId: string,
  splits: Array<{ memberId: string; amount: number }>,
  title = '代墊'
): Transaction {
  const totalAmount = splits.reduce((s, x) => s + x.amount, 0);
  return {
    id,
    accountId: 'default',
    type: 'advance',
    title,
    totalAmount,
    payerId,
    status: 'active',
    createdBy: payerId,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    participants: splits.map((s) => ({ memberId: s.memberId, amount: s.amount })),
  };
}

function repayment(
  id: string,
  fromMemberId: string,
  toMemberId: string,
  amount: number
): Transaction {
  return {
    id,
    accountId: 'default',
    type: 'repayment',
    title: '還款',
    totalAmount: amount,
    payerId: toMemberId,
    fromMemberId,
    status: 'active',
    createdBy: fromMemberId,
    createdAt: '2025-01-02T00:00:00.000Z',
    updatedAt: '2025-01-02T00:00:00.000Z',
    participants: [
      { memberId: fromMemberId, amount: amount, signedAmount: -amount },
      { memberId: toMemberId, amount: amount, signedAmount: amount },
    ],
  };
}

describe('ledger-calculator', () => {
  it('computes net balance: 郑欠林 108', () => {
    const txs: Transaction[] = [
      advance('1', 'm2', [{ memberId: 'm2', amount: 550 }, { memberId: 'm1', amount: 550 }], '晚餐'),
      advance('2', 'm1', [{ memberId: 'm1', amount: 258 }, { memberId: 'm2', amount: 258 }], '飲料'),
      advance('3', 'm1', [{ memberId: 'm1', amount: 300 }, { memberId: 'm2', amount: 300 }], '電影'),
      repayment('4', 'm1', 'm2', 100),
    ];

    const net = netBalances(txs);
    const edge = net.find(
      (e) =>
        (e.fromId === 'm2' && e.toId === 'm1') ||
        (e.fromId === 'm1' && e.toId === 'm2')
    );

    expect(edge).toBeDefined();
    expect(edge!.fromId).toBe('m2');
    expect(edge!.toId).toBe('m1');
    expect(edge!.amount).toBe(108);
  });

  it('repayment reduces debt without modifying advances', () => {
    const txs: Transaction[] = [
      advance('1', 'm2', [{ memberId: 'm2', amount: 500 }, { memberId: 'm1', amount: 500 }]),
      repayment('2', 'm1', 'm2', 200),
    ];

    const raw = computeBalances(txs);
    const owed = raw.find((e) => e.fromId === 'm1' && e.toId === 'm2');
    expect(owed?.amount).toBe(300);
  });
});

describe('transactionsBetweenMembers', () => {
  it('includes advance where one paid and other split', () => {
    const txs: Transaction[] = [
      advance('1', 'm2', [
        { memberId: 'm2', amount: 550 },
        { memberId: 'm1', amount: 550 },
      ]),
    ];
    expect(transactionsBetweenMembers(txs, 'm1', 'm2').length).toBe(1);
  });

  it('excludes advance where third party paid', () => {
    const txs: Transaction[] = [
      advance('1', 'm3', [
        { memberId: 'm3', amount: 300 },
        { memberId: 'm1', amount: 150 },
        { memberId: 'm2', amount: 150 },
      ]),
    ];
    expect(transactionsBetweenMembers(txs, 'm1', 'm2').length).toBe(0);
  });

  it('includes repayment between pair', () => {
    const txs: Transaction[] = [repayment('1', 'm1', 'm2', 100)];
    expect(transactionsBetweenMembers(txs, 'm1', 'm2').length).toBe(1);
  });
});
