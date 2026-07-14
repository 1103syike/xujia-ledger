import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription, combineLatest, filter, map, Observable, of, startWith, take } from 'rxjs';
import {
  CreateAdvanceInput,
  DEFAULT_ACCOUNT_ID,
  DisplayMember,
  LineItem,
  SplitMode,
  Transaction,
  TransferEdge,
} from '../../../core/models';
import { AuthService } from '../../../core/services/auth.service';
import { TransactionService } from '../../../core/services/transaction.service';
import {
  buildSplitPreview,
  previewToParticipants,
  SplitPreview,
  validateCreateInput,
  validateRepaymentInput,
} from '../../../core/transactions/split-calculator';
import {
  buildConsolidationPreview,
  ConsolidationPreview,
  validateConsolidationInput,
} from '../../../core/consolidation/debt-consolidation';
import {
  buildAdvanceInputFromDraft,
  computeStickySummary,
  CustomInputMethod,
  inferSplitDraftMode,
  inferSplitRuleFromTransaction,
  SplitRule,
} from '../../../core/transactions/advance-draft';
import {
  advanceChangeAmount,
  getAdvancePayers,
  primaryPayerId,
} from '../../../core/transactions/advance-allocation';
import { filterManualLineItems } from '../../../core/transactions/advance-display';
import { distributePayerAmounts } from '../../../core/transactions/payer-distribution';
import {
  distributeHybridSplitAmounts,
  distributeSplitAmounts,
} from '../../../core/transactions/split-distribution';
import {
  serviceFeeSharesByMember,
  subtractServiceFeeFromAmounts,
} from '../../../core/transactions/service-fee-split';
import {
  dayBeforeYesterdayLocalDate,
  lastParticipantGroup,
  participantGroupKey,
  recentUsedDates,
  titleSuggestionOptions,
} from '../../../core/transactions/recent-create-prefs';
import { yesterdayLocalDate } from '../../../core/transactions/transaction-date-groups';
import { formatOweAmount } from '../../../core/ledger/settlement-display';
import { amountViewerOwesOther } from '../../../core/ledger/ledger-calculator';
import { activeTransactions, formatTransactionDateLabel, todayLocalDate } from '../../../core/transactions/transaction-date';
import { MemberAvatarComponent } from '../../../shared/components/member/member-avatar.component';
import { MemberSelectGridComponent } from '../../../shared/components/member/member-select-grid.component';
import { MemberPickerComponent } from '../../../shared/components/member/member-picker.component';
import { DateFieldComponent } from '../../../shared/components/form/date-field.component';
import { SplitPieChartComponent } from '../../../shared/components/ledger/split-pie-chart.component';
import { ConfirmDialogComponent } from '../../../shared/components/form/confirm-dialog.component';
import { KaomojiDecoComponent } from '../../../shared/components/branding/kaomoji-deco.component';
import { TransferBreakdownComponent } from '../../../shared/components/ledger/transfer-breakdown.component';
import {
  COPY_ACTIONS,
  COPY_DIALOGS,
  COPY_EMPTY,
  COPY_ERRORS,
  COPY_PAGES,
  COPY_CREATE,
  COPY_RECORD_TYPE,
  COPY_SPLIT,
  COPY_TERMS,
} from '../../../copy';
import { HasUnsavedChanges } from '../../../core/forms/unsaved-changes';
import {
  createFormSnapshotsEqual,
  serializeCreateFormSnapshot,
} from '../../../core/forms/create-form-snapshot';

type CreateMode = 'advance' | 'repayment' | 'transfer';

interface MemberDraft {
  note: string;
  amount: string;
}

interface PayerDraft {
  memberId: string;
  amount: string;
  locked: boolean;
}

@Component({
  selector: 'app-transaction-create',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    MemberAvatarComponent,
    MemberSelectGridComponent,
    MemberPickerComponent,
    DateFieldComponent,
    SplitPieChartComponent,
    ConfirmDialogComponent,
    KaomojiDecoComponent,
    TransferBreakdownComponent,
  ],
  templateUrl: './transaction-create.component.html',

})
export class TransactionCreateComponent implements OnInit, OnDestroy, HasUnsavedChanges {
  actions = COPY_ACTIONS;
  pages = COPY_PAGES;
  terms = COPY_TERMS;
  split = COPY_SPLIT;
  recordType = COPY_RECORD_TYPE;
  create = COPY_CREATE;
  empty = COPY_EMPTY;
  dialogs = COPY_DIALOGS;
  errors = COPY_ERRORS;
  nav = { ledger: COPY_PAGES.ledger };
  mode: CreateMode = 'advance';
  advanceForm: FormGroup;
  repaymentForm: FormGroup;
  transferForm: FormGroup;
  members: DisplayMember[] = [];
  repaymentTargets: DisplayMember[] = [];
  repaymentOweAmounts: Record<string, number> = {};
  hasRepaymentCreditors = false;
  noRepaySalt = 0;
  splitRule: SplitRule = 'equal';
  customInputMethod: CustomInputMethod = 'lineItems';
  memberItems: Record<string, LineItem[]> = {};
  memberDrafts: Record<string, MemberDraft> = {};
  memberSubtotals: Record<string, number> = {};
  memberBaseSubtotals: Record<string, number> = {};
  manualAmounts: Record<string, number> = {};
  preview: SplitPreview | null = null;
  previewSlices: Array<{ memberId: string; amount: number }> = [];
  effectiveTotal = 0;
  chartBillTotal: number | null = null;
  payingCount = 0;
  /** 表單輸入框 focus 時隱藏底部提交列，避免鍵盤把畫面擠爆 */
  isFormFieldFocused = false;
  error = '';
  private formFocusBlurTimer: ReturnType<typeof setTimeout> | null = null;
  remainderSeed = '';
  repaymentBalance: number | null = null;
  submitDialogOpen = false;
  leaveGuardOpen = false;
  submitBusy = false;
  submitDialogTitle = '';
  submitDialogDetail = '';
  submitDialogMessage = '';
  selectedSourceIds: string[] = [];
  selectedSourceTx: Transaction[] = [];
  transferPreview: ConsolidationPreview | null = null;
  transferEdges: TransferEdge[] = [];
  transferMemberRows: Array<{
    memberId: string;
    signedAmount: number;
    lineItems: LineItem[];
  }> = [];
  payerRows: PayerDraft[] = [];
  addingItemFor: string | null = null;
  participantTuningOpen = false;
  activeParticipantKey = '';
  recentDateOptions: string[] = [];
  titleSuggestionOptions: string[] = [];
  private splitLocked = new Set<string>();
  private initialWithMemberId: string | null = null;
  private participantPrefsApplied = false;
  splitAmountInputs: Record<string, string> = {};
  successOpen = false;
  successTitle = '';
  successAmount = 0;
  successImpactLines: Array<{ fromName: string; toName: string; amount: number }> = [];
  formatOwe = formatOweAmount;
  isEditMode = false;
  editTransactionId: string | null = null;
  private skippedMembers = new Set<string>();
  private subs: Subscription[] = [];
  private activeTx: Transaction[] = [];
  private initialRepaymentToId: string | null = null;
  private editHydrated = false;
  private baselineSnapshot = '';
  private baselineReady = false;
  private navigationAllowed = false;
  private leaveGuardResolver: ((allow: boolean) => void) | null = null;
  private pendingAfterDiscard: (() => void) | null = null;
  private transactionsDataReady = false;

