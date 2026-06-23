import { Transaction } from '../models';
import { diffAdvanceUpdate, hasAdvanceUpdateChanges } from './advance-audit-diff';

const nameOf = (id: string) =>
  (
    {
      tingyu: '林庭郁',
      user: '鄭丞恩',
      m3: '林榆凱',
    } as Record<string, string>
  )[id] ?? id;

function advance(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: '1',
    accountId: 'default',
    type: 'advance',
    title: '晚餐',
    date: '2026-06-20',
    totalAmount: 1485,
    payerId: 'user',
    payers: [
      { memberId: 'tingyu', amount: 1000 },
      { memberId: 'user', amount: 1000 },
    ],
    splitMode: 'equal',
    status: 'active',
    createdBy: 'user',
    createdAt: '2026-06-20T00:00:00.000Z',
    updatedAt: '2026-06-20T00:00:00.000Z',
    participants: [
      { memberId: 'tingyu', amount: 0 },
      { memberId: 'user', amount: 371 },
      { memberId: 'm3', amount: 371 },
    ],
    ...overrides,
  };
}

describe('advance-audit-diff', () => {
  it('returns no changes when data is equivalent', () => {
    const before = advance();
    const after = advance({
      participants: before.participants.map((p) => ({ ...p })),
      updatedAt: '2026-06-21T00:00:00.000Z',
    });

    expect(hasAdvanceUpdateChanges(before, after, nameOf)).toBe(false);
    expect(diffAdvanceUpdate(before, after, nameOf)).toEqual([]);
  });

  it('detects total and split changes', () => {
    const before = advance();
    const after = advance({
      totalAmount: 1500,
      participants: [
        { memberId: 'tingyu', amount: 0 },
        { memberId: 'user', amount: 375 },
        { memberId: 'm3', amount: 375 },
      ],
    });

    const changes = diffAdvanceUpdate(before, after, nameOf);
    expect(changes).toContain({
      field: '總額',
      before: 'NT$ 1485',
      after: 'NT$ 1500',
    });
    expect(changes).toContain({
      field: '分攤',
      before: '鄭丞恩 NT$ 371',
      after: '鄭丞恩 NT$ 375',
    });
    expect(changes).toContain({
      field: '分攤',
      before: '林榆凱 NT$ 371',
      after: '林榆凱 NT$ 375',
    });
  });

  it('detects payer and exempt status changes', () => {
    const before = advance();
    const after = advance({
      participants: [
        { memberId: 'tingyu', amount: 371 },
        { memberId: 'user', amount: 371 },
        { memberId: 'm3', amount: 371 },
      ],
    });

    const changes = diffAdvanceUpdate(before, after, nameOf);
    expect(changes).toContain({
      field: '分攤',
      before: '林庭郁（付款人不用分）',
      after: '林庭郁 NT$ 371',
    });
  });
});
