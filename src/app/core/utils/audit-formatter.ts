import { AuditLog } from '../models';
import { COPY_ACTIONS, COPY_RECORD_TYPE, COPY_TERMS } from '../../copy';
import { formatTransactionDateLabel } from './transaction-date';
import { formatTransactionStoryLine } from './transaction-summary';
import { Transaction } from '../models';

export interface AuditDisplay {
  title: string;
  lines: string[];
  /** 可連結至記錄詳情 */
  entityId?: string;
  entityType?: string;
}

function storyFromPayload(
  p: Record<string, unknown>,
  nameOf: (id: string) => string | undefined
): string {
  const title = String(p['title'] ?? '—');
  const stub: Transaction = {
    id: 'audit',
    accountId: 'default',
    type: 'advance',
    title,
    totalAmount: Number(p['totalAmount'] ?? 0),
    payerId: String(p['payerId'] ?? ''),
    payers: (p['payers'] as Transaction['payers']) ?? [],
    splitMode: p['splitMode'] === 'itemized' ? 'itemized' : 'equal',
    status: 'active',
    createdBy: '',
    createdAt: '',
    updatedAt: '',
    participants:
      (p['participants'] as Transaction['participants']) ??
      (p['splits'] as Transaction['participants']) ??
      [],
  };
  return formatTransactionStoryLine(stub, (id) => nameOf(id) ?? id);
}

export function formatAuditLog(
  log: AuditLog,
  memberName: (id: string) => string | undefined
): AuditDisplay {
  const p = log.payload ?? {};
  const actor = memberName(log.actorId) ?? log.actorId;
  const title = p['title'] ? String(p['title']) : null;
  const entityId =
    log.entityType === 'transaction' ? log.entityId : undefined;

  switch (log.action) {
    case 'transaction.advance.created':
    case 'expense.created': {
      const story = storyFromPayload(p, memberName);
      const lines = [`${actor}`, story];
      if (p['date']) {
        lines.push(`日期 ${formatTransactionDateLabel(String(p['date']))}`);
      }
      if (p['totalAmount'] != null) {
        lines.push(`金額 NT$ ${p['totalAmount']}`);
      }
      return {
        title: title ? `記了「${title}」` : COPY_ACTIONS.addRecord,
        lines,
        entityId,
        entityType: log.entityType,
      };
    }
    case 'transaction.repayment.created': {
      const from = memberName(String(p['fromMemberId'])) ?? String(p['fromMemberId']);
      const to = memberName(String(p['toMemberId'])) ?? String(p['toMemberId']);
      const lines = [
        `${actor}`,
        `${from} 還給 ${to} · NT$ ${p['amount']}`,
      ];
      if (p['date']) {
        lines.push(`日期 ${formatTransactionDateLabel(String(p['date']))}`);
      }
      return {
        title: COPY_ACTIONS.addRepayment,
        lines,
        entityId,
        entityType: log.entityType,
      };
    }
    case 'transaction.transfer.created': {
      const edges = (p['transferEdges'] ?? []) as Array<{
        fromName: string;
        toName: string;
        amount: number;
      }>;
      const lines = [
        `${actor}`,
        `整合了 ${(p['sourceTransactionIds'] as string[] | undefined)?.length ?? 0} 筆記錄`,
      ];
      if (p['date']) {
        lines.push(`日期 ${formatTransactionDateLabel(String(p['date']))}`);
      }
      for (const e of edges.slice(0, 5)) {
        lines.push(`${e.fromName} → ${e.toName} NT$ ${e.amount}`);
      }
      return {
        title: COPY_RECORD_TYPE.consolidate,
        lines,
        entityId,
        entityType: log.entityType,
      };
    }
    case 'transaction.voided':
    case 'expense.cancelled': {
      const lines = [`${actor}`];
      if (title) lines.push(`「${title}」`);
      if (p['totalAmount'] != null) lines.push(`原金額 NT$ ${p['totalAmount']}`);
      return {
        title: title ? `取消了「${title}」` : COPY_TERMS.cancelRecord,
        lines,
        entityId,
        entityType: log.entityType,
      };
    }
    case 'expense.updated':
    case 'transaction.advance.updated': {
      const changes = (p['changes'] ?? []) as Array<{
        field: string;
        before: string;
        after: string;
      }>;
      const lines = [`${actor}`];
      if (title) lines.push(`「${title}」`);
      if (changes.length > 0) {
        for (const change of changes) {
          lines.push(`${change.field}：${change.before} → ${change.after}`);
        }
      } else if (p['totalAmount'] != null) {
        lines.push(`金額 NT$ ${p['totalAmount']}`);
      }
      return {
        title: title ? `改了「${title}」` : '修改記錄',
        lines,
        entityId,
        entityType: log.entityType,
      };
    }
    case 'payment.marked':
    case 'payment.confirmed':
    case 'payment.unconfirmed': {
      const debtor = memberName(String(p['debtorId'])) ?? String(p['debtorId']);
      return {
        title: '舊版紀錄',
        lines: [`${actor} · ${debtor}`, `項目：${p['title'] ?? '—'}`],
      };
    }
    default:
      return { title: log.action, lines: [actor] };
  }
}