  constructor(
    public auth: AuthService,
    private fb: FormBuilder,
    private transactions: TransactionService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    const defaultPayer = auth.currentMember?.id ?? '';
    this.advanceForm = this.fb.group({
      title: ['', Validators.required],
      date: [todayLocalDate(), Validators.required],
      totalAmount: [null, [Validators.min(1)]],
      serviceFee: [null, [Validators.min(0)]],
      billTotal: [null, [Validators.min(1)]],
    });
    this.payerRows = [{ memberId: defaultPayer, amount: '', locked: false }];
    this.repaymentForm = this.fb.group({
      toMemberId: [''],
      amount: [null, [Validators.min(1)]],
      date: [todayLocalDate(), Validators.required],
    });
    this.transferForm = this.fb.group({});
    this.remainderSeed = crypto.randomUUID?.() ?? String(Date.now());
    this.reloadMembers();
  }

  ngOnInit(): void {
    this.isEditMode = !!this.route.snapshot.data['edit'];
    this.editTransactionId = this.route.snapshot.paramMap.get('id');

    if (this.isEditMode && this.editTransactionId) {
      this.mode = 'advance';
      this.tryLoadTransaction(this.editTransactionId);
    }

    const typeParam = this.route.snapshot.queryParamMap.get('type');
    if (typeParam === 'repayment') {
      this.mode = 'repayment';
    } else if (typeParam === 'transfer') {
      this.mode = 'transfer';
    }
    const idsParam = this.route.snapshot.queryParamMap.get('ids');
    if (idsParam) {
      this.selectedSourceIds = idsParam.split(',').filter(Boolean);
    }
    const toParam = this.route.snapshot.queryParamMap.get('to');
    if (toParam) {
      this.initialRepaymentToId = toParam;
      this.repaymentForm.patchValue({ toMemberId: toParam });
    }
    const withParam = this.route.snapshot.queryParamMap.get('with');
    if (withParam) {
      this.initialWithMemberId = withParam;
    }

    this.subs.push(
      this.route.queryParamMap.subscribe((params) => {
        const idsParam = params.get('ids');
        if (idsParam === null) return;
        const nextIds = idsParam.split(',').filter(Boolean);
        const prevKey = this.selectedSourceIds.join(',');
        const nextKey = nextIds.join(',');
        if (prevKey !== nextKey) {
          this.selectedSourceIds = nextIds;
          this.refreshTransferPreview();
          if (this.baselineReady && this.mode === 'transfer') {
            this.captureBaseline();
          }
        }
      }),
      this.auth.currentMember$
        .pipe(
          filter((m): m is DisplayMember => !!m),
          take(1)
        )
        .subscribe((member) => {
          if (this.payerRows.length === 1 && !this.payerRows[0].memberId) {
            this.payerRows = [
              {
                memberId: member.id,
                amount: this.payerRows[0].amount,
                locked: this.payerRows[0].locked,
              },
            ];
          }
          this.refreshPreview({ syncPayers: true });
        }),
      this.advanceForm.valueChanges.subscribe(() => this.refreshPreview()),
      combineLatest([
        this.transactions.transactions$,
        this.auth.currentMember$,
        this.repaymentForm.valueChanges.pipe(startWith(this.repaymentForm.value)),
        this.transactions.dataReady$,
      ]).subscribe(([txs, member, , dataReady]) => {
        this.transactionsDataReady = dataReady;
        this.activeTx = activeTransactions(txs);
        this.refreshCreatePrefs(member?.id);
        this.refreshRepaymentTargets(member?.id);
        this.updateRepaymentBalance(member?.id);
        this.refreshTransferPreview();
        if (!this.isEditMode && !this.participantPrefsApplied && member) {
          this.applyInitialParticipantGroup(member.id);
        }
        if (dataReady) {
          this.tryCaptureBaseline();
        }
      })
    );
    this.refreshPreview({ syncPayers: true });
  }

  ngOnDestroy(): void {
    this.clearFormFocusBlurTimer();
    this.subs.forEach((s) => s.unsubscribe());
  }

  onFormFocusIn(event: FocusEvent): void {
    if (!this.isEditableFormField(event.target)) return;
    this.clearFormFocusBlurTimer();
    this.isFormFieldFocused = true;
  }

  onFormFocusOut(event: FocusEvent): void {
    if (!this.isEditableFormField(event.target)) return;
    this.clearFormFocusBlurTimer();
    // 等焦點切完再判斷，避免欄位間移動時 bar 閃一下
    this.formFocusBlurTimer = setTimeout(() => {
      this.formFocusBlurTimer = null;
      const active = document.activeElement;
      const form = document.getElementById('create-advance-form');
      this.isFormFieldFocused = !!(
        form &&
        active &&
        form.contains(active) &&
        this.isEditableFormField(active)
      );
    }, 0);
  }

  private isEditableFormField(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    return (
      tag === 'INPUT' ||
      tag === 'TEXTAREA' ||
      tag === 'SELECT' ||
      target.isContentEditable
    );
  }

  private clearFormFocusBlurTimer(): void {
    if (this.formFocusBlurTimer === null) return;
    clearTimeout(this.formFocusBlurTimer);
    this.formFocusBlurTimer = null;
  }

  canDeactivate(): Observable<boolean> {
    return this.promptDiscardIfNeeded();
  }

  hasUnsavedChanges(): boolean {
    if (!this.baselineReady || this.navigationAllowed || this.successOpen) {
      return false;
    }
    return !createFormSnapshotsEqual(
      this.baselineSnapshot,
      this.serializeCurrentSnapshot()
    );
  }

  private promptDiscardIfNeeded(onDiscard?: () => void): Observable<boolean> {
    if (!this.hasUnsavedChanges()) {
      onDiscard?.();
      return of(true);
    }
    return new Observable<boolean>((observer) => {
      this.pendingAfterDiscard = onDiscard ?? null;
      this.leaveGuardResolver = (allow) => {
        if (allow) {
          this.pendingAfterDiscard?.();
        }
        this.pendingAfterDiscard = null;
        this.leaveGuardResolver = null;
        observer.next(allow);
        observer.complete();
      };
      this.leaveGuardOpen = true;
    });
  }

  onLeaveGuardStay(): void {
    this.leaveGuardOpen = false;
    this.pendingAfterDiscard = null;
    this.leaveGuardResolver?.(false);
  }

  onLeaveGuardDiscard(): void {
    this.leaveGuardOpen = false;
    this.leaveGuardResolver?.(true);
  }

  private tryCaptureBaseline(): void {
    if (this.baselineReady) return;
    if (!this.transactionsDataReady) return;
    if (this.isEditMode && !this.editHydrated) return;
    if (
      !this.isEditMode &&
      this.mode === 'advance' &&
      !this.participantPrefsApplied
    ) {
      return;
    }
    this.captureBaseline();
    this.baselineReady = true;
  }

