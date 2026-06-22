import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import {
  AuditLog,
  CreateExpenseInput,
  Expense,
  ExpenseSplit,
} from '../models';
import {
  buildSplitPreview,
  previewToSplits,
  validateCreateInput,
} from '../utils/split-calculator';
import { AuthService } from './auth.service';

const STORAGE_EXPENSES = 'xujia-expenses';
const STORAGE_AUDIT = 'xujia-audit';

@Injectable({ providedIn: 'root' })
export class ExpenseService {
  private readonly expensesSubject = new BehaviorSubject<Expense[]>(
    this.loadExpenses()
  );
  private readonly auditSubject = new BehaviorSubject<AuditLog[]>(
    this.loadAudit()
  );

  readonly expenses$ = this.expensesSubject.asObservable();
  readonly auditLogs$ = this.auditSubject.asObservable();

  constructor(private auth: AuthService) {}

  get expenses(): Expense[] {
    return this.expensesSubject.value;
  }

  get auditLogs(): AuditLog[] {
    return this.auditSubject.value;
  }

  getExpense(id: string): Expense | undefined {
    return this.expenses.find((e) => e.id === id);
  }

  createExpense(input: CreateExpenseInput): string | null {
    const actor = this.auth.currentMember;
    if (!actor) return '請先登入';

    const error = validateCreateInput(input, this.auth.members);
    if (error) return error;

    const seed = crypto.randomUUID?.() ?? `${Date.now()}`;
    const preview = buildSplitPreview({ ...input, remainderSeed: seed }, this.auth.members);
    const splits = previewToSplits(preview, input.splitNotes);
    const now = new Date().toISOString();

    const expense: Expense = {
      id: seed,
      title: input.title.trim(),
      totalAmount: input.totalAmount,
      payerId: input.payerId,
      participantScope: input.participantScope,
      participantIds:
        input.participantScope === 'all'
          ? this.auth.members.map((m) => m.id)
          : [...input.participantIds],
      splitMode: input.splitMode,
      note: input.note?.trim() || null,
      remainderBearerId: preview.remainderBearerId,
      remainderAmount: preview.remainderAmount,
      status: 'open',
      createdBy: actor.id,
      createdAt: now,
      updatedAt: now,
      splits,
    };

    this.persistExpenses([expense, ...this.expenses]);
    this.addAudit({
      actorId: actor.id,
      action: 'expense.created',
      entityType: 'expense',
      entityId: expense.id,
      payload: { expense },
    });

    return null;
  }

  cancelExpense(expenseId: string): string | null {
    const actor = this.auth.currentMember;
    if (!actor) return '請先登入';

    const expenses = this.expenses.map((e) => {
      if (e.id !== expenseId) return e;
      return {
        ...e,
        status: 'cancelled' as const,
        updatedAt: new Date().toISOString(),
      };
    });

    this.persistExpenses(expenses);
    this.addAudit({
      actorId: actor.id,
      action: 'expense.cancelled',
      entityType: 'expense',
      entityId: expenseId,
      payload: {},
    });

    return null;
  }

  markPaid(expenseId: string): string | null {
    const actor = this.auth.currentMember;
    if (!actor) return '請先登入';

    const expense = this.expenses.find((e) => e.id === expenseId && e.status === 'open');
    if (!expense) return '找不到帳款';

    const split = expense.splits.find((s) => s.memberId === actor.id);
    if (!split) return '你不在分攤名單中';
    if (actor.id === expense.payerId) return '代墊者不需標記繳款';
    if (split.paymentStatus === 'confirmed') return '已結清';
    if (split.paymentStatus === 'marked') return '已標記';

    return this.applySplitUpdate(expenseId, actor.id, 'marked', 'payment.marked');
  }

  confirmPayment(expenseId: string, debtorId: string): string | null {
    const actor = this.auth.currentMember;
    if (!actor) return '請先登入';

    const expense = this.expenses.find((e) => e.id === expenseId && e.status === 'open');
    if (!expense) return '找不到帳款';
    if (expense.payerId !== actor.id) return '只有代墊者可確認收款';

    const split = expense.splits.find((s) => s.memberId === debtorId);
    if (!split) return '對象不符';
    if (split.paymentStatus !== 'marked') return '對方尚未標記已付';

    return this.applySplitUpdate(expenseId, debtorId, 'confirmed', 'payment.confirmed');
  }

  unconfirmPayment(expenseId: string, debtorId: string): string | null {
    const actor = this.auth.currentMember;
    if (!actor) return '請先登入';

    const expense = this.expenses.find((e) => e.id === expenseId && e.status === 'open');
    if (!expense) return '找不到帳款';
    if (expense.payerId !== actor.id) return '只有代墊者可撤銷確認';

    const split = expense.splits.find((s) => s.memberId === debtorId);
    if (!split) return '對象不符';
    if (split.paymentStatus !== 'confirmed') return '尚未確認收款';

    return this.applySplitUpdate(expenseId, debtorId, 'marked', 'payment.unconfirmed');
  }

  private applySplitUpdate(
    expenseId: string,
    targetMemberId: string,
    nextStatus: ExpenseSplit['paymentStatus'],
    action: string
  ): string | null {
    const actor = this.auth.currentMember;
    if (!actor) return '請先登入';

    const now = new Date().toISOString();
    const expenses = this.expenses.map((expense) => {
      if (expense.id !== expenseId) return expense;

      const splits = expense.splits.map((split) => {
        if (split.memberId !== targetMemberId) return split;
        return {
          ...split,
          paymentStatus: nextStatus,
          markedAt: split.markedAt ?? now,
          confirmedAt: nextStatus === 'confirmed' ? now : null,
        };
      });

      return { ...expense, splits, updatedAt: now };
    });

    this.persistExpenses(expenses);
    this.addAudit({
      actorId: actor.id,
      action,
      entityType: 'expense',
      entityId: expenseId,
      payload: { debtorId: targetMemberId, nextStatus },
    });

    return null;
  }

  private addAudit(
    partial: Omit<AuditLog, 'id' | 'createdAt'>
  ): void {
    const log: AuditLog = {
      ...partial,
      id: crypto.randomUUID?.() ?? String(Date.now()),
      createdAt: new Date().toISOString(),
    };
    const logs = [log, ...this.auditLogs];
    localStorage.setItem(STORAGE_AUDIT, JSON.stringify(logs));
    this.auditSubject.next(logs);
  }

  private persistExpenses(expenses: Expense[]): void {
    localStorage.setItem(STORAGE_EXPENSES, JSON.stringify(expenses));
    this.expensesSubject.next(expenses);
  }

  private loadExpenses(): Expense[] {
    try {
      const raw = localStorage.getItem(STORAGE_EXPENSES);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private loadAudit(): AuditLog[] {
    try {
      const raw = localStorage.getItem(STORAGE_AUDIT);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }
}
