import { Injectable, OnDestroy } from '@angular/core';
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { BehaviorSubject } from 'rxjs';
import { firestoreDb } from '../firebase';
import {
  AuditLog,
  CreateExpenseInput,
  Expense,
  ExpenseSplit,
} from '../models';
import {
  buildSplitPreview,
  mergeSplitsPreservingPayment,
  previewToSplits,
  validateCreateInput,
} from '../utils/split-calculator';
import { formatFirestoreError, stripUndefined } from '../utils/firestore-data';
import {
  compareExpensesByDate,
  normalizeExpense,
} from '../utils/expense-date';
import { AuthService } from './auth.service';

function memberName(
  auth: AuthService,
  id: string
): string {
  return auth.getMember(id)?.name ?? id;
}

@Injectable({ providedIn: 'root' })
export class ExpenseService implements OnDestroy {
  private readonly expensesSubject = new BehaviorSubject<Expense[]>([]);
  private readonly auditSubject = new BehaviorSubject<AuditLog[]>([]);
  private unsubscribers: Array<() => void> = [];

  readonly expenses$ = this.expensesSubject.asObservable();
  readonly auditLogs$ = this.auditSubject.asObservable();

  constructor(private auth: AuthService) {
    this.auth.currentMember$.subscribe((member) => {
      this.detachListeners();
      if (member) this.attachListeners();
      else {
        this.expensesSubject.next([]);
        this.auditSubject.next([]);
      }
    });
  }

  ngOnDestroy(): void {
    this.detachListeners();
  }

  get expenses(): Expense[] {
    return this.expensesSubject.value;
  }

  get auditLogs(): AuditLog[] {
    return this.auditSubject.value;
  }

  getExpense(id: string): Expense | undefined {
    return this.expenses.find((e) => e.id === id);
  }

