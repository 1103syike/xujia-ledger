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
  previewToSplits,
  validateCreateInput,
} from '../utils/split-calculator';
import { AuthService } from './auth.service';

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
    if (!actor) return '請先登入';

    const error = validateCreateInput(input, this.auth.getAllMembers());
    if (error) return error;

    const seed = crypto.randomUUID?.() ?? `${Date.now()}`;
    const preview = buildSplitPreview({ ...input, remainderSeed: seed }, this.auth.getAllMembers());
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
      await setDoc(doc(firestoreDb, 'expenses', expense.id), expense);
      await this.addAudit({
        actorId: actor.id,
        action: 'expense.created',
        entityType: 'expense',
        entityId: expense.id,
        payload: { title: expense.title },
      });
      return null;
    } catch {
      return '建立失敗，請確認 Firestore 權限';
    }
  }

  async cancelExpense(expenseId: string): Promise<string | null> {
    const actor = this.auth.currentMember;
    if (!actor) return '請先登入';

    if (!this.expenses.find((e) => e.id === expenseId)) return '找不到帳款';

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
        payload: {},
      });
      return null;
    } catch {
      return '取消失敗';
    }
  }

  async markPaid(expenseId: string): Promise<string | null> {
    const actor = this.auth.currentMember;
    if (!actor) return '請先登入';

    const expense = this.expenses.find((e) => e.id === expenseId && e.status === 'open');
    if (!expense) return '找不到帳款';

    const split = expense.splits.find((s) => s.memberId === actor.id);
    if (!split) return '你不在分攤名單中';
    if (actor.id === expense.payerId) return '代墊者不需標記繳款';
    if (split.amount <= 0) return '此筆不需付款';
    if (split.paymentStatus === 'confirmed') return '已結清';
    if (split.paymentStatus === 'marked') return '已標記';

    return this.applySplitUpdate(expenseId, actor.id, 'marked', 'payment.marked');
  }

  async confirmPayment(expenseId: string, debtorId: string): Promise<string | null> {
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

  async unconfirmPayment(expenseId: string, debtorId: string): Promise<string | null> {
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

  private async applySplitUpdate(
    expenseId: string,
    targetMemberId: string,
    nextStatus: ExpenseSplit['paymentStatus'],
    action: string
  ): Promise<string | null> {
    const actor = this.auth.currentMember;
    if (!actor) return '請先登入';

    const expense = this.expenses.find((e) => e.id === expenseId);
    if (!expense) return '找不到帳款';

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
        splits,
        updatedAt: now,
      });
      await this.addAudit({
        actorId: actor.id,
        action,
        entityType: 'expense',
        entityId: expenseId,
        payload: { debtorId: targetMemberId, nextStatus },
      });
      return null;
    } catch {
      return '更新失敗';
    }
  }

  private async addAudit(
    partial: Omit<AuditLog, 'id' | 'createdAt'>
  ): Promise<void> {
    await addDoc(collection(firestoreDb, 'auditLogs'), {
      ...partial,
      createdAt: new Date().toISOString(),
    });
  }

  private attachListeners(): void {
    const expensesQuery = query(
      collection(firestoreDb, 'expenses'),
      orderBy('createdAt', 'desc')
    );
    this.unsubscribers.push(
      onSnapshot(expensesQuery, (snap) => {
        const rows = snap.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as Expense
        );
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