  private captureBaseline(): void {
    this.baselineSnapshot = this.serializeCurrentSnapshot();
  }

  private serializeCurrentSnapshot(): string {
    const v = this.advanceForm.value;
    const repayment = this.repaymentForm.value;
    return serializeCreateFormSnapshot({
      mode: this.mode,
      advance: {
        title: String(v.title ?? ''),
        date: String(v.date ?? ''),
        totalAmount:
          v.totalAmount === null || v.totalAmount === ''
            ? null
            : Number(v.totalAmount),
        serviceFee:
          v.serviceFee === null || v.serviceFee === ''
            ? null
            : Number(v.serviceFee),
        billTotal:
          v.billTotal === null || v.billTotal === ''
            ? null
            : Number(v.billTotal),
        skippedMembers: [...this.skippedMembers],
        memberItems: this.pruneSplitItems(),
        manualAmounts: { ...this.manualAmounts },
        splitAmountInputs: { ...this.splitAmountInputs },
        splitLocked: [...this.splitLocked],
        payerRows: this.payerRows.map((row) => ({
          memberId: row.memberId,
          amount: row.amount,
          locked: row.locked,
        })),
        remainderSeed: this.remainderSeed,
        activeParticipantKey: this.activeParticipantKey,
      },
      repayment: {
        toMemberId: String(repayment.toMemberId ?? ''),
        amount:
          repayment.amount === null || repayment.amount === ''
            ? null
            : Number(repayment.amount),
        date: String(repayment.date ?? ''),
      },
      transfer: {
        selectedSourceIds: [...this.selectedSourceIds],
      },
    });
  }

  setMode(mode: CreateMode): void {
    if (mode === this.mode) return;
    this.promptDiscardIfNeeded(() => {
      this.applyMode(mode);
      this.captureBaseline();
    }).subscribe();
  }

  private applyMode(mode: CreateMode): void {
    this.mode = mode;
    this.error = '';
    if (mode === 'repayment') {
      this.refreshRepaymentTargets(this.auth.currentMember?.id);
    }
    if (mode === 'transfer') {
      this.refreshTransferPreview();
    }
  }

  removeSource(id: string): void {
    this.selectedSourceIds = this.selectedSourceIds.filter((x) => x !== id);
    this.refreshTransferPreview();
  }

  get consolidateSelectQueryParams(): { consolidate: string; ids: string } {
    return {
      consolidate: '1',
      ids: this.selectedSourceIds.join(','),
    };
  }

  private refreshTransferPreview(): void {
    const byId = new Map(this.activeTx.map((t) => [t.id, t]));
    this.selectedSourceTx = this.selectedSourceIds
      .map((id) => byId.get(id))
      .filter((t): t is Transaction => !!t);
    const memberIds = this.members.map((m) => m.id);
    if (this.selectedSourceTx.length === 0) {
      this.transferPreview = null;
      this.transferEdges = [];
      this.transferMemberRows = [];
      return;
    }
    this.transferPreview = buildConsolidationPreview(this.selectedSourceTx, memberIds);
    const breakdown = TransferBreakdownComponent.fromPreview(this.transferPreview);
    this.transferEdges = breakdown.edges;
    this.transferMemberRows = breakdown.memberRows;
  }

  setRepaymentTarget(id: string): void {
    this.repaymentForm.patchValue({ toMemberId: id });
    this.updateRepaymentBalance(this.auth.currentMember?.id);
    this.syncRepaymentAmountToBalance();
  }

  /** 留空 → 結清；否則還輸入金額（允許超額） */
  resolveRepaymentAmount(): number {
    const balance = this.repaymentBalance ?? 0;
    if (balance <= 0) return 0;

    const raw = this.repaymentForm.value.amount;
    if (raw === null || raw === '' || raw === undefined) {
      return balance;
    }

    const typed = Number(raw);
    if (!Number.isFinite(typed) || typed <= 0) {
      return balance;
    }

    return typed;
  }

  private syncRepaymentAmountToBalance(): void {
    if (this.repaymentBalance && this.repaymentBalance > 0) {
      this.repaymentForm.patchValue(
        { amount: this.repaymentBalance },
        { emitEvent: false }
      );
    } else {
      this.repaymentForm.patchValue({ amount: null }, { emitEvent: false });
    }
  }

  private updateRepaymentBalance(viewerId?: string): void {
    const toId = this.repaymentForm.value.toMemberId;
    if (!viewerId || !toId) {
      this.repaymentBalance = null;
      return;
    }
    this.repaymentBalance = amountViewerOwesOther(this.activeTx, viewerId, toId);
  }

  private refreshRepaymentTargets(viewerId?: string): void {
    if (!viewerId) {
      this.repaymentTargets = [];
      this.repaymentOweAmounts = {};
      this.hasRepaymentCreditors = false;
      return;
    }

    const others = this.auth.getAllMembers().filter((m) => m.id !== viewerId);
    const oweAmounts: Record<string, number> = {};
    for (const m of others) {
      oweAmounts[m.id] = amountViewerOwesOther(this.activeTx, viewerId, m.id);
    }

    const creditors = others.filter((m) => oweAmounts[m.id] > 0);
    this.hasRepaymentCreditors = creditors.length > 0;
    this.repaymentOweAmounts = oweAmounts;
    this.repaymentTargets = [...others].sort((a, b) => {
      const oa = oweAmounts[a.id] ?? 0;
      const ob = oweAmounts[b.id] ?? 0;
      const aCred = oa > 0 ? 1 : 0;
      const bCred = ob > 0 ? 1 : 0;
      if (aCred !== bCred) return bCred - aCred;
      return ob - oa;
    });

    const current = this.repaymentForm.value.toMemberId;
    if (!this.hasRepaymentCreditors) {
      this.repaymentForm.patchValue({ toMemberId: '' }, { emitEvent: true });
      return;
    }

    const pickDefault = (): string => {
      if (
        this.initialRepaymentToId &&
        (oweAmounts[this.initialRepaymentToId] ?? 0) > 0
      ) {
        return this.initialRepaymentToId;
      }
      return creditors[0].id;
    };

    if (!current || (oweAmounts[current] ?? 0) <= 0) {
      const nextId = pickDefault();
      this.repaymentForm.patchValue(
        { toMemberId: nextId, amount: oweAmounts[nextId] ?? null },
        { emitEvent: true }
      );
    }

    this.updateRepaymentBalance(viewerId);
    this.initialRepaymentToId = null;
  }

  private reloadMembers(): void {
    this.members = this.auth.getAllMembers();
    this.initDrafts();
    this.refreshPreview();
  }

  get splitMode(): SplitMode {
    const inferred = inferSplitDraftMode({
      allMemberIds: this.members.map((m) => m.id),
      excludedMemberIds: [...this.skippedMembers],
      totalAmount: this.consumptionSubtotal(),
      manualAmounts: this.manualAmounts,
      memberItems: this.memberItems,
      splitLockedIds: [...this.splitLocked],
    });
    return inferred.splitRule === 'equal' ? 'equal' : 'itemized';
  }

