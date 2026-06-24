import {
  groupByTransactionDate,
  transactionDateGroup,
} from './transaction-date-groups';
import { Transaction } from '../models';

function tx(id: string, date: string): Transaction {
  return {
    id,
    accountId: 'default',
    type: 'advance',
    title: id,
    date,
    totalAmount: 100,
    payerId: 'a',
    splitMode: 'equal',
    status: 'active',
    createdBy: 'a',
    createdAt: `${date}T12:00:00.000Z`,
    updatedAt: `${date}T12:00:00.000Z`,
    participants: [],
  };
}

describe('transactionDateGroup', () => {
  /** 2026-06-24 週二 */
  const ref = new Date(2026, 5, 24, 12, 0, 0);

  it('classifies today, yesterday, later, and earlier', () => {
    expect(transactionDateGroup('2026-06-24', ref)).toBe('today');
    expect(transactionDateGroup('2026-06-23', ref)).toBe('yesterday');
    expect(transactionDateGroup('2026-06-26', ref)).toBe('later');
    expect(transactionDateGroup('2026-06-20', ref)).toBe('earlier');
  });
});

describe('groupByTransactionDate', () => {
  const ref = new Date(2026, 5, 24, 12, 0, 0);

  it('orders sections from future to past', () => {
    const sections = groupByTransactionDate(
      [
        { tx: tx('old', '2026-06-20') },
        { tx: tx('badminton', '2026-06-26') },
        { tx: tx('trip', '2026-07-01') },
        { tx: tx('daily', '2026-06-23') },
      ],
      ref
    );

    expect(sections.map((s) => s.label)).toEqual(['之後', '昨日', '更早']);
    expect(sections[0].items.map((i) => i.tx.id)).toEqual(['trip', 'badminton']);
  });
});
