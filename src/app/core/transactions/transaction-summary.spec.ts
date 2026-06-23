import { Transaction } from '../models';
import { formatTransactionStoryLine } from '../transactions/transaction-summary';

const nameOf = (id: string) =>
  (
    {
      p1: '許育愷',
      p2: '林庭郁',
      p3: '鄭丞恩',
      m1: '林榆凱',
      m2: '黃品瑜',
    } as Record<string, string>
  )[id] ?? id;

function advance(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: '1',
    accountId: 'default',
    type: 'advance',
    title: '火鍋',
    totalAmount: 2500,
    payerId: 'p1',
    payers: [{ memberId: 'p1', amount: 2500 }],
    splitMode: 'equal',
    status: 'active',
    createdBy: 'p1',
    createdAt: '',
    updatedAt: '',
    participants: [
      { memberId: 'p1', amount: 500 },
      { memberId: 'p2', amount: 500 },
      { memberId: 'p3', amount: 500 },
      { memberId: 'm1', amount: 500 },
      { memberId: 'm2', amount: 500 },
    ],
    ...overrides,
  };
}

describe('transaction-summary', () => {
  it('formats equal split as story line', () => {
    expect(formatTransactionStoryLine(advance(), nameOf)).toBe(
      '許育愷 付款 · 5 人分'
    );
  });

  it('formats itemized split with item names', () => {
    const tx = advance({
      title: '生活用品',
      splitMode: 'itemized',
      totalAmount: 178,
      payers: [{ memberId: 'p2', amount: 178 }],
      payerId: 'p2',
      participants: [
        {
          memberId: 'p3',
          amount: 178,
          lineItems: [
            { note: '雨鞋', amount: 99 },
            { note: '慕斯瓶', amount: 79 },
          ],
        },
      ],
    });

    expect(formatTransactionStoryLine(tx, nameOf)).toBe(
      '林庭郁 付款 · 雨鞋、慕斯瓶'
    );
  });

  it('formats single sharer by name', () => {
    const tx = advance({
      totalAmount: 3500,
      participants: [{ memberId: 'm2', amount: 3500 }],
    });

    expect(formatTransactionStoryLine(tx, nameOf)).toBe(
      '許育愷 付款 · 林庭郁 承擔'
    );
  });

  it('formats repayment as story', () => {
    const tx: Transaction = {
      id: '1',
      accountId: 'default',
      type: 'repayment',
      title: '還款',
      totalAmount: 500,
      payerId: 'p2',
      fromMemberId: 'p3',
      status: 'active',
      createdBy: 'p3',
      createdAt: '',
      updatedAt: '',
      participants: [],
    };

    expect(formatTransactionStoryLine(tx, nameOf)).toBe('鄭丞恩 還給 林庭郁');
  });
});