  get stickySummary() {
    const payers = this.payerRows
      .filter((row) => row.memberId)
      .map((row) => ({
        memberId: row.memberId,
        amount: Number(row.amount) || 0,
      }));
    return computeStickySummary(this.effectiveTotal, payers);
  }

  get advanceSubmitHint(): string {
    return validateCreateInput(this.buildAdvanceInput(), this.members) ?? '';
  }

  get canSubmitAdvance(): boolean {
    return !this.advanceSubmitHint;
  }

  get equalPerPersonLabel(): string | null {
    if (this.hasAnyLineItems) return null;
    if (!this.preview || this.payingCount === 0) {
      return null;
    }
    const amounts = this.preview.lines
      .filter((line) => line.amount > 0)
      .map((line) => line.amount);
    if (amounts.length === 0) return null;

    const unique = [...new Set(amounts)];
    if (unique.length === 1) {
      return `每人 NT$ ${unique[0]}`;
    }

    const base = Math.min(...amounts);
    return `每人約 NT$ ${base}（含零頭分配）`;
  }

  /** 有專屬細項時，顯示共同消費剩餘均分 */
  get sharedRemainderLabel(): string | null {
    if (!this.hasAnyLineItems || this.payingCount === 0) return null;

    const total = Number(this.advanceForm.value.totalAmount) || 0;
    if (total <= 0) return null;

    const exclusiveSum = this.sumExclusiveLineItems();
    const remainder = total - exclusiveSum;
    if (remainder <= 0) return null;

    const perPerson = Math.floor(remainder / this.payingCount);
    if (remainder % this.payingCount === 0) {
      return COPY_SPLIT.sharedRemainderExact(remainder, perPerson);
    }
    return COPY_SPLIT.sharedRemainderApprox(remainder, perPerson);
  }

  get hasAnyLineItems(): boolean {
    return Object.values(this.memberItems).some((items) => items.length > 0);
  }

  get visibleSplitMembers(): DisplayMember[] {
    if (this.participantTuningOpen) return this.members;
    return this.members.filter((m) => !this.isSkipped(m.id));
  }

  get todayDate(): string {
    return todayLocalDate();
  }

  get yesterdayDate(): string {
    return yesterdayLocalDate();
  }

  get dayBeforeYesterdayDate(): string {
    return dayBeforeYesterdayLocalDate();
  }

  isFormDateActive(form: FormGroup, date: string): boolean {
    return form.value.date === date;
  }

  formatDateChip(date: string): string {
    const parts = date.split('-').map(Number);
    if (parts.length < 3 || !parts[1] || !parts[2]) return date;
    return `${parts[1]}/${parts[2]}`;
  }

  pickFormDate(form: FormGroup, date: string): void {
    form.patchValue({ date });
  }

  isTitleSuggestionActive(title: string): boolean {
    return (this.advanceForm.value.title ?? '').trim() === title;
  }

  pickTitleSuggestion(title: string): void {
    this.advanceForm.patchValue({ title });
  }

  isAllGroupActive(): boolean {
    const participating = this.members
      .filter((m) => !this.isSkipped(m.id))
      .map((m) => m.id);
    return (
      participantGroupKey(participating) ===
      participantGroupKey(this.members.map((m) => m.id))
    );
  }

  isMemberParticipating(memberId: string): boolean {
    return !this.isSkipped(memberId);
  }

  selectAllParticipants(): void {
    if (this.isAllGroupActive()) {
      // 已全家再點一次 → 清空（跟單人 chip 可取消一致）
      this.applyParticipantMemberIds([]);
    } else {
      this.applyParticipantMemberIds(this.members.map((m) => m.id));
    }
    this.refreshPreview({ syncSplits: true, syncPayers: true });
  }

  toggleParticipantMember(memberId: string): void {
    if (this.isSkipped(memberId)) {
      this.toggleSkip(memberId);
      return;
    }

    const activeCount = this.members.filter((m) => !this.isSkipped(m.id)).length;
    if (activeCount <= 1) return;

    this.toggleSkip(memberId);
  }

  toggleParticipantTuning(): void {
    this.participantTuningOpen = !this.participantTuningOpen;
  }

  memberHasLineItems(memberId: string): boolean {
    return (this.memberItems[memberId] ?? []).length > 0;
  }

  /** 該員細項合計（不含共同剩餘） */
  memberExclusiveTotal(memberId: string): number {
    return (this.memberItems[memberId] ?? []).reduce(
      (sum, item) => sum + item.amount,
      0
    );
  }

  /** 該員分到的共同消費（應付 − 專屬細項） */
  memberCommonShare(memberId: string): number {
    if (this.isSkipped(memberId) || !this.hasAnyLineItems) return 0;
    const exclusive = this.memberExclusiveTotal(memberId);
    const allocated = this.memberBaseSubtotals[memberId] ?? 0;
    return Math.max(0, allocated - exclusive);
  }

  isSplitAmountLocked(memberId: string): boolean {
    return this.splitLocked.has(memberId) || this.memberHasLineItems(memberId);
  }

  splitAmountDisplay(memberId: string): string {
    if (this.splitAmountInputs[memberId] !== undefined) {
      return this.splitAmountInputs[memberId];
    }
    const amount = this.manualAmounts[memberId];
    return amount ? String(amount) : '';
  }

  setSplitAmount(memberId: string, value: string): void {
    if (this.memberHasLineItems(memberId)) return;
    this.splitAmountInputs = { ...this.splitAmountInputs, [memberId]: value };
  }

  commitSplitAmount(memberId: string): void {
    if (this.memberHasLineItems(memberId)) return;

    const raw = String(this.splitAmountInputs[memberId] ?? '').trim();
    if (!raw) {
      this.splitLocked.delete(memberId);
      const nextInputs = { ...this.splitAmountInputs };
      delete nextInputs[memberId];
      this.splitAmountInputs = nextInputs;
    } else {
      const amount = Number(raw) || 0;
      this.manualAmounts = { ...this.manualAmounts, [memberId]: amount };
      this.splitAmountInputs = { ...this.splitAmountInputs, [memberId]: String(amount) };
      this.splitLocked.add(memberId);
    }
    this.refreshPreview({ syncSplits: true, syncPayers: true });
  }

  private refreshCreatePrefs(viewerId?: string): void {
    if (!viewerId) {
      this.recentDateOptions = [];
      this.titleSuggestionOptions = [];
      return;
    }
    this.recentDateOptions = recentUsedDates(this.activeTx, viewerId, 3);
    this.titleSuggestionOptions = titleSuggestionOptions(
      this.activeTx,
      viewerId
    );
  }

  private applyParticipantMemberIds(memberIds: string[]): void {
    const allowed = new Set(memberIds);
    this.skippedMembers = new Set(
      this.members.filter((m) => !allowed.has(m.id)).map((m) => m.id)
    );
    this.activeParticipantKey = participantGroupKey(memberIds);
    this.splitLocked.clear();
    this.splitAmountInputs = {};
    const nextItems: Record<string, LineItem[]> = {};
    for (const [id, items] of Object.entries(this.memberItems)) {
      if (allowed.has(id)) nextItems[id] = items;
    }
    this.memberItems = nextItems;
  }

