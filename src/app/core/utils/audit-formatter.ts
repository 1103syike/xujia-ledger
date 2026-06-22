import { AuditLog } from '../models';

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
    case 'expense.created': {
      const payer = memberName(String(p['payerId'])) ?? String(p['payerId']);
      const splitMode = p['splitMode'] === 'itemized' ? '細分' : '平分';
      const lines = [
        `${actor} 建立了帳款`,
        `項目：${p['title']}`,
        `總額 NT$ ${p['totalAmount']}`,
        `代墊者：${payer} · ${splitMode}`,
      ];
      const splits = p['splits'] as
        | Array<{ name: string; amount: number; items?: Array<{ note: string; amount: number }> }>
        | undefined;
      if (splits?.length) {
        const detail = splits
          .filter((s) => s.amount > 0)
          .map((s) => {
            if (s.items?.length) {
              const items = s.items.map((i) => `${i.note} ${i.amount}`).join('、');
              return `${s.name}：${items}`;
            }
            return `${s.name} NT$ ${s.amount}`;
          })
          .join('；');
        if (detail) lines.push(`分攤明細：${detail}`);
      }
      return { title: '建立帳款', lines };
    }
    case 'expense.updated': {
      const payer = memberName(String(p['payerId'])) ?? String(p['payerId']);
      const splitMode = p['splitMode'] === 'itemized' ? '細分' : '平分';
      const lines = [
        `${actor} 編輯了帳款`,
        `項目：${p['title']}`,
        `總額 NT$ ${p['totalAmount']}`,
        `代墊者：${payer} · ${splitMode}`,
      ];
      if (
        p['previousTitle'] &&
        p['previousTitle'] !== p['title']
      ) {
        lines.push(`原項目：${p['previousTitle']}`);
      }
      if (
        p['previousTotalAmount'] != null &&
        p['previousTotalAmount'] !== p['totalAmount']
      ) {
        lines.push(`原總額 NT$ ${p['previousTotalAmount']}`);
      }
      const splits = p['splits'] as
        | Array<{ name: string; amount: number; items?: Array<{ note: string; amount: number }> }>
        | undefined;
      if (splits?.length) {
        const detail = splits
          .filter((s) => s.amount > 0)
          .map((s) => {
            if (s.items?.length) {
              const items = s.items.map((i) => `${i.note} ${i.amount}`).join('、');
              return `${s.name}：${items}`;
            }
            return `${s.name} NT$ ${s.amount}`;
          })
          .join('；');
        if (detail) lines.push(`分攤明細：${detail}`);
      }
      return { title: '編輯帳款', lines };
    }
    case 'expense.cancelled': {
      const lines = [`${actor} 移除了帳款`];
      if (p['title']) lines.push(`項目：${p['title']}`);
      if (p['totalAmount'] != null) lines.push(`原總額 NT$ ${p['totalAmount']}`);
      return { title: '移除帳款', lines };
    }
    case 'payment.marked': {
      const debtor = memberName(String(p['debtorId'])) ?? String(p['debtorId']);
      const lines = [
        `${debtor} 標記已付款`,
        `項目：${p['title'] ?? '—'}`,
        `金額 NT$ ${p['amount'] ?? '—'}`,
      ];
      return { title: '標記付款', lines };
    }
    case 'payment.confirmed': {
      const debtor = memberName(String(p['debtorId'])) ?? String(p['debtorId']);
      const lines = [
        `${actor} 確認了 ${debtor} 的付款`,
        `項目：${p['title'] ?? '—'}`,
        `金額 NT$ ${p['amount'] ?? '—'}`,
      ];
      return { title: '確認收款', lines };
    }
    case 'payment.unconfirmed': {
      const debtor = memberName(String(p['debtorId'])) ?? String(p['debtorId']);
      const lines = [
        `${actor} 撤銷了 ${debtor} 的收款確認`,
        `項目：${p['title'] ?? '—'}`,
        `金額 NT$ ${p['amount'] ?? '—'}`,
      ];
      return { title: '撤銷確認', lines };
    }
    default:
      return { title: log.action, lines: [actor] };
  }
}
