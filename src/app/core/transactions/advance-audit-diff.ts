import { AdvancePayer, LineItem, Transaction } from '../models';
import { COPY_ERRORS, COPY_RECORD_TYPE, COPY_SPLIT, COPY_TERMS } from '../../copy';
import { getAdvancePayers } from '../transactions/advance-allocation';
import { formatTransactionDateLabel } from '../transactions/transaction-date';

export interface AuditFieldChange {
  field: string;
  before: string;
  after: string;
}

function normalizeNote(note: string | null | undefined): string | null {
  const trimmed = note?.trim();
  return trimmed || null;
}

function formatPayers(
  payers: AdvancePayer[],
  nameOf: (id: string) => string
): string {
  return [...payers]
    .sort((a, b) => a.memberId.localeCompare(b.memberId))
    .map((p) => `${nameOf(p.memberId)} NT$ ${p.amount}`)
    .join('、');
}

function participantAmountMap(tx: Transaction): Map<string, number> {
  const map = new Map<string, number>();
  for (const p of tx.participants) {
    map.set(p.memberId, p.amount);
  }
  return map;
}

function isAutoLineItem(item: LineItem): boolean {
  return item.note.includes('找錢') || item.note === '待他人結算';
}

function manualLineItems(items: LineItem[] | undefined): LineItem[] {
  return (items ?? [])
    .filter((item) => !isAutoLineItem(item))
    .map((item) => ({ note: item.note.trim(), amount: item.amount }))
    .sort((a, b) => a.note.localeCompare(b.note) || a.amount - b.amount);
}

function formatLineItems(items: LineItem[]): string {
  if (items.length === 0) return '—';
  return items.map((item) => `${item.note} NT$ ${item.amount}`).join('、');
}

function formatSplitStatus(
  memberId: string,
  amount: number,
  isPayer: boolean,
  nameOf: (id: string) => string
): string {
  if (amount > 0) return `${nameOf(memberId)} NT$ ${amount}`;
  if (isPayer) return `${nameOf(memberId)}（付款人不用分）`;
  return `${nameOf(memberId)}（${COPY_TERMS.noSplit}）`;
}

function pushChange(
  changes: AuditFieldChange[],
  field: string,
  before: string,
  after: string
): void {
  if (before === after) return;
  changes.push({ field, before, after });
}

/** 比對代墊交易編輯前後的實質差異 */
export function diffAdvanceUpdate(
  before: Transaction,
  after: Transaction,
  nameOf: (id: string) => string
): AuditFieldChange[] {
  const changes: AuditFieldChange[] = [];

  pushChange(changes, '項目', before.title, after.title);

  const beforeDate = before.date ?? '';
  const afterDate = after.date ?? '';
  if (beforeDate !== afterDate) {
    pushChange(
      changes,
      '日期',
      beforeDate ? formatTransactionDateLabel(beforeDate) : '—',
      afterDate ? formatTransactionDateLabel(afterDate) : '—'
    );
  }

  pushChange(
    changes,
    '總額',
    `NT$ ${before.totalAmount}`,
    `NT$ ${after.totalAmount}`
  );

  const beforeBill = before.billTotal ?? null;
  const afterBill = after.billTotal ?? null;
  if (beforeBill !== afterBill) {
    pushChange(
      changes,
      '帳單總額',
      beforeBill != null ? `NT$ ${beforeBill}` : '—',
      afterBill != null ? `NT$ ${afterBill}` : '—'
    );
  }

  const beforeNote = normalizeNote(before.note);
  const afterNote = normalizeNote(after.note);
  if (beforeNote !== afterNote) {
    pushChange(changes, '備註', beforeNote ?? '—', afterNote ?? '—');
  }

  const beforeMode =
    before.splitMode === 'itemized' ? COPY_SPLIT.custom : COPY_SPLIT.equal;
  const afterMode =
    after.splitMode === 'itemized' ? COPY_SPLIT.custom : COPY_SPLIT.equal;
  pushChange(changes, '分攤方式', beforeMode, afterMode);

  const beforePayers = getAdvancePayers(before);
  const afterPayers = getAdvancePayers(after);
  const beforePayerLabel = formatPayers(beforePayers, nameOf);
  const afterPayerLabel = formatPayers(afterPayers, nameOf);
  pushChange(changes, COPY_TERMS.payer, beforePayerLabel, afterPayerLabel);

  const beforeAmounts = participantAmountMap(before);
  const afterAmounts = participantAmountMap(after);
  const payerIds = new Set([
    ...beforePayers.map((p) => p.memberId),
    ...afterPayers.map((p) => p.memberId),
  ]);
  const memberIds = new Set([...beforeAmounts.keys(), ...afterAmounts.keys()]);

  for (const memberId of [...memberIds].sort()) {
    const beforeAmount = beforeAmounts.get(memberId) ?? 0;
    const afterAmount = afterAmounts.get(memberId) ?? 0;
    if (beforeAmount === afterAmount) continue;

    pushChange(
      changes,
      '分攤',
      formatSplitStatus(memberId, beforeAmount, payerIds.has(memberId), nameOf),
      formatSplitStatus(memberId, afterAmount, payerIds.has(memberId), nameOf)
    );
  }

  if (after.splitMode === 'itemized') {
    for (const memberId of [...memberIds].sort()) {
      const beforeParticipant = before.participants.find(
        (p) => p.memberId === memberId
      );
      const afterParticipant = after.participants.find(
        (p) => p.memberId === memberId
      );
      const beforeItems = formatLineItems(
        manualLineItems(beforeParticipant?.lineItems)
      );
      const afterItems = formatLineItems(
        manualLineItems(afterParticipant?.lineItems)
      );
      if (beforeItems === afterItems) continue;

      pushChange(
        changes,
        `${nameOf(memberId)} 細項`,
        beforeItems,
        afterItems
      );
    }
  }

  return changes;
}

export function hasAdvanceUpdateChanges(
  before: Transaction,
  after: Transaction,
  nameOf: (id: string) => string
): boolean {
  return diffAdvanceUpdate(before, after, nameOf).length > 0;
}