  private applyInitialParticipantGroup(viewerId: string): void {
    if (this.participantPrefsApplied || this.isEditMode) return;

    const allIds = this.members.map((m) => m.id);
    let ids: string[];

    if (this.initialWithMemberId && this.initialWithMemberId !== viewerId) {
      ids = [viewerId, this.initialWithMemberId];
      this.initialWithMemberId = null;
    } else {
      ids = lastParticipantGroup(this.activeTx, viewerId) ?? allIds;
    }

    this.applyParticipantMemberIds(ids);
    this.participantPrefsApplied = true;
    this.refreshPreview({ syncSplits: true, syncPayers: true });
    this.tryCaptureBaseline();
  }

  selectPrimaryPayer(memberId: string): void {
    if (this.payerRows.length === 1) {
      const row = this.payerRows[0];
      this.payerRows = [
        { memberId, amount: row.amount, locked: row.locked },
      ];
      this.refreshPreview();
    }
  }

  disabledPayerIdsForRow(index: number): string[] {
    return this.payerRows
      .map((row, i) => (i === index ? '' : row.memberId))
      .filter(Boolean);
  }

  previewAmountFor(memberId: string): number {
    return this.preview?.lines.find((line) => line.memberId === memberId)?.amount ?? 0;
  }

  toggleAddItem(memberId: string): void {
    this.addingItemFor = this.addingItemFor === memberId ? null : memberId;
  }

  goToTransactions(): void {
    this.navigationAllowed = true;
    void this.router.navigateByUrl('/transactions');
  }

  createAnother(): void {
    this.successOpen = false;
    this.successImpactLines = [];
    this.navigationAllowed = false;
    this.baselineReady = false;
    this.resetAdvanceForm();
  }

  private resetAdvanceForm(): void {
    const defaultPayer = this.auth.currentMember?.id ?? this.members[0]?.id ?? '';
    this.advanceForm.reset({
      title: '',
      date: todayLocalDate(),
      totalAmount: null,
      serviceFee: null,
      billTotal: null,
    });
    this.payerRows = [{ memberId: defaultPayer, amount: '', locked: false }];
    this.splitRule = 'equal';
    this.customInputMethod = 'lineItems';
    this.memberItems = {};
    this.manualAmounts = {};
    this.splitAmountInputs = {};
    this.splitLocked.clear();
    this.participantTuningOpen = false;
    this.participantPrefsApplied = false;
    this.skippedMembers = new Set();
    this.addingItemFor = null;
    this.error = '';
    this.remainderSeed = crypto.randomUUID?.() ?? String(Date.now());
    this.initDrafts();
    const viewerId = this.auth.currentMember?.id;
    if (viewerId) {
      this.applyInitialParticipantGroup(viewerId);
    } else {
      this.refreshPreview({ syncSplits: true, syncPayers: true });
    }
  }

  private buildPreviewTransaction(): Transaction | null {
    if (!this.preview) return null;

    const input = this.buildAdvanceInput();
    const payers =
      input.payers?.length ?
        input.payers
      : [{ memberId: input.payerId, amount: input.totalAmount }];
    const payerIds = payers.map((p) => p.memberId);
    const participants = previewToParticipants(
      this.preview,
      primaryPayerId(payers),
      payerIds,
      undefined,
      input.splitItems
    );

    const transaction: Transaction = {
      id: 'preview',
      accountId: DEFAULT_ACCOUNT_ID,
      type: 'advance',
      title: input.title.trim(),
      date: input.date,
      totalAmount: input.totalAmount,
      billTotal: input.billTotal ?? null,
      payerId: primaryPayerId(payers),
      payers,
      changeAmount: advanceChangeAmount(payers, input.totalAmount) || null,
      participantScope: 'all',
      participantIds: this.members.map((m) => m.id),
      splitMode: input.splitMode,
      note: input.note,
      remainderBearerId: this.preview.remainderBearerId,
      remainderAmount: this.preview.remainderAmount,
      status: 'active',
      createdBy: this.auth.currentMember?.id ?? '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      participants,
    };

    return transaction;
  }

  private buildSuccessImpactLines(
    tx: Transaction
  ): Array<{ fromName: string; toName: string; amount: number }> {
    const payers = getAdvancePayers(tx);
    const payerIds = new Set(payers.map((p) => p.memberId));
    const creditorName = payers
      .map((p) => this.auth.getMember(p.memberId)?.name ?? p.memberId)
      .join('、');

    return tx.participants
      .filter((p) => p.amount > 0 && !payerIds.has(p.memberId))
      .map((p) => ({
        fromName: this.auth.getMember(p.memberId)?.name ?? p.memberId,
        toName: creditorName,
        amount: p.amount,
      }));
  }

  addMemberItem(memberId: string): void {
    const draft = this.memberDrafts[memberId];
    if (!draft) return;
    const amount = Number(draft.amount);
    const note = draft.note.trim();
    if (!note) {
      this.error = '請填寫項目名稱';
      return;
    }
    if (!amount || amount <= 0 || Number.isNaN(amount)) {
      this.error = '請輸入有效的金額';
      return;
    }
    this.error = '';
    this.memberItems = { ...this.memberItems, [memberId]: [...(this.memberItems[memberId] ?? []), { note, amount }] };
    this.splitLocked.add(memberId);
    draft.note = '';
    draft.amount = '';
    this.addingItemFor = null;
    this.syncAmountsFromItems();
    this.refreshPreview({ syncSplits: true, syncPayers: true });
  }

  removeMemberItem(memberId: string, index: number): void {
    const next = [...(this.memberItems[memberId] ?? [])];
    next.splice(index, 1);
    this.memberItems = { ...this.memberItems, [memberId]: next };
    if (next.length === 0) {
      this.splitLocked.delete(memberId);
    }
    this.syncAmountsFromItems();
    this.refreshPreview({ syncSplits: true, syncPayers: true });
  }

  get payerTotal(): number {
    return this.stickySummary.grossPaid;
  }

  get payerChange(): number {
    return this.stickySummary.change;
  }

  membersForPayerRow(index: number): DisplayMember[] {
    const taken = new Set(
      this.payerRows
        .map((row, i) => (i === index ? '' : row.memberId))
        .filter(Boolean)
    );
    return this.members.filter((m) => !taken.has(m.id));
  }

  addPayer(): void {
    const available = this.members.find(
      (m) => !this.payerRows.some((row) => row.memberId === m.id)
    );
    this.payerRows = [
      ...this.payerRows,
      { memberId: available?.id ?? '', amount: '', locked: false },
    ];
    this.refreshPreview({ syncPayers: true });
  }

  removePayer(index: number): void {
    if (this.payerRows.length <= 1) return;
    this.payerRows = this.payerRows.filter((_, i) => i !== index);
    this.refreshPreview({ syncPayers: true });
  }

