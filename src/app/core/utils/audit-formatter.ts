import { AuditLog } from '../models';
import { formatTransactionDateLabel } from './transaction-date';

export interface AuditDisplay {
  title: string;
  lines: string[];
}

export function formatAuditLog(
  log: AuditLog,
  memberName: (id: string) => string | undefined
): AuditDisplay {
  const p = log.payload ?? {};
  const actor = memberName(log.actorId) ?? log.actorId;

  switch (log.action) {
    case 'transaction.advance.created':
    case 'expense.created': {
      const payer = memberName(String(p['payerId'])) ?? String(p['payerId']);
      const splitMode = p['splitMode'] === 'itemized' ? '細分' : '平分';
      const lines = [`${actor} 建立了代墊`, `項目：${p['title']}`];
      if (p['date']) {
        lines.push(`日期：${formatTransactionDateLabel(String(p['date']))}`);
      }
      lines.push(
        `總額 NT$ ${p['totalAmount']}`,
        `代墊者：${payer} · ${splitMode}`
      );
      const participants = (p['participants'] ?? p['splits']) as
        | Array<{ name: string; amount: number; lineItems?: Array<{ note: string; amount: number }>; items?: Array<{ note: string; amount: number }> }>
        | undefined;
      if (participants?.length) {
        const detail = participants
          .filter((s) => s.amount > 0)
          .map((s) => {
            const items = s.lineItems ?? s.items;
            if (items?.length) {
              const itemStr = items.map((i) => `${i.note} ${i.amount}`).join('、');
              return `${s.name}：${itemStr}`;
            }
            return `${s.name} NT$ ${s.amount}`;
          })
          .join('；');
        if (detail) lines.push(`分攤明細：${detail}`);
      }
      return { title: '建立代墊', lines };
    }
    case 'transaction.repayment.created': {
      const from = memberName(String(p['fromMemberId'])) ?? String(p['fromMemberId']);
      const to = memberName(String(p['toMemberId'])) ?? String(p['toMemberId']);
      const lines = [
        `${actor} 建立了還款`,
        `${from} → ${to}`,
        `金額 NT$ ${p['amount']}`,
      ];
      if (p['date']) {
        lines.push(`日期：${formatTransactionDateLabel(String(p['date']))}`);
      }
      return { title: '建立還款', lines };
    }
    case 'transaction.voided':
    case 'expense.cancelled': {
      const lines = [`${actor} 作廢了交易`];
      if (p['title']) lines.push(`項目：${p['title']}`);
      if (p['totalAmount'] != null) lines.push(`原金額 NT$ ${p['totalAmount']}`);
      return { title: '作廢交易', lines };
    }
    case 'expense.updated': {
      const payer = memberName(String(p['payerId'])) ?? String(p['payerId']);
      const lines = [
        `${actor} 編輯了帳款（舊紀錄）`,
        `項目：${p['title']}`,
        `總額 NT$ ${p['totalAmount']}`,
        `代墊者：${payer}`,
      ];
      return { title: '編輯帳款', lines };
    }
    case 'payment.marked':
    case 'payment.confirmed':
    case 'payment.unconfirmed': {
      const debtor = memberName(String(p['debtorId'])) ?? String(p['debtorId']);
      return {
        title: '舊版付款紀錄',
        lines: [`${actor} / ${debtor} · ${log.action}`, `項目：${p['title'] ?? '—'}`],
      };
    }
    default:
      return { title: log.action, lines: [actor] };
  }
}
