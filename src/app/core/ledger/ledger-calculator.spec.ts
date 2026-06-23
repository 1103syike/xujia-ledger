import { Transaction } from '../models';
import {
  computeBalances,
  creditorsOwedByMember,
  memberNetBalance,
  netBalances,
  signedImpactOnMember,
  signedImpactOnPair,
  transactionsBetweenMembers,
} from '../ledger/ledger-calculator';

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

  it('transfer edges replace settled advances in net balances', () => {
    const settledAdvance: Transaction = {
      ...advance('1', 'm1', [
        { memberId: 'm1', amount: 50 },
        { memberId: 'm2', amount: 50 },
      ]),
      settledByTransferId: 't1',
    };
    const transfer: Transaction = {
      id: 't1',
      accountId: 'default',
      type: 'transfer',
      title: '債務轉移',
      totalAmount: 50,
      payerId: 'm1',
      status: 'active',
      createdBy: 'm1',
      createdAt: '2025-01-03T00:00:00.000Z',
      updatedAt: '2025-01-03T00:00:00.000Z',
      participants: [],
      sourceTransactionIds: ['1'],
      transferEdges: [{ fromId: 'm2', toId: 'm1', amount: 50 }],
    };

    const net = netBalances([settledAdvance, transfer]);
    const edge = net.find((e) => e.fromId === 'm2' && e.toId === 'm1');
    expect(edge?.amount).toBe(50);
  });

  it('nets bidirectional debts between two members', () => {
    const txs: Transaction[] = [
      advance('1', 'm2', [
        { memberId: 'm2', amount: 50 },
        { memberId: 'm1', amount: 50 },
      ], '生活用品'),
      advance('2', 'm2', [
        { memberId: 'm2', amount: 50 },
        { memberId: 'm1', amount: 50 },
      ], '晚餐'),
      advance('3', 'm1', [
        { memberId: 'm1', amount: 275 },
        { memberId: 'm2', amount: 275 },
      ], '雜項'),
    ];

    const net = netBalances(txs);
    const edge = net.find(
      (e) =>
        (e.fromId === 'm1' && e.toId === 'm2') ||
        (e.fromId === 'm2' && e.toId === 'm1')
    );

    expect(edge).toBeDefined();
    expect(edge!.fromId).toBe('m1');
    expect(edge!.toId).toBe('m2');
    expect(edge!.amount).toBe(161);
  });

  it('signedImpactOnMember uses payer net for advances', () => {
    const tx = advance('1', 'm1', [
      { memberId: 'm1', amount: 275 },
      { memberId: 'm2', amount: 275 },
    ], '雜項');

    expect(signedImpactOnMember(tx, 'm1')).toBe(275);
    expect(signedImpactOnMember(tx, 'm2')).toBe(-275);
  });

  it('creditorsOwedByMember returns net amount per creditor', () => {
    const txs: Transaction[] = [
      advance('1', 'm2', [
        { memberId: 'm2', amount: 89 },
        { memberId: 'm1', amount: 89 },
      ], '生活用品'),
      advance('2', 'm2', [
        { memberId: 'm2', amount: 129 },
        { memberId: 'm1', amount: 129 },
      ], '晚餐'),
      advance('3', 'm1', [
        { memberId: 'm1', amount: 275 },
        { memberId: 'm2', amount: 275 },
      ], '雜項'),
    ];

    const rows = creditorsOwedByMember(txs, 'm1');
    expect(rows.length).toBe(1);
    expect(rows[0].toId).toBe('m2');
    expect(rows[0].amount).toBe(161);
  });

  it('memberNetBalance nets debts and receivables', () => {
    const txs: Transaction[] = [
      advance('1', 'm2', [
        { memberId: 'm2', amount: 100 },
        { memberId: 'm1', amount: 100 },
      ], '欠 m2'),
      advance('2', 'm1', [
        { memberId: 'm1', amount: 60 },
        { memberId: 'm3', amount: 60 },
      ], 'm3 欠 m1'),
    ];

    expect(memberNetBalance(txs, 'm1')).toBe(-40);
    expect(memberNetBalance(txs, 'm3')).toBe(-60);
    expect(memberNetBalance(txs, 'm2')).toBe(100);
  });

  it('signedImpactOnPair isolates transfer edges per counterparty', () => {
    const transfer: Transaction = {
      id: 't1',
      accountId: 'default',
      type: 'transfer',
      title: '債務轉移',
      totalAmount: 1000,
      payerId: 'm1',
      status: 'active',
      createdBy: 'm1',
      createdAt: '2025-01-03T00:00:00.000Z',
      updatedAt: '2025-01-03T00:00:00.000Z',
      participants: [],
      transferEdges: [
        { fromId: 'm1', toId: 'm2', amount: 400 },
        { fromId: 'm3', toId: 'm1', amount: 576 },
        { fromId: 'm4', toId: 'm1', amount: 276 },
      ],
    };

    expect(signedImpactOnMember(transfer, 'm1')).toBe(452);
    expect(signedImpactOnPair(transfer, 'm1', 'm2')).toBe(-400);
    expect(signedImpactOnPair(transfer, 'm1', 'm3')).toBe(576);
    expect(signedImpactOnPair(transfer, 'm1', 'm4')).toBe(276);
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

  it('includes transfer edge between pair', () => {
    const txs: Transaction[] = [
      {
        id: 't1',
        accountId: 'default',
        type: 'transfer',
        title: '債務轉移',
        totalAmount: 100,
        payerId: 'm2',
        status: 'active',
        createdBy: 'm2',
        createdAt: '2025-01-03T00:00:00.000Z',
        updatedAt: '2025-01-03T00:00:00.000Z',
        participants: [],
        transferEdges: [{ fromId: 'm1', toId: 'm2', amount: 100 }],
      },
    ];
    expect(transactionsBetweenMembers(txs, 'm1', 'm2').length).toBe(1);
  });
});