  setPayerMember(index: number, memberId: string): void {
    const next = [...this.payerRows];
    next[index] = { ...next[index], memberId };
    this.payerRows = next;
    this.refreshPreview();
  }

  /** 輸入中只改金額，不要換掉 row 物件（否則 *ngFor 會重建 input 導致失焦） */
  setPayerAmount(index: number, value: string): void {
    const row = this.payerRows[index];
    if (!row) return;
    row.amount = value;
  }

  commitPayerAmount(index: number): void {
    const row = this.payerRows[index];
    if (!row) return;

    const raw = String(row.amount ?? '').trim();
    if (!raw) {
      row.amount = '';
      row.locked = false;
    } else {
      row.amount = String(Number(raw) || 0);
      row.locked = true;
    }

    this.refreshPreview({ syncPayers: true });
  }

  trackPayerRowByIndex(index: number): number {
    return index;
  }

  onSplitTotalCommit(): void {
    this.refreshPreview({ syncSplits: true, syncPayers: true });
  }

  private syncSplitAmounts(): void {
    const subtotal = Number(this.advanceForm.value.totalAmount) || 0;
    if (subtotal <= 0) return;

    const participating = this.members.filter((m) => !this.isSkipped(m.id));
    if (participating.length === 0) return;

    this.clearStaleSplitLocksForLineItemMode();

    const nextManual = { ...this.manualAmounts };
    const nextInputs = { ...this.splitAmountInputs };

    // 有細項：專屬細項歸人，剩餘給所有參與者均分（含已有細項的人）
    if (this.hasAnyLineItems) {
      const exclusives = participating.map((m) =>
        (this.memberItems[m.id] ?? []).reduce((sum, item) => sum + item.amount, 0)
      );
      const amounts = distributeHybridSplitAmounts(subtotal, exclusives);

      participating.forEach((m, index) => {
        nextManual[m.id] = amounts[index];
        if (!this.memberHasLineItems(m.id)) {
          nextInputs[m.id] = String(amounts[index]);
        }
      });

      this.manualAmounts = nextManual;
      this.splitAmountInputs = nextInputs;
      return;
    }

    const rows = participating.map((m) => ({
      amount: Number(this.manualAmounts[m.id]) || 0,
      locked: this.splitLocked.has(m.id),
    }));

    const amounts = distributeSplitAmounts(subtotal, rows);

    participating.forEach((m, index) => {
      nextManual[m.id] = amounts[index];
      if (!this.splitLocked.has(m.id)) {
        nextInputs[m.id] = String(amounts[index]);
      }
    });

    this.manualAmounts = nextManual;
    this.splitAmountInputs = nextInputs;
  }

  private syncPayerAmounts(): void {
    const splitTotal = this.effectiveTotal;
    if (splitTotal <= 0 || this.payerRows.length === 0) return;

    const states = this.payerRows.map((row) => ({
      amount: Number(row.amount) || 0,
      locked: row.locked,
    }));
    const amounts = distributePayerAmounts(splitTotal, states);

    this.payerRows = this.payerRows.map((row, index) => ({
      ...row,
      amount: String(amounts[index]),
    }));
  }

  setPayer(id: string): void {
    if (this.payerRows.length === 1) {
      const row = this.payerRows[0];
      this.payerRows = [{ memberId: id, amount: row.amount, locked: row.locked }];
      this.refreshPreview();
    }
  }

  setSplitRule(rule: SplitRule): void {
    if (this.splitRule === rule) return;
    this.splitRule = rule;
    if (rule === 'equal') {
      this.memberItems = {};
      this.initDrafts();
    }
    this.refreshPreview({ syncPayers: true });
  }

  setCustomInputMethod(method: CustomInputMethod): void {
    if (this.customInputMethod === method) return;
    if (method === 'direct') {
      for (const m of this.members) {
        const subtotal = this.memberSubtotals[m.id] ?? 0;
        if (subtotal > 0 && !this.isSkipped(m.id)) {
          this.manualAmounts = { ...this.manualAmounts, [m.id]: subtotal };
        }
      }
    }
    this.customInputMethod = method;
    this.refreshPreview({ syncPayers: true });
  }

  setDirectAmount(memberId: string, value: string | number): void {
    const amount = Number(value) || 0;
    this.manualAmounts = { ...this.manualAmounts, [memberId]: amount };
    if (amount > 0) {
      this.skippedMembers.delete(memberId);
    }
    this.refreshPreview();
  }

  /** @deprecated 使用 setSplitRule */
  setSplitMode(mode: SplitMode): void {
    this.setSplitRule(mode === 'equal' ? 'equal' : 'custom');
  }

  isSkipped(id: string): boolean {
    return this.skippedMembers.has(id);
  }

  toggleSkip(id: string): void {
    if (this.skippedMembers.has(id)) {
      this.skippedMembers.delete(id);
      delete this.manualAmounts[id];
    } else {
      this.skippedMembers.add(id);
      this.manualAmounts[id] = 0;
      this.memberItems = { ...this.memberItems, [id]: [] };
      this.splitLocked.delete(id);
      const nextInputs = { ...this.splitAmountInputs };
      delete nextInputs[id];
      this.splitAmountInputs = nextInputs;
      if (this.addingItemFor === id) {
        this.addingItemFor = null;
      }
    }
    const participating = this.members
      .filter((m) => !this.isSkipped(m.id))
      .map((m) => m.id);
    this.activeParticipantKey = participantGroupKey(participating);
    this.syncAmountsFromItems();
    this.refreshPreview({ syncSplits: true, syncPayers: true });
  }

  refreshPreview(options?: { syncPayers?: boolean; syncSplits?: boolean }): void {
    this.syncAmountsFromItems();
    this.syncTotalAmountFieldFromSplits();
    this.effectiveTotal = this.computeEffectiveTotal();
    if (options?.syncSplits) {
      this.syncSplitAmounts();
      this.syncAmountsFromItems();
      this.syncTotalAmountFieldFromSplits();
      this.effectiveTotal = this.computeEffectiveTotal();
    }
    if (options?.syncPayers) {
      this.syncPayerAmounts();
    }
    this.chartBillTotal = this.computeChartBillTotal();
    this.payingCount = this.members.filter((m) => !this.isSkipped(m.id)).length;
    const input = this.buildAdvanceInput();
    if (!input.totalAmount || input.totalAmount <= 0) {
      this.preview = null;
      this.previewSlices = [];
      return;
    }
    this.preview = buildSplitPreview(input, this.members);
    this.previewSlices = this.preview.lines
      .filter((line) => !this.isSkipped(line.memberId) && line.amount > 0)
      .map((line) => ({ memberId: line.memberId, amount: line.amount }));
  }

  /** 逐項記帳時，其他人不應保留舊的手動鎖定分攤（常與實付金額混淆） */
  private clearStaleSplitLocksForLineItemMode(): void {
    const hasAnyLineItems = Object.values(this.memberItems).some(
      (items) => items.length > 0
    );
    if (!hasAnyLineItems) return;

    for (const m of this.members) {
      if (this.isSkipped(m.id)) continue;
      if (this.memberHasLineItems(m.id)) continue;
      if (!this.splitLocked.has(m.id)) continue;

      this.splitLocked.delete(m.id);
      const nextInputs = { ...this.splitAmountInputs };
      delete nextInputs[m.id];
      this.splitAmountInputs = nextInputs;
    }
  }

