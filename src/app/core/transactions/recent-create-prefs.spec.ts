import { Transaction } from '../models';
import {
  dayBeforeYesterdayLocalDate,
  isAllMembersGroup,
  lastParticipantGroup,
  participantGroupKey,
  participantGroupLabel,
  participatingMemberIds,
  recentParticipantGroups,
  recentUsedDates,
  titleSuggestionOptions,
} from './recent-create-prefs';
import { todayLocalDate } from './transaction-date';
import { yesterdayLocalDate } from './transaction-date-groups';

function advance(
  id: string,
  createdBy: string,
  participantIds: string[],
  date: string,
  title = 'test'
): Transaction {
  return {
    id,
    accountId: 'default',
    type: 'advance',
    title,
    date,
    totalAmount: 100,
    payerId: createdBy,
    splitMode: 'equal',
    status: 'active',
    createdBy,
    createdAt: `${date}T12:00:00.000Z`,
    updatedAt: `${date}T12:00:00.000Z`,
    participants: participantIds.map((memberId) => ({
      memberId,
      amount: 50,
      signedAmount: memberId === createdBy ? 50 : -50,
    })),
  };
}

describe('recent-create-prefs', () => {
  const all = ['m1', 'm2', 'm3', 'm4', 'm5'];
  const viewer = 'm4';

  it('extracts participating members', () => {
    expect(participatingMemberIds(advance('1', viewer, ['m4', 'm1'], '2026-06-20'))).toEqual([
      'm1',
      'm4',
    ]);
  });

  it('returns recent participant groups deduped', () => {
    const txs = [
      advance('1', viewer, ['m4', 'm1'], '2026-06-22'),
      advance('2', viewer, ['m4', 'm1'], '2026-06-21'),
      advance('3', viewer, ['m4', 'm3'], '2026-06-20'),
    ];
    const groups = recentParticipantGroups(txs, viewer, all, 3);
    expect(groups.map((g) => g.memberIds)).toEqual([
      ['m1', 'm4'],
      ['m3', 'm4'],
    ]);
  });

  it('skips solo viewer-only and all-member groups from recent chips', () => {
    const soloViewer: Transaction = {
      ...advance('solo', viewer, [viewer], '2026-06-23'),
      participants: [{ memberId: viewer, amount: 100, signedAmount: 0 }],
    };
    const allGroup = advance('all', viewer, all, '2026-06-22');
    const pair = advance('pair', viewer, ['m4', 'm1'], '2026-06-21');
    const groups = recentParticipantGroups(
      [soloViewer, allGroup, pair],
      viewer,
      all,
      3
    );
    expect(groups.map((g) => g.memberIds)).toEqual([['m1', 'm4']]);
  });

  it('labels pair and all groups', () => {
    const nameOf = (id: string) =>
      ({ m1: '林庭郁', m4: '許育愷' })[id] ?? id;
    expect(
      participantGroupLabel(['m1', 'm4'], viewer, nameOf, all)
    ).toBe('林庭郁');
    expect(participantGroupLabel(['m4'], viewer, nameOf, all)).toBe('');
    expect(participantGroupLabel(all, viewer, nameOf, all)).toBe('全家');
    expect(isAllMembersGroup(all, all)).toBe(true);
  });

  it('returns last participant group', () => {
    const txs = [advance('1', viewer, ['m4', 'm1'], '2026-06-22')];
    expect(lastParticipantGroup(txs, viewer)).toEqual(['m1', 'm4']);
  });

  it('excludes today yesterday day before from recent dates', () => {
    const today = todayLocalDate();
    const yesterday = yesterdayLocalDate();
    const dayBefore = dayBeforeYesterdayLocalDate();
    const txs = [
      advance('1', viewer, ['m4', 'm1'], today),
      advance('2', viewer, ['m4', 'm1'], yesterday),
      advance('3', viewer, ['m4', 'm1'], dayBefore),
      advance('4', viewer, ['m4', 'm1'], '2026-06-10'),
      advance('5', viewer, ['m4', 'm1'], '2026-06-08'),
    ];
    expect(recentUsedDates(txs, viewer, 3)).toEqual([
      '2026-06-10',
      '2026-06-08',
    ]);
  });

  it('builds stable group keys', () => {
    expect(participantGroupKey(['m2', 'm1'])).toBe('m1,m2');
  });

  it('returns recent titles deduped with defaults filling in', () => {
    const txs = [
      advance('1', viewer, ['m4', 'm1'], '2026-06-22', '火鍋'),
      advance('2', viewer, ['m4', 'm1'], '2026-06-21', '火鍋'),
      advance('3', viewer, ['m4', 'm3'], '2026-06-20', '超商'),
    ];
    expect(titleSuggestionOptions(txs, viewer, 6, 8)).toEqual([
      '火鍋',
      '超商',
      '晚餐',
      '午餐',
      '加油',
      '生活用品',
      '雜項',
    ]);
  });
});
