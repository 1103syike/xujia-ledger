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
  writeBatch,
} from 'firebase/firestore';
import { BehaviorSubject, map } from 'rxjs';
import { firestoreDb } from '../firebase';
import {
  AuditLog,
  CreateAdvanceInput,
  CreateRepaymentInput,
  CreateTransferInput,
  CreateTransferResult,
  DEFAULT_ACCOUNT_ID,
  Transaction,
} from '../models';
import {
  buildConsolidationPreview,
  consolidationToParticipants,
  validateConsolidationInput,
} from '../utils/debt-consolidation';
import {
  buildSplitPreview,
  previewToParticipants,
  validateCreateInput,
  validateRepaymentInput,
} from '../utils/split-calculator';
import {
  advanceMemberBalances,
  advanceChangeAmount,
  primaryPayerId,
} from '../utils/advance-allocation';
import { formatFirestoreError, stripUndefined } from '../utils/firestore-data';
import {
  compareTransactionsByDate,
  normalizeTransaction,
} from '../utils/transaction-date';
import { AuthService } from './auth.service';

function memberName(auth: AuthService, id: string): string {
  return auth.getMember(id)?.name ?? id;
}

@Injectable({ providedIn: 'root' })
export class TransactionService implements OnDestroy {
  private readonly transactionsSubject = new BehaviorSubject<Transaction[]>([]);
  private readonly auditSubject = new BehaviorSubject<AuditLog[]>([]);
  private unsubscribers: Array<() => void> = [];
  private legacyTransactionIds = new Set<string>();

  readonly transactions$ = this.transactionsSubject.asObservable();
  readonly auditLogs$ = this.auditSubject.asObservable();

  /** @deprecated 使用 transactions$ */
  readonly expenses$ = this.transactions$;

  constructor(private auth: AuthService) {
    this.auth.currentMember$.subscribe((member) => {
      this.detachListeners();
      if (member) this.attachListeners();
      else {
        this.transactionsSubject.next([]);
        this.auditSubject.next([]);
      }
    });
  }

  ngOnDestroy(): void {
    this.detachListeners();
  }

  get transactions(): Transaction[] {
    return this.transactionsSubject.value;
  }

  /** @deprecated 使用 transactions */
  get expenses(): Transaction[] {
    return this.transactions;
  }

  get auditLogs(): AuditLog[] {
    return this.auditSubject.value;
  }

  getTransaction(id: string): Transaction | undefined {
    return this.transactions.find((t) => t.id === id);
  }

  /** @deprecated 使用 getTransaction */
  getExpense = this.getTransaction;

  activeTransactions$ = this.transactions$.pipe(
    map((list) => list.filter((t) => t.status === 'active'))
  );

  async createAdvance(input: CreateAdvanceInput): Promise<string | null> {
    const actor = this.auth.currentMember;
    if (!actor) return '請先登入帳號';

    const error = validateCreateInput(input, this.auth.getAllMembers());
    if (error) return error;

    const seed = crypto.randomUUID?.() ?? `${Date.now()}`;
    const preview = buildSplitPreview(
      { ...input, remainderSeed: seed },
      this.auth.getAllMembers()
    );
    const payers =
      input.payers?.length ?
        input.payers.map((p) => ({ ...p }))
      : [{ memberId: input.payerId, amount: input.totalAmount }];
    const payerIds = payers.map((p) => p.memberId);
    const participants = previewToParticipants(
      preview,
      primaryPayerId(payers),
      payerIds,
      input.splitNotes,
      input.splitItems
    );
    const now = new Date().toISOString();

    const transaction: Transaction = {
      id: seed,
      accountId: DEFAULT_ACCOUNT_ID,
      type: 'advance',
      title: input.title.trim(),
      date: input.date,
      totalAmount: input.totalAmount,
      billTotal: input.billTotal ?? null,
      payerId: primaryPayerId(payers),
      payers,
      changeAmount: advanceChangeAmount(payers, input.totalAmount) || null,
      participantScope: input.participantScope,
      participantIds:
        input.participantScope === 'all'
          ? this.auth.getAllMembers().map((m) => m.id)
          : [...input.participantIds],
      splitMode: input.splitMode,
      note: input.note?.trim() || null,
      remainderBearerId: preview.remainderBearerId,
      remainderAmount: preview.remainderAmount,
      status: 'active',
      createdBy: actor.id,
      createdAt: now,
      updatedAt: now,
      participants,
    };

    const balances = advanceMemberBalances(transaction);
    for (const p of transaction.participants) {
      const net = balances.get(p.memberId);
      if (net !== undefined) p.signedAmount = net;
    }

    try {
      await setDoc(
        doc(firestoreDb, 'transactions', transaction.id),
        stripUndefined(transaction)
      );
      await this.addAudit({
        actorId: actor.id,
        action: 'transaction.advance.created',
        entityType: 'transaction',
        entityId: transaction.id,
        payload: stripUndefined({
          title: transaction.title,
          date: transaction.date,
          totalAmount: transaction.totalAmount,
          payerId: transaction.payerId,
          payerName: memberName(this.auth, transaction.payerId),
          payers: transaction.payers?.map((p) => ({
            memberId: p.memberId,
            name: memberName(this.auth, p.memberId),
            amount: p.amount,
          })),
          splitMode: transaction.splitMode,
          note: transaction.note,
          participants: transaction.participants.map((p) => ({
            memberId: p.memberId,
            name: memberName(this.auth, p.memberId),
            amount: p.amount,
            lineItems: p.lineItems,
          })),
        }),
      });
      return null;
    } catch (error) {
      console.error('createAdvance failed', error);
      return formatFirestoreError(error);
    }
  }