  submitAdvance(): void {
    this.refreshPreview({ syncSplits: true, syncPayers: true });
    this.error = this.advanceSubmitHint;
    if (this.error) {
      if (this.stickySummary.paymentShortfall > 0) {
        this.scrollToPayerSection();
      }
      return;
    }

    if (this.isEditMode) {
      const title = (this.advanceForm.value.title ?? '').trim();
      const date = this.advanceForm.value.date ?? '';
      this.submitDialogTitle = COPY_DIALOGS.saveSplitTitle;
      this.submitDialogDetail = `${formatTransactionDateLabel(date)} · ${title} · NT$ ${this.effectiveTotal}`;
      this.submitDialogMessage = COPY_DIALOGS.saveSplitMessage;
      this.submitDialogOpen = true;
      return;
    }

    void this.confirmSubmit();
  }

  submitRepayment(): void {
    if (!this.hasRepaymentCreditors) {
      this.error = COPY_ERRORS.noRepaymentTarget;
      return;
    }
    const viewer = this.auth.currentMember;
    if (!viewer) {
      this.error = '請先登入';
      return;
    }
    const v = this.repaymentForm.value;
    const amount = this.resolveRepaymentAmount();
    this.error = validateRepaymentInput(viewer.id, v.toMemberId, amount) ?? '';
    if (this.error) return;
    const toName = this.auth.getMember(v.toMemberId)?.name ?? '';
    const date = v.date ?? todayLocalDate();
    this.submitDialogTitle = COPY_DIALOGS.addRepaymentTitle;
    this.submitDialogDetail = `${formatTransactionDateLabel(date)} · 還款給 ${toName} · NT$ ${amount}`;
    this.submitDialogMessage = COPY_DIALOGS.addRepaymentMessage;
    this.submitDialogOpen = true;
  }

  submitTransfer(): void {
    this.error =
      validateConsolidationInput(
        this.selectedSourceIds,
        this.activeTx,
        this.members.map((m) => m.id)
      ) ?? '';
    if (this.error) return;
    this.submitDialogTitle = COPY_DIALOGS.consolidateTitle;
    this.submitDialogDetail = `${formatTransactionDateLabel(todayLocalDate())} · ${COPY_RECORD_TYPE.consolidate} · 整合 ${this.selectedSourceIds.length} 筆記錄`;
    this.submitDialogMessage = COPY_DIALOGS.consolidateMessage;
    this.submitDialogOpen = true;
  }

  closeSubmitDialog(): void {
    if (this.submitBusy) return;
    this.submitDialogOpen = false;
  }

  async confirmSubmit(): Promise<void> {
    if (this.submitBusy) return;
    this.submitBusy = true;
    try {
      let err: string | null = null;
      if (this.mode === 'advance') {
        const input = this.buildAdvanceInput();
        const previewTx = this.buildPreviewTransaction();
        err =
          this.isEditMode && this.editTransactionId
            ? await this.transactions.updateAdvance(this.editTransactionId, input)
            : await this.transactions.createAdvance(input);

        if (!err && !this.isEditMode && previewTx) {
          this.submitDialogOpen = false;
          this.navigationAllowed = true;
          await this.router.navigateByUrl('/transactions');
          return;
        }
      } else if (this.mode === 'repayment') {
        const viewer = this.auth.currentMember!;
        const v = this.repaymentForm.value;
        const amount = this.resolveRepaymentAmount();
        err = await this.transactions.createRepayment({
          fromMemberId: viewer.id,
          toMemberId: v.toMemberId,
          amount,
          date: v.date ?? todayLocalDate(),
          note: null,
        });
      } else {
        const result = await this.transactions.createTransfer({
          date: todayLocalDate(),
          note: null,
          sourceTransactionIds: [...this.selectedSourceIds],
        });
        err = result.error;
        if (!err && result.transactionId) {
          this.submitDialogOpen = false;
          this.navigationAllowed = true;
          await this.router.navigate(['/transactions', result.transactionId]);
          return;
        }
      }
      if (err) {
        this.error = err;
        this.closeSubmitDialog();
        return;
      }
      this.submitDialogOpen = false;
      this.navigationAllowed = true;
      await this.router.navigateByUrl('/transactions');
    } finally {
      this.submitBusy = false;
    }
  }

  private initDrafts(): void {
    const next: Record<string, MemberDraft> = {};
    for (const m of this.members) {
      next[m.id] = this.memberDrafts[m.id] ?? { note: '', amount: '' };
    }
    this.memberDrafts = next;
  }

  private computeEffectiveTotal(): number {
    return this.consumptionSubtotal() + this.serviceFeeAmount();
  }

  private consumptionSubtotal(): number {
    // 總額以欄位為準（細項／手動分攤不再覆寫）；欄位空時才用分攤合計補
    const fromField = Number(this.advanceForm.value.totalAmount) || 0;
    if (fromField > 0) return fromField;

    return this.sumBaseParticipatingSplits();
  }

  get serviceFeeTotal(): number {
    return this.serviceFeeAmount();
  }

  private serviceFeeAmount(): number {
    return Math.max(0, Number(this.advanceForm.value.serviceFee) || 0);
  }

  private sumBaseParticipatingSplits(): number {
    return this.members
      .filter((m) => !this.isSkipped(m.id))
      .reduce((sum, m) => sum + (this.memberBaseSubtotals[m.id] ?? 0), 0);
  }

  private sumParticipatingSplits(): number {
    return this.sumBaseParticipatingSplits() + this.serviceFeeAmount();
  }

  /** 未填消費總額時，用分攤合計帶入（不含服務費）；已填的總額不覆寫 */
  private syncTotalAmountFieldFromSplits(): void {
    const fromField = Number(this.advanceForm.value.totalAmount) || 0;
    if (fromField > 0) return;

    const fromSplits = this.sumBaseParticipatingSplits();
    if (fromSplits > 0) {
      this.advanceForm.patchValue({ totalAmount: fromSplits }, { emitEvent: false });
    }
  }

  private sumExclusiveLineItems(): number {
    return this.members
      .filter((m) => !this.isSkipped(m.id))
      .reduce(
        (sum, m) =>
          sum +
          (this.memberItems[m.id] ?? []).reduce(
            (itemSum, item) => itemSum + item.amount,
            0
          ),
        0
      );
  }

  private computeChartBillTotal(): number | null {
    const total = Number(this.advanceForm.value.totalAmount) || 0;
    const bill = Number(this.advanceForm.value.billTotal) || 0;
    return bill > total ? bill : total > 0 ? total : null;
  }

