import { Transaction } from '../models';
import {
  compareTransactionsByDate,
  formatLocalDate,
  normalizeTransactionDate,
  todayLocalDate,
} from './transaction-date';
import { yesterdayLocalDate } from './transaction-date-groups';

export function dayBeforeYesterdayLocalDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 2);
  return formatLocalDate(d);
}

export function participantGroupKey(memberIds: string[]): string {
  return [...memberIds].sort().join(',');
}

/** 該筆分帳實際參與（分攤 > 0）的成員 */
export function participatingMemberIds(tx: Transaction): string[] {
  return tx.participants
    .filter((p) => p.amount > 0)
    .map((p) => p.memberId)
    .sort();
}

export interface ParticipantGroupOption {
  key: string;
  memberIds: string[];
}

/** 個人近期參與組合（去重，最多 limit 組） */
export function recentParticipantGroups(
  transactions: Transaction[],
  viewerId: string,
  allMemberIds: string[],
  limit = 3
): ParticipantGroupOption[] {
  const seen = new Set<string>();
  const groups: ParticipantGroupOption[] = [];

  const sorted = [...transactions]
    .filter(
      (t) =>
        t.type === 'advance' &&
        t.status === 'active' &&
        t.createdBy === viewerId
    )
    .sort(compareTransactionsByDate);

  for (const tx of sorted) {
    const memberIds = participatingMemberIds(tx);
    if (memberIds.length === 0) continue;

    if (isAllMembersGroup(memberIds, allMemberIds)) continue;

    const others = memberIds.filter((id) => id !== viewerId);
    if (others.length === 0) continue;

    const key = participantGroupKey(memberIds);
    if (seen.has(key)) continue;
    seen.add(key);
    groups.push({ key, memberIds });
    if (groups.length >= limit) break;
  }

  return groups;
}

/** 上一筆個人分帳的參與組合；無則 null */
export function lastParticipantGroup(
  transactions: Transaction[],
  viewerId: string
): string[] | null {
  const recent = recentParticipantGroups(transactions, viewerId, [], 1);
  return recent[0]?.memberIds ?? null;
}

export function isAllMembersGroup(
  memberIds: string[],
  allMemberIds: string[]
): boolean {
  if (memberIds.length !== allMemberIds.length) return false;
  const set = new Set(memberIds);
  return allMemberIds.every((id) => set.has(id));
}

/** 個人近期用過的日期（排除今/昨/前，最多 limit 個） */
export function recentUsedDates(
  transactions: Transaction[],
  viewerId: string,
  limit = 3
): string[] {
  const exclude = new Set([
    todayLocalDate(),
    yesterdayLocalDate(),
    dayBeforeYesterdayLocalDate(),
  ]);
  const seen = new Set<string>();
  const dates: string[] = [];

  const sorted = [...transactions]
    .filter((t) => t.status === 'active' && t.createdBy === viewerId)
    .sort(compareTransactionsByDate);

  for (const tx of sorted) {
    const date = normalizeTransactionDate(tx);
    if (exclude.has(date) || seen.has(date)) continue;
    seen.add(date);
    dates.push(date);
    if (dates.length >= limit) break;
  }

  return dates;
}

/** 記帳常用項目（無個人紀錄時的預設建議） */
export const DEFAULT_TITLE_SUGGESTIONS = [
  '超商',
  '晚餐',
  '午餐',
  '加油',
  '生活用品',
  '雜項',
] as const;

/** 個人近期用過的項目名稱（去重，最多 limit 個） */
export function recentUsedTitles(
  transactions: Transaction[],
  viewerId: string,
  limit = 6
): string[] {
  const seen = new Set<string>();
  const titles: string[] = [];

  const sorted = [...transactions]
    .filter(
      (t) =>
        t.type === 'advance' &&
        t.status === 'active' &&
        t.createdBy === viewerId &&
        (t.title?.trim() ?? '') !== ''
    )
    .sort(compareTransactionsByDate);

  for (const tx of sorted) {
    const title = tx.title.trim();
    if (seen.has(title)) continue;
    seen.add(title);
    titles.push(title);
    if (titles.length >= limit) break;
  }

  return titles;
}

/** 項目快捷選項：近期用過優先，不足時補預設建議 */
export function titleSuggestionOptions(
  transactions: Transaction[],
  viewerId: string,
  recentLimit = 6,
  totalLimit = 8
): string[] {
  const recent = recentUsedTitles(transactions, viewerId, recentLimit);
  const seen = new Set(recent);
  const options = [...recent];
  for (const title of DEFAULT_TITLE_SUGGESTIONS) {
    if (options.length >= totalLimit) break;
    if (seen.has(title)) continue;
    seen.add(title);
    options.push(title);
  }
  return options;
}

/** 膠囊顯示用：排除自己的其他參與者名稱 */
export function participantGroupLabel(
  memberIds: string[],
  viewerId: string,
  nameOf: (id: string) => string,
  allMemberIds: string[]
): string {
  if (isAllMembersGroup(memberIds, allMemberIds)) {
    return '全家';
  }
  return memberIds
    .filter((id) => id !== viewerId)
    .map((id) => nameOf(id))
    .filter(Boolean)
    .join('・');
}