  /** @deprecated 使用 createAdvance */
  createExpense = this.createAdvance.bind(this);

  async createRepayment(input: CreateRepaymentInput): Promise<string | null> {
    const actor = this.auth.currentMember;
    if (!actor) return '請先登入帳號';

    const error = validateRepaymentInput(
      input.fromMemberId,
      input.toMemberId,
      input.amount
    );
    if (error) return error;

    const seed = crypto.randomUUID?.() ?? `${Date.now()}`;
    const now = new Date().toISOString();
    const fromName = memberName(this.auth, input.fromMemberId);
    const toName = memberName(this.auth, input.toMemberId);

    const transaction: Transaction = {
      id: seed,
      accountId: DEFAULT_ACCOUNT_ID,
      type: 'repayment',
      title: '還款',
      date: input.date,
      totalAmount: input.amount,
      payerId: input.toMemberId,
      fromMemberId: input.fromMemberId,
      note: input.note?.trim() || null,
      status: 'active',
      createdBy: actor.id,
      createdAt: now,
      updatedAt: now,
      participants: [
        {
          memberId: input.fromMemberId,
          amount: input.amount,
          signedAmount: -input.amount,
          role: 'beneficiary',
        },
        {
          memberId: input.toMemberId,
          amount: input.amount,
          signedAmount: input.amount,
          role: 'payer',
        },
      ],
    };

    try {
      await setDoc(
        doc(firestoreDb, 'transactions', transaction.id),
        stripUndefined(transaction)
      );
      await this.addAudit({
        actorId: actor.id,
        action: 'transaction.repayment.created',
        entityType: 'transaction',
        entityId: transaction.id,
        payload: stripUndefined({
          fromMemberId: input.fromMemberId,
          fromName,
          toMemberId: input.toMemberId,
          toName,
          amount: input.amount,
          date: input.date,
          note: input.note,
        }),
      });
      return null;
    } catch (error) {
      console.error('createRepayment failed', error);
      return formatFirestoreError(error);
    }
  }

  async createTransfer(input: CreateTransferInput): Promise<CreateTransferResult> {
    const actor = this.auth.currentMember;
    if (!actor) return { error: '請先登入帳號' };

    const members = this.auth.getAllMembers();
    const memberIds = members.map((m) => m.id);
    const error = validateConsolidationInput(
      input.sourceTransactionIds,
      this.transactions,
      memberIds
    );
    if (error) return { error };

    const selected = input.sourceTransactionIds
      .map((id) => this.transactions.find((t) => t.id === id))
      .filter((t): t is Transaction => !!t);
    const preview = buildConsolidationPreview(selected, memberIds);
    const participants = consolidationToParticipants(preview);

    const seed = crypto.randomUUID?.() ?? `${Date.now()}`;
    const now = new Date().toISOString();

    const transaction: Transaction = {
      id: seed,
      accountId: DEFAULT_ACCOUNT_ID,
      type: 'transfer',
      title: input.title?.trim() || '債務轉移',
      date: input.date,
      totalAmount: preview.totalTransferVolume,
      payerId: actor.id,
      splitMode: 'itemized',
      note: input.note?.trim() || null,
      status: 'active',
      createdBy: actor.id,
      createdAt: now,
      updatedAt: now,
      participants,
      sourceTransactionIds: [...input.sourceTransactionIds],
      transferEdges: preview.edges,
    };

    try {
      const batch = writeBatch(firestoreDb);
      batch.set(
        doc(firestoreDb, 'transactions', transaction.id),
        stripUndefined(transaction)
      );

      for (const sourceId of input.sourceTransactionIds) {
        const coll = this.legacyTransactionIds.has(sourceId)
          ? 'expenses'
          : 'transactions';
        batch.update(doc(firestoreDb, coll, sourceId), {
          settledByTransferId: transaction.id,
          updatedAt: now,
        });
      }

      await batch.commit();

      await this.addAudit({
        actorId: actor.id,
        action: 'transaction.transfer.created',
        entityType: 'transaction',
        entityId: transaction.id,
        payload: stripUndefined({
          title: transaction.title,
          date: transaction.date,
          totalAmount: transaction.totalAmount,
          sourceTransactionIds: transaction.sourceTransactionIds,
          transferEdges: preview.edges.map((e) => ({
            fromId: e.fromId,
            fromName: memberName(this.auth, e.fromId),
            toId: e.toId,
            toName: memberName(this.auth, e.toId),
            amount: e.amount,
          })),
          note: transaction.note,
        }),
      });
      return { error: null, transactionId: transaction.id };
    } catch (error) {
      console.error('createTransfer failed', error);
      return { error: formatFirestoreError(error) };
    }
  }