  private syncAmountsFromItems(): void {
    const anchoredTotal = Number(this.advanceForm.value.totalAmount) || 0;
    const baseSubtotals: Record<string, number> = {};
    const nextManual = { ...this.manualAmounts };

    for (const m of this.members) {
      if (this.isSkipped(m.id)) {
        baseSubtotals[m.id] = 0;
        nextManual[m.id] = 0;
        continue;
      }

      const items = this.memberItems[m.id] ?? [];
      const fromItems = items.reduce((sum, item) => sum + item.amount, 0);

      // 還沒填總額時，細項加總當底稿（由下往上）；有總額則保留 syncSplitAmounts 寫入的專屬＋共同
      const amount =
        items.length > 0 && anchoredTotal <= 0
          ? fromItems
          : nextManual[m.id] ?? (items.length > 0 ? fromItems : 0);

      baseSubtotals[m.id] = amount;
      nextManual[m.id] = amount;
    }

    this.manualAmounts = nextManual;
    this.memberBaseSubtotals = baseSubtotals;
    this.applyServiceFeeToMemberSubtotals();
  }

  private applyServiceFeeToMemberSubtotals(): void {
    const shares = this.computeServiceFeeShares();
    const subtotals: Record<string, number> = {};
    for (const m of this.members) {
      const base = this.memberBaseSubtotals[m.id] ?? 0;
      subtotals[m.id] =
        this.isSkipped(m.id) ? 0 : base + (shares[m.id] ?? 0);
    }
    this.memberSubtotals = subtotals;
  }

  private computeServiceFeeShares(): Record<string, number> {
    const fee = this.serviceFeeAmount();
    if (fee <= 0) return {};

    const payingIds = this.members
      .filter((m) => !this.isSkipped(m.id))
      .map((m) => m.id);
    if (payingIds.length === 0) return {};

    const payerId =
      this.payerRows.find((row) => row.memberId)?.memberId ??
      this.auth.currentMember?.id ??
      payingIds[0];
    const shares = serviceFeeSharesByMember(
      fee,
      payingIds,
      payerId,
      this.remainderSeed
    );
    return Object.fromEntries(shares);
  }

  private buildAdvanceInput(): CreateAdvanceInput {
    const v = this.advanceForm.value;
    const splitItems = this.pruneSplitItems();
    const payers = this.payerRows
      .filter((row) => row.memberId)
      .map((row) => ({
        memberId: row.memberId,
        amount: Number(row.amount) || 0,
      }));
    const inferred = inferSplitDraftMode({
      allMemberIds: this.members.map((m) => m.id),
      excludedMemberIds: [...this.skippedMembers],
      totalAmount: this.consumptionSubtotal(),
      manualAmounts: this.manualAmounts,
      memberItems: this.memberItems,
      splitLockedIds: [...this.splitLocked],
    });
    return buildAdvanceInputFromDraft({
      title: v.title ?? '',
      date: v.date ?? todayLocalDate(),
      note: null,
      splitRule: inferred.splitRule,
      customInputMethod: inferred.customInputMethod,
      splitTotal: this.effectiveTotal,
      serviceFee: this.serviceFeeAmount() || null,
      chartBillTotal: this.chartBillTotal,
      payers,
      members: this.members,
      excludedMemberIds: [...this.skippedMembers],
      manualAmounts: { ...this.manualAmounts },
      splitItems: Object.keys(splitItems).length > 0 ? splitItems : undefined,
      remainderSeed: this.remainderSeed,
    });
  }

  private pruneSplitItems(): Record<string, LineItem[]> {
    const result: Record<string, LineItem[]> = {};
    for (const [id, items] of Object.entries(this.memberItems)) {
      if (items.length > 0) result[id] = items;
    }
    return result;
  }

  private tryLoadTransaction(id: string): void {
    const existing = this.transactions.getTransaction(id);
    if (existing) {
      this.applyTransaction(existing);
      return;
    }

    this.subs.push(
      this.transactions.transactions$
        .pipe(
          map((list) => list.find((t) => t.id === id)),
          filter((t): t is Transaction => !!t),
          take(1)
        )
        .subscribe((tx) => this.applyTransaction(tx))
    );
  }

  private applyTransaction(tx: Transaction): void {
    if (this.editHydrated) return;
    if (tx.type !== 'advance') {
      void this.router.navigate(['/transactions', tx.id]);
      return;
    }
    if (tx.status !== 'active') {
      void this.router.navigate(['/transactions', tx.id]);
      return;
    }
    if (tx.settledByTransferId) {
      void this.router.navigate(['/transactions', tx.id]);
      return;
    }

    this.editHydrated = true;
    this.participantPrefsApplied = true;
    this.mode = 'advance';
    const inferred = inferSplitRuleFromTransaction(tx);
    this.splitRule = inferred.splitRule;
    this.customInputMethod = inferred.customInputMethod;
    this.remainderSeed = tx.id;
    this.skippedMembers = new Set(
      tx.participants.filter((p) => p.amount === 0).map((p) => p.memberId)
    );

    const serviceFee = tx.serviceFee ?? 0;
    const consumptionTotal =
      serviceFee > 0 ? Math.max(0, tx.totalAmount - serviceFee) : tx.totalAmount;

    this.advanceForm.patchValue({
      title: tx.title,
      date: tx.date ?? todayLocalDate(),
      totalAmount: consumptionTotal,
      serviceFee: serviceFee > 0 ? serviceFee : null,
      billTotal: tx.billTotal ?? null,
    });

    this.payerRows = getAdvancePayers(tx).map((p) => ({
      memberId: p.memberId,
      amount: String(p.amount),
      locked: true,
    }));
    if (this.payerRows.length === 0) {
      this.payerRows = [
        { memberId: tx.payerId, amount: String(tx.totalAmount), locked: true },
      ];
    }

    if (this.splitRule === 'custom' && this.customInputMethod === 'lineItems') {
      const items: Record<string, LineItem[]> = {};
      for (const p of tx.participants) {
        const manual = filterManualLineItems(p.lineItems).map((item) => ({ ...item }));
        if (manual.length > 0) {
          items[p.memberId] = manual;
        }
      }
      this.memberItems = items;
    } else {
      const amounts: Record<string, number> = {};
      for (const p of tx.participants) {
        amounts[p.memberId] = p.amount;
      }
      const payingIds = tx.participants
        .filter((p) => p.amount > 0)
        .map((p) => p.memberId);
      this.manualAmounts =
        serviceFee > 0
          ? subtractServiceFeeFromAmounts(
              amounts,
              serviceFee,
              payingIds,
              tx.payerId,
              tx.id
            )
          : amounts;
    }

    const participating = tx.participants
      .filter((p) => p.amount > 0)
      .map((p) => p.memberId);
    this.applyParticipantMemberIds(participating);
    this.splitLocked.clear();
    this.splitAmountInputs = {};
    if (inferred.splitRule === 'custom') {
      for (const p of tx.participants) {
        if (p.amount > 0) {
          const baseAmount = this.manualAmounts[p.memberId] ?? p.amount;
          this.splitLocked.add(p.memberId);
          this.splitAmountInputs[p.memberId] = String(baseAmount);
        }
      }
    }

    this.initDrafts();
    this.syncAmountsFromItems();
    this.refreshPreview({ syncSplits: true });
    this.tryCaptureBaseline();
  }

  private scrollToPayerSection(): void {
    document
      .getElementById('payer-section')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