  async createExpense(input: CreateExpenseInput): Promise<string | null> {
    const actor = this.auth.currentMember;
    if (!actor) return '請先登入帳號';

    const error = validateCreateInput(input, this.auth.getAllMembers());
    if (error) return error;

    const seed = crypto.randomUUID?.() ?? `${Date.now()}`;
    const preview = buildSplitPreview({ ...input, remainderSeed: seed }, this.auth.getAllMembers());
    const splits = previewToSplits(preview, input.splitNotes, input.splitItems);
    const now = new Date().toISOString();

    const expense: Expense = {
      id: seed,
      title: input.title.trim(),
      date: input.date,
      totalAmount: input.totalAmount,
      billTotal: input.billTotal ?? null,
      payerId: input.payerId,
      participantScope: input.participantScope,
      participantIds:
        input.participantScope === 'all'
          ? this.auth.getAllMembers().map((m) => m.id)
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

    try {
      await setDoc(
        doc(firestoreDb, 'expenses', expense.id),
        stripUndefined(expense)
      );
      await this.addAudit({
        actorId: actor.id,
        action: 'expense.created',
        entityType: 'expense',
        entityId: expense.id,
        payload: stripUndefined({
          title: expense.title,
          date: expense.date,
          totalAmount: expense.totalAmount,
          payerId: expense.payerId,
          payerName: memberName(this.auth, expense.payerId),
          splitMode: expense.splitMode,
          note: expense.note,
          splits: expense.splits.map((s) => ({
            memberId: s.memberId,
            name: memberName(this.auth, s.memberId),
            amount: s.amount,
            items: s.items,
          })),
        }),
      });
      return null;
    } catch (error) {
      console.error('createExpense failed', error);
      return formatFirestoreError(error);
    }
  }

  async updateExpense(
    expenseId: string,
    input: CreateExpenseInput
  ): Promise<string | null> {
    const actor = this.auth.currentMember;
    if (!actor) return '請先登入帳號';

    const existing = this.expenses.find((e) => e.id === expenseId);
    if (!existing) return '找不到此筆帳款';
    if (existing.status !== 'open') return '此筆帳款已移除，無法編輯';

    const error = validateCreateInput(input, this.auth.getAllMembers());
    if (error) return error;

    const seed = input.remainderSeed ?? expenseId;
    const preview = buildSplitPreview(
      { ...input, remainderSeed: seed },
      this.auth.getAllMembers()
    );
    const freshSplits = previewToSplits(
      preview,
      input.splitNotes,
      input.splitItems
    );
    const splits = mergeSplitsPreservingPayment(existing.splits, freshSplits);
    const now = new Date().toISOString();

    const updated: Expense = {
      ...existing,
      title: input.title.trim(),
      date: input.date,
      totalAmount: input.totalAmount,
      billTotal: input.billTotal ?? null,
      payerId: input.payerId,
      participantScope: input.participantScope,
      participantIds:
        input.participantScope === 'all'
          ? this.auth.getAllMembers().map((m) => m.id)
          : [...input.participantIds],
      splitMode: input.splitMode,
      note: input.note?.trim() || null,
      remainderBearerId: preview.remainderBearerId,
      remainderAmount: preview.remainderAmount,
      updatedAt: now,
      splits,
    };

    try {
      await updateDoc(
        doc(firestoreDb, 'expenses', expenseId),
        stripUndefined({
          title: updated.title,
          date: updated.date,
          totalAmount: updated.totalAmount,
          billTotal: updated.billTotal,
          payerId: updated.payerId,
          participantScope: updated.participantScope,
          participantIds: updated.participantIds,
          splitMode: updated.splitMode,
          note: updated.note,
          remainderBearerId: updated.remainderBearerId,
          remainderAmount: updated.remainderAmount,
          updatedAt: updated.updatedAt,
          splits: updated.splits,
        })
      );
      await this.addAudit({
        actorId: actor.id,
        action: 'expense.updated',
        entityType: 'expense',
        entityId: expenseId,
        payload: stripUndefined({
          title: updated.title,
          date: updated.date,
          totalAmount: updated.totalAmount,
          payerId: updated.payerId,
          payerName: memberName(this.auth, updated.payerId),
          splitMode: updated.splitMode,
          note: updated.note,
          previousTitle: existing.title,
          previousDate: existing.date,
          previousTotalAmount: existing.totalAmount,
          splits: updated.splits.map((s) => ({
            memberId: s.memberId,
            name: memberName(this.auth, s.memberId),
            amount: s.amount,
            items: s.items,
          })),
        }),
      });
      return null;
    } catch (error) {
      console.error('updateExpense failed', error);
      return formatFirestoreError(error);
    }
  }

  async cancelExpense(expenseId: string): Promise<string | null> {
    const actor = this.auth.currentMember;
    if (!actor) return '請先登入帳號';

    const expense = this.expenses.find((e) => e.id === expenseId);
    if (!expense) return '找不到此筆帳款';

    try {
      await updateDoc(doc(firestoreDb, 'expenses', expenseId), {
        status: 'cancelled',
        updatedAt: new Date().toISOString(),
      });
      await this.addAudit({
        actorId: actor.id,
        action: 'expense.cancelled',
        entityType: 'expense',
        entityId: expenseId,
        payload: {
          title: expense.title,
          date: expense.date,
          totalAmount: expense.totalAmount,
        },
      });
      return null;
    } catch {
      return '移除失敗，請稍後再試';
    }
  }

  async markPaid(expenseId: string): Promise<string | null> {
    const actor = this.auth.currentMember;
    if (!actor) return '請先登入帳號';

    const expense = this.expenses.find((e) => e.id === expenseId && e.status === 'open');
    if (!expense) return '找不到此筆帳款';

    const split = expense.splits.find((s) => s.memberId === actor.id);
    if (!split) return '您不在此筆帳款的分攤名單中';
    if (actor.id === expense.payerId) return '代墊者無需標記付款';
    if (split.amount <= 0) return '此筆帳款無需付款';
    if (split.paymentStatus === 'confirmed') return '此筆款項已結清';
    if (split.paymentStatus === 'marked') return '您已標記付款，待代墊者確認';

    return this.applySplitUpdate(expenseId, actor.id, 'marked', 'payment.marked');
  }

  async confirmPayment(expenseId: string, debtorId: string): Promise<string | null> {
    const actor = this.auth.currentMember;
    if (!actor) return '請先登入帳號';

    const expense = this.expenses.find((e) => e.id === expenseId && e.status === 'open');
    if (!expense) return '找不到此筆帳款';
    if (expense.payerId !== actor.id) return '僅代墊者可確認收款';

    const split = expense.splits.find((s) => s.memberId === debtorId);
    if (!split) return '找不到對應的分攤紀錄';
    if (split.paymentStatus !== 'marked') return '對方尚未標記付款';

    return this.applySplitUpdate(expenseId, debtorId, 'confirmed', 'payment.confirmed');
  }

  async unconfirmPayment(expenseId: string, debtorId: string): Promise<string | null> {
    const actor = this.auth.currentMember;
    if (!actor) return '請先登入帳號';

    const expense = this.expenses.find((e) => e.id === expenseId && e.status === 'open');
    if (!expense) return '找不到此筆帳款';
    if (expense.payerId !== actor.id) return '僅代墊者可撤銷確認';

    const split = expense.splits.find((s) => s.memberId === debtorId);
    if (!split) return '找不到對應的分攤紀錄';
    if (split.paymentStatus !== 'confirmed') return '此筆款項尚未確認收款';

    return this.applySplitUpdate(expenseId, debtorId, 'marked', 'payment.unconfirmed');
  }

  private async applySplitUpdate(
    expenseId: string,
    targetMemberId: string,
    nextStatus: ExpenseSplit['paymentStatus'],
    action: string
  ): Promise<string | null> {
    const actor = this.auth.currentMember;
    if (!actor) return '請先登入帳號';

    const expense = this.expenses.find((e) => e.id === expenseId);
    if (!expense) return '找不到此筆帳款';

    const now = new Date().toISOString();
    const splits = expense.splits.map((split) => {
      if (split.memberId !== targetMemberId) return split;
      return {
        ...split,
        paymentStatus: nextStatus,
        markedAt: split.markedAt ?? now,
        confirmedAt: nextStatus === 'confirmed' ? now : null,
      };
    });

    try {
      await updateDoc(doc(firestoreDb, 'expenses', expenseId), {
        splits: stripUndefined(splits),
        updatedAt: now,
      });
      await this.addAudit({
        actorId: actor.id,
        action,
        entityType: 'expense',
        entityId: expenseId,
        payload: stripUndefined({
          debtorId: targetMemberId,
          debtorName: memberName(this.auth, targetMemberId),
          title: expense.title,
          amount: expense.splits.find((s) => s.memberId === targetMemberId)?.amount,
          nextStatus,
        }),
      });
      return null;
    } catch {
      return '更新失敗，請稍後再試';
    }
  }

  private async addAudit(
    partial: Omit<AuditLog, 'id' | 'createdAt'>
  ): Promise<void> {
    await addDoc(
      collection(firestoreDb, 'auditLogs'),
      stripUndefined({
        ...partial,
        createdAt: new Date().toISOString(),
      })
    );
  }

  private attachListeners(): void {
    const expensesQuery = query(
      collection(firestoreDb, 'expenses'),
      orderBy('createdAt', 'desc')
    );
    this.unsubscribers.push(
      onSnapshot(expensesQuery, (snap) => {
        const rows = snap.docs
          .map((d) => normalizeExpense({ id: d.id, ...d.data() } as Expense))
          .sort(compareExpensesByDate);
        this.expensesSubject.next(rows);
      })
    );

    const auditQuery = query(
      collection(firestoreDb, 'auditLogs'),
      orderBy('createdAt', 'desc')
    );
    this.unsubscribers.push(
      onSnapshot(auditQuery, (snap) => {
        const rows = snap.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as AuditLog
        );
        this.auditSubject.next(rows);
      })
    );
  }

  private detachListeners(): void {
    this.unsubscribers.forEach((unsub) => unsub());
    this.unsubscribers = [];
  }
}