  private sourceDocRef(sourceId: string) {
    const coll = this.legacyTransactionIds.has(sourceId)
      ? 'expenses'
      : 'transactions';
    return doc(firestoreDb, coll, sourceId);
  }

  async voidTransaction(transactionId: string): Promise<string | null> {
    const actor = this.auth.currentMember;
    if (!actor) return '請先登入帳號';

    const transaction = this.transactions.find((t) => t.id === transactionId);
    if (!transaction) return '找不到此筆交易';
    if (transaction.status !== 'active') return '此筆交易已作廢';

    if (transaction.settledByTransferId) {
      return '此筆已納入債務轉移，請先作廢該筆整合交易';
    }

    try {
      const now = new Date().toISOString();
      if (this.legacyTransactionIds.has(transactionId)) {
        await updateDoc(doc(firestoreDb, 'expenses', transactionId), {
          status: 'cancelled',
          updatedAt: now,
        });
      } else {
        await updateDoc(doc(firestoreDb, 'transactions', transactionId), {
          status: 'void',
          updatedAt: now,
        });
      }

      if (transaction.type === 'transfer' && transaction.sourceTransactionIds) {
        for (const sourceId of transaction.sourceTransactionIds) {
          await updateDoc(this.sourceDocRef(sourceId), {
            settledByTransferId: null,
            updatedAt: now,
          });
        }
      }

      await this.addAudit({
        actorId: actor.id,
        action: 'transaction.voided',
        entityType: 'transaction',
        entityId: transactionId,
        payload: {
          title: transaction.title,
          type: transaction.type,
          totalAmount: transaction.totalAmount,
        },
      });
      return null;
    } catch {
      return '作廢失敗，請稍後再試';
    }
  }

  /** @deprecated 使用 voidTransaction */
  cancelExpense = this.voidTransaction.bind(this);

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
    const mergeCollections = (
      legacy: Transaction[],
      modern: Transaction[]
    ): Transaction[] => {
      const byId = new Map<string, Transaction>();
      for (const tx of legacy) byId.set(tx.id, tx);
      for (const tx of modern) byId.set(tx.id, tx);
      return [...byId.values()].sort(compareTransactionsByDate);
    };

    let legacyRows: Transaction[] = [];
    let modernRows: Transaction[] = [];

    const emit = () => {
      this.legacyTransactionIds = new Set(legacyRows.map((t) => t.id));
      this.transactionsSubject.next(mergeCollections(legacyRows, modernRows));
    };

    const legacyQuery = query(
      collection(firestoreDb, 'expenses'),
      orderBy('createdAt', 'desc')
    );
    this.unsubscribers.push(
      onSnapshot(legacyQuery, (snap) => {
        legacyRows = snap.docs.map((d) =>
          normalizeTransaction({ id: d.id, ...d.data() } as Parameters<
            typeof normalizeTransaction
          >[0])
        );
        emit();
      })
    );

    const modernQuery = query(
      collection(firestoreDb, 'transactions'),
      orderBy('createdAt', 'desc')
    );
    this.unsubscribers.push(
      onSnapshot(modernQuery, (snap) => {
        modernRows = snap.docs.map((d) =>
          normalizeTransaction({ id: d.id, ...d.data() } as Parameters<
            typeof normalizeTransaction
          >[0])
        );
        emit();
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

/** @deprecated 使用 TransactionService */
export { TransactionService as ExpenseService };
