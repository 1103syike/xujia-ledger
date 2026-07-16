import { Component, OnDestroy, OnInit, NgZone, ChangeDetectorRef } from '@angular/core';
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
import { resolveSyncedConsumptionTotal } from '../../../core/transactions/consumption-total-sync';
import { VirtualKeyboardMonitor } from '../../../core/infra/virtual-keyboard';
import {
  normalizeServiceFeeSplitMode,
  ServiceFeeSplitMode,
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
import { DigitsOnlyDirective } from '../../../shared/directives/digits-only.directive';
import { sumAmounts, toAmount } from '../../../shared/utils/amount';

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
    MemberPickerComponent,
    DateFieldComponent,
    SplitPieChartComponent,
    ConfirmDialogComponent,
    KaomojiDecoComponent,
    TransferBreakdownComponent,
    DigitsOnlyDirective,
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
  /** 服務費：均分 or 依基礎消費比例 */
  serviceFeeSplitMode: ServiceFeeSplitMode = 'equal';
  /** 切換服務費模式時用來重播按鈕特效 */
  feeModeTick = 0;
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
  /** 虛擬鍵盤開啟時隱藏底部提交列（由 visualViewport 判斷，不靠 focus 猜測） */
  isKeyboardOpen = false;
  /** 正在改消費總額：先不要自動 patch，避免刪數字時被蓋回去 */
  totalAmountFocused = false;
  /** 使用者有明確設定消費總額（深色）；否則淺色跟隨應付加總 */
  totalAmountAnchored = false;
  private totalAmountEditBaseline = '';
  error = '';
  private formFocusBlurTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly keyboardMonitor = new VirtualKeyboardMonitor();
  private formFieldFocused = false;
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
  /** 新增品項按鈕特效：哪個成員、第幾次點 */
  addItemPopFor: string | null = null;
  addItemTick = 0;
  /** 有均分／免均分按鈕特效 */
  commonSharePopFor: string | null = null;
  commonShareTick = 0;
  /** 剛加入的品項列（memberId:index），用來播進場動畫 */
  lastAddedItemKey: string | null = null;
  /** 誰在花錢 chips 點擊彈一下：`'all'` 或 memberId */
  participantChipPopKey: string | null = null;
  participantChipPopTick = 0;
  /** 點全家時成員 chips 依序彈 */
  participantCascadeTick = 0;
  /** 誰在付錢 tile 點擊彈一下 */
  payerChipPopKey: string | null = null;
  payerChipPopTick = 0;
  /** 金額欄送出後的確認動效：key → tick（每次 +1 重播） */
  amountPulseTicks: Record<string, number> = {};
  lastAddedItemTick = 0;
  /** 正被幹掉的品項列（memberId:index） */
  slayingItemKey: string | null = null;
  private slayTimer: ReturnType<typeof setTimeout> | null = null;
  participantTuningOpen = false;
  activeParticipantKey = '';
  recentDateOptions: string[] = [];
  titleSuggestionOptions: string[] = [];
  private splitLocked = new Set<string>();
  /** 不參與共同均分（仍可付專屬細項，例：自己一盒泡芙） */
  private noCommonShareMembers = new Set<string>();
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
  /** 點「全家」全選前的參與名單，再點一次用來還原 */
  private participantsBeforeSelectAll: string[] | null = null;
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
    private route: ActivatedRoute,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef
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
    if (this.slayTimer) {
      clearTimeout(this.slayTimer);
      this.slayTimer = null;
    }
    this.keyboardMonitor.stop();
    this.subs.forEach((s) => s.unsubscribe());
  }

  onFormFocusIn(event: FocusEvent): void {
    if (!this.isEditableFormField(event.target)) return;
    this.clearFormFocusBlurTimer();
    this.formFieldFocused = true;
    this.keyboardMonitor.start((open) => {
      this.ngZone.run(() => {
        this.isKeyboardOpen = open;
        this.cdr.markForCheck();
        // 鍵盤已關且不再編輯 → 解除監聽
        if (!open && !this.formFieldFocused) {
          this.keyboardMonitor.stop();
        }
      });
    });
  }

  onFormFocusOut(event: FocusEvent): void {
    if (!this.isEditableFormField(event.target)) return;
    this.clearFormFocusBlurTimer();
    // 等焦點切完再判斷，避免欄位間移動時 monitor 被關掉
    this.formFocusBlurTimer = setTimeout(() => {
      this.formFocusBlurTimer = null;
      const active = document.activeElement;
      const form = document.getElementById('create-advance-form');
      this.formFieldFocused = !!(
        form &&
        active &&
        form.contains(active) &&
        this.isEditableFormField(active)
      );
      if (!this.formFieldFocused && !this.keyboardMonitor.isOpen) {
        this.keyboardMonitor.stop();
        this.isKeyboardOpen = false;
      }
    }, 50);
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
        serviceFeeSplitMode: this.serviceFeeSplitMode,
        billTotal:
          v.billTotal === null || v.billTotal === ''
            ? null
            : Number(v.billTotal),
        skippedMembers: [...this.skippedMembers],
        noCommonShareMembers: [...this.noCommonShareMembers],
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

  /** 有專屬細項時，顯示共同消費剩餘均分（只算會進均分的人） */
  get sharedRemainderLabel(): string | null {
    if (!this.hasAnyLineItems || this.payingCount === 0) return null;

    const total = Number(this.advanceForm.value.totalAmount) || 0;
    if (total <= 0) return null;

    const exclusiveSum = this.sumExclusiveLineItems();
    const remainder = total - exclusiveSum;
    if (remainder <= 0) return null;

    const shareCount = this.commonShareParticipantCount();
    if (shareCount <= 0) {
      return `共同消費 NT$ ${remainder}（尚無人均分）`;
    }

    const perPerson = Math.floor(remainder / shareCount);
    if (remainder % shareCount === 0) {
      return COPY_SPLIT.sharedRemainderExact(remainder, perPerson);
    }
    return COPY_SPLIT.sharedRemainderApprox(remainder, perPerson);
  }

  private commonShareParticipantCount(): number {
    return this.members.filter(
      (m) => !this.isSkipped(m.id) && this.sharesCommon(m.id)
    ).length;
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
      // 已全家再點一次 → 還原成點全家之前的名單（例如只選林庭郁）
      const restore = this.participantsBeforeSelectAll;
      this.participantsBeforeSelectAll = null;
      if (restore && restore.length > 0) {
        this.applyParticipantMemberIds(restore);
      } else {
        // 沒有快取（一進來就是全家）→ 維持可取消，清空
        this.applyParticipantMemberIds([]);
      }
    } else {
      this.participantsBeforeSelectAll = this.members
        .filter((m) => !this.isSkipped(m.id))
        .map((m) => m.id);
      this.applyParticipantMemberIds(this.members.map((m) => m.id));
    }
    this.pulseParticipantAllChips();
    this.refreshPreview({ syncSplits: true, syncPayers: true });
  }

  toggleParticipantMember(memberId: string): void {
    if (this.isSkipped(memberId)) {
      this.toggleSkip(memberId);
      this.pulseParticipantChip(memberId);
      return;
    }

    const activeCount = this.members.filter((m) => !this.isSkipped(m.id)).length;
    if (activeCount <= 1) {
      this.pulseParticipantChip(memberId);
      return;
    }

    this.toggleSkip(memberId);
    this.pulseParticipantChip(memberId);
  }

  private pulseParticipantChip(memberId: string): void {
    this.participantChipPopKey = memberId;
    this.participantChipPopTick += 1;
  }

  private pulseParticipantAllChips(): void {
    this.participantChipPopKey = 'all';
    this.participantChipPopTick += 1;
    this.participantCascadeTick += 1;
  }

  toggleParticipantTuning(): void {
    this.participantTuningOpen = !this.participantTuningOpen;
  }

  memberHasLineItems(memberId: string): boolean {
    return (this.memberItems[memberId] ?? []).length > 0;
  }

  /** 該員細項合計（不含共同剩餘） */
  memberExclusiveTotal(memberId: string): number {
    return sumAmounts((this.memberItems[memberId] ?? []).map((item) => item.amount));
  }

  /** 該員分到的共同消費（基礎應付 − 專屬細項） */
  memberCommonShare(memberId: string): number {
    if (this.isSkipped(memberId) || !this.hasAnyLineItems) return 0;
    const exclusive = this.memberExclusiveTotal(memberId);
    const allocated = this.memberBaseSubtotals[memberId] ?? 0;
    return Math.max(0, allocated - exclusive);
  }

  /** 該員分到的服務費 */
  memberServiceFeeShare(memberId: string): number {
    if (this.isSkipped(memberId) || this.serviceFeeAmount() <= 0) return 0;
    const base = this.memberBaseSubtotals[memberId] ?? 0;
    const total = this.memberSubtotals[memberId] ?? 0;
    return Math.max(0, total - base);
  }

  /** 卡片下方是否要列出細項／共同／服務費 */
  hasMemberBreakdown(memberId: string): boolean {
    if (this.isSkipped(memberId)) return false;
    return (
      this.memberHasLineItems(memberId) ||
      this.memberCommonShare(memberId) > 0 ||
      this.memberServiceFeeShare(memberId) > 0
    );
  }

  /** 應付直接顯示合計（含服務費），不再用可編輯欄位當總額 */
  showsAllocatedTotal(memberId: string): boolean {
    return (
      this.memberHasLineItems(memberId) || this.memberServiceFeeShare(memberId) > 0
    );
  }

  isSplitAmountLocked(memberId: string): boolean {
    return this.splitLocked.has(memberId) || this.memberHasLineItems(memberId);
  }

  splitAmountDisplay(memberId: string): string {
    if (this.splitAmountInputs[memberId] !== undefined) {
      return this.formatAmountInputValue(this.splitAmountInputs[memberId]);
    }
    const amount = this.manualAmounts[memberId];
    return amount && amount > 0 ? String(amount) : '';
  }

  /** 顯示用：0／空字串都當空，避免點進去還自帶一個 0 */
  private formatAmountInputValue(raw: string | number | null | undefined): string {
    if (raw === null || raw === undefined) return '';
    const text = String(raw).trim();
    if (!text || text === '0') return '';
    const n = Number(text);
    if (!Number.isNaN(n) && n === 0) return '';
    return text;
  }

  /** 點進應付：若是 0 就清掉；有數字就全選方便直接蓋過 */
  focusSplitAmount(memberId: string): void {
    if (this.memberHasLineItems(memberId)) return;
    const shown = this.splitAmountDisplay(memberId);
    if (!shown && this.splitAmountInputs[memberId]) {
      this.splitAmountInputs = { ...this.splitAmountInputs, [memberId]: '' };
    }
  }

  setSplitAmount(memberId: string, value: string | number | null): void {
    if (this.memberHasLineItems(memberId)) return;
    const next =
      value === null || value === undefined ? '' : String(value);
    this.splitAmountInputs = { ...this.splitAmountInputs, [memberId]: next };
  }

  commitSplitAmount(memberId: string): void {
    if (this.memberHasLineItems(memberId)) return;

    const beforeSplits = { ...this.splitAmountInputs };
    const beforePayers = this.snapshotPayerAmounts();

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
      this.pulseAmountField(`split:${memberId}`);
    }
    this.refreshPreview({ syncSplits: true, syncPayers: true });
    this.pulseChangedSplitAmounts(beforeSplits, memberId);
    this.pulseChangedPayerAmounts(beforePayers);
    this.pulseAmountField('sticky');
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
    this.noCommonShareMembers.clear();
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

  isPayer(memberId: string): boolean {
    return this.payerRows.some((row) => row.memberId === memberId);
  }

  /** 實付列表依成員順序，不是按勾選先後亂跳 */
  get orderedPayerMembers(): DisplayMember[] {
    const payerIds = new Set(this.payerRows.map((row) => row.memberId));
    return this.members.filter((m) => payerIds.has(m.id));
  }

  isPayerAmountLocked(memberId: string): boolean {
    return this.payerRows.find((row) => row.memberId === memberId)?.locked ?? false;
  }

  payerAmountOf(memberId: string): string {
    return this.formatAmountInputValue(
      this.payerRows.find((row) => row.memberId === memberId)?.amount ?? ''
    );
  }

  focusPayerAmount(memberId: string): void {
    const shown = this.payerAmountOf(memberId);
    if (!shown) {
      const index = this.payerRows.findIndex((row) => row.memberId === memberId);
      if (index >= 0 && this.payerRows[index].amount) {
        this.payerRows[index].amount = '';
      }
    }
  }

  /** 點一下切換是否付錢；不能全部取消（至少留一位） */
  togglePayerMember(memberId: string): void {
    this.payerChipPopKey = memberId;
    this.payerChipPopTick += 1;

    if (this.isPayer(memberId)) {
      if (this.payerRows.length <= 1) return;
      this.payerRows = this.payerRows.filter((row) => row.memberId !== memberId);
      this.refreshPreview({ syncPayers: true });
      return;
    }

    this.payerRows = [
      ...this.payerRows,
      { memberId, amount: '', locked: false },
    ];
    this.refreshPreview({ syncPayers: true });
  }

  setPayerAmountByMember(memberId: string, value: string | number | null): void {
    const index = this.payerRows.findIndex((row) => row.memberId === memberId);
    if (index < 0) return;
    this.setPayerAmount(index, value);
  }

  commitPayerAmountByMember(memberId: string): void {
    const index = this.payerRows.findIndex((row) => row.memberId === memberId);
    if (index < 0) return;
    this.commitPayerAmount(index);
  }

  amountPulseOf(key: string): number | null {
    const tick = this.amountPulseTicks[key];
    return tick ? tick : null;
  }

  private pulseAmountField(key: string): void {
    this.amountPulseTicks = {
      ...this.amountPulseTicks,
      [key]: (this.amountPulseTicks[key] ?? 0) + 1,
    };
  }

  private snapshotPayerAmounts(): Record<string, string> {
    return Object.fromEntries(
      this.payerRows.map((row) => [row.memberId, String(row.amount ?? '')])
    );
  }

  private pulseChangedPayerAmounts(
    before: Record<string, string>,
    skipMemberId?: string
  ): void {
    for (const row of this.payerRows) {
      if (skipMemberId && row.memberId === skipMemberId) continue;
      if (before[row.memberId] === String(row.amount ?? '')) continue;
      this.pulseAmountField(`payer:${row.memberId}`);
    }
  }

  private pulseChangedSplitAmounts(
    before: Record<string, string>,
    skipMemberId?: string
  ): void {
    for (const memberId of Object.keys(this.splitAmountInputs)) {
      if (skipMemberId && memberId === skipMemberId) continue;
      if (before[memberId] === this.splitAmountInputs[memberId]) continue;
      this.pulseAmountField(`split:${memberId}`);
    }
  }

  previewAmountFor(memberId: string): number {
    return this.preview?.lines.find((line) => line.memberId === memberId)?.amount ?? 0;
  }

  toggleAddItem(memberId: string): void {
    this.addingItemFor = this.addingItemFor === memberId ? null : memberId;
    this.addItemPopFor = memberId;
    this.addItemTick += 1;
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
    this.serviceFeeSplitMode = 'equal';
    this.memberItems = {};
    this.manualAmounts = {};
    this.splitAmountInputs = {};
    this.splitLocked.clear();
    this.noCommonShareMembers.clear();
    this.participantTuningOpen = false;
    this.participantPrefsApplied = false;
    this.skippedMembers = new Set();
    this.participantsBeforeSelectAll = null;
    this.addingItemFor = null;
    this.error = '';
    this.totalAmountAnchored = false;
    this.totalAmountEditBaseline = '';
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
    const nextItems = [...(this.memberItems[memberId] ?? []), { note, amount }];
    this.memberItems = { ...this.memberItems, [memberId]: nextItems };
    this.lastAddedItemKey = `${memberId}:${nextItems.length - 1}`;
    this.lastAddedItemTick += 1;
    this.splitLocked.add(memberId);
    draft.note = '';
    draft.amount = '';
    this.addingItemFor = null;
    this.syncAmountsFromItems();
    this.refreshPreview({ syncSplits: true, syncPayers: true });
  }

  isJustAddedItem(memberId: string, index: number): boolean {
    return (
      this.lastAddedItemTick > 0 &&
      this.lastAddedItemKey === `${memberId}:${index}`
    );
  }

  removeMemberItem(memberId: string, index: number): void {
    const key = `${memberId}:${index}`;
    // 正在被幹掉 → 忽略連點
    if (this.slayingItemKey) return;

    const prefersReduced =
      typeof matchMedia !== 'undefined' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      this.commitRemoveMemberItem(memberId, index);
      return;
    }

    this.slayingItemKey = key;
    this.slayTimer = setTimeout(() => {
      this.slayTimer = null;
      this.slayingItemKey = null;
      this.commitRemoveMemberItem(memberId, index);
    }, 430);
  }

  isSlayingItem(memberId: string, index: number): boolean {
    return this.slayingItemKey === `${memberId}:${index}`;
  }

  private commitRemoveMemberItem(memberId: string, index: number): void {
    const next = [...(this.memberItems[memberId] ?? [])];
    if (index < 0 || index >= next.length) return;
    next.splice(index, 1);
    this.memberItems = { ...this.memberItems, [memberId]: next };
    if (this.lastAddedItemKey === `${memberId}:${index}`) {
      this.lastAddedItemKey = null;
    }
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

  /** 輸入中只改金額，不要換掉 row 物件（否則畫面會重建 input 導致失焦） */
  setPayerAmount(index: number, value: string | number | null): void {
    const row = this.payerRows[index];
    if (!row) return;
    row.amount = value === null || value === undefined ? '' : String(value);
  }

  commitPayerAmount(index: number): void {
    const row = this.payerRows[index];
    if (!row) return;

    const memberId = row.memberId;
    const beforePayers = this.snapshotPayerAmounts();
    const raw = String(row.amount ?? '').trim();
    if (!raw) {
      row.amount = '';
      row.locked = false;
    } else {
      row.amount = String(Number(raw) || 0);
      row.locked = true;
      this.pulseAmountField(`payer:${memberId}`);
    }

    this.refreshPreview({ syncPayers: true });
    this.pulseChangedPayerAmounts(beforePayers, memberId);
    this.pulseAmountField('sticky');
  }

  onSplitTotalCommit(field: 'total' | 'fee' = 'total'): void {
    const beforePayers = this.snapshotPayerAmounts();
    const beforeSplits = { ...this.splitAmountInputs };
    this.refreshPreview({ syncSplits: true, syncPayers: true });
    this.pulseAmountField(field);
    this.pulseChangedSplitAmounts(beforeSplits);
    this.pulseChangedPayerAmounts(beforePayers);
    this.pulseAmountField('sticky');
  }

  onTotalAmountFocus(): void {
    this.totalAmountFocused = true;
    this.totalAmountEditBaseline = String(
      this.advanceForm.value.totalAmount ?? ''
    );
  }

  onTotalAmountBlur(): void {
    this.totalAmountFocused = false;
    const raw = this.advanceForm.value.totalAmount;
    const text = raw === null || raw === undefined ? '' : String(raw).trim();
    const cleared = !text || Number(text) <= 0 || Number.isNaN(Number(text));

    if (cleared) {
      // 清掉總額 → 改回「淺色跟隨應付」
      this.totalAmountAnchored = false;
      this.advanceForm.patchValue({ totalAmount: null }, { emitEvent: false });
    } else if (text !== this.totalAmountEditBaseline) {
      // 有改過數字 → 視為使用者設定總額（錨定）
      this.totalAmountAnchored = true;
    }

    this.onSplitTotalCommit('total');
  }

  /** 消費總額是否為使用者錨定（實色手動）；否則淺色自動 */
  isTotalAmountAnchored(): boolean {
    return this.totalAmountAnchored;
  }

  /** 服務費：有填就當手動實色，空／0 為淺色 */
  isServiceFeeManual(): boolean {
    return (Number(this.advanceForm.value.serviceFee) || 0) > 0;
  }

  private syncSplitAmounts(): void {
    const subtotal = Number(this.advanceForm.value.totalAmount) || 0;
    if (subtotal <= 0) return;

    const participating = this.members.filter((m) => !this.isSkipped(m.id));
    if (participating.length === 0) return;

    this.clearStaleSplitLocksForLineItemMode();

    const nextManual = { ...this.manualAmounts };
    const nextInputs = { ...this.splitAmountInputs };

    // 有細項：專屬歸人；共同剩餘只分給「有均分」的人
    if (this.hasAnyLineItems) {
      const exclusives = participating.map((m) =>
        sumAmounts((this.memberItems[m.id] ?? []).map((item) => item.amount))
      );
      const sharesCommon = participating.map((m) => this.sharesCommon(m.id));
      const amounts = distributeHybridSplitAmounts(
        subtotal,
        exclusives,
        sharesCommon
      );

      participating.forEach((m, index) => {
        nextManual[m.id] = amounts[index];
        if (!this.memberHasLineItems(m.id)) {
          nextInputs[m.id] = amounts[index] > 0 ? String(amounts[index]) : '';
        }
      });

      this.manualAmounts = nextManual;
      this.splitAmountInputs = nextInputs;
      return;
    }

    // 無細項：免均分＝鎖在 0（或既有手動鎖金額），其餘人分剩餘
    const rows = participating.map((m) => {
      const noCommon = !this.sharesCommon(m.id);
      const locked = this.splitLocked.has(m.id) || noCommon;
      return {
        amount: locked
          ? noCommon && !this.splitLocked.has(m.id)
            ? 0
            : Number(this.manualAmounts[m.id]) || 0
          : Number(this.manualAmounts[m.id]) || 0,
        locked,
      };
    });

    const amounts = distributeSplitAmounts(subtotal, rows);

    participating.forEach((m, index) => {
      nextManual[m.id] = amounts[index];
      if (!this.splitLocked.has(m.id) && this.sharesCommon(m.id)) {
        nextInputs[m.id] = amounts[index] > 0 ? String(amounts[index]) : '';
      } else if (!this.sharesCommon(m.id) && !this.splitLocked.has(m.id)) {
        nextInputs[m.id] = '';
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
      amount: amounts[index] > 0 ? String(amounts[index]) : '',
    }));
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

  /** 預設 true；免均分＝只付專屬／手動鎖，不進共同 */
  sharesCommon(memberId: string): boolean {
    return !this.noCommonShareMembers.has(memberId);
  }

  isNoCommonShare(memberId: string): boolean {
    return this.noCommonShareMembers.has(memberId);
  }

  toggleNoCommonShare(memberId: string): void {
    if (this.isSkipped(memberId)) return;
    this.commonSharePopFor = memberId;
    this.commonShareTick += 1;
    if (this.noCommonShareMembers.has(memberId)) {
      this.noCommonShareMembers.delete(memberId);
    } else {
      this.noCommonShareMembers.add(memberId);
    }
    this.refreshPreview({ syncSplits: true, syncPayers: true });
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
      this.noCommonShareMembers.delete(id);
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

  /** 消費總額（不含服務費）；模板也會用來判斷要不要秀「基礎消費」編輯 */
  consumptionSubtotal(): number {
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
    return sumAmounts(
      this.members
        .filter((m) => !this.isSkipped(m.id))
        .map((m) => this.memberBaseSubtotals[m.id])
    );
  }

  private sumParticipatingSplits(): number {
    return this.sumBaseParticipatingSplits() + this.serviceFeeAmount();
  }

  /**
   * 對齊消費總額：
   * - 已錨定：不因應付增減而改；細項超過才撐開
   * - 未錨定：總額＝鎖定應付加總（淺色跟隨）
   */
  private syncTotalAmountFieldFromSplits(): void {
    if (this.totalAmountFocused) return;

    const fromField = Number(this.advanceForm.value.totalAmount) || 0;
    const exclusiveSum = this.sumExclusiveLineItems();
    const lockedSplitSum = this.sumLockedSplitAmounts();
    const nextTotal = resolveSyncedConsumptionTotal({
      fromField,
      exclusiveSum,
      lockedSplitSum,
      anchored: this.totalAmountAnchored,
    });

    if (nextTotal === fromField) {
      if (!this.totalAmountAnchored && nextTotal <= 0) {
        const raw = this.advanceForm.value.totalAmount;
        if (raw !== null && raw !== '') {
          this.advanceForm.patchValue({ totalAmount: null }, { emitEvent: false });
        }
      }
      return;
    }

    this.advanceForm.patchValue(
      { totalAmount: nextTotal > 0 ? nextTotal : null },
      { emitEvent: false }
    );
  }

  /** 手動鎖住的應付加總（未錨定時用來組成消費總額） */
  private sumLockedSplitAmounts(): number {
    return sumAmounts(
      this.members
        .filter((m) => !this.isSkipped(m.id) && this.splitLocked.has(m.id))
        .map((m) => this.manualAmounts[m.id])
    );
  }

  private sumExclusiveLineItems(): number {
    return sumAmounts(
      this.members
        .filter((m) => !this.isSkipped(m.id))
        .flatMap((m) => (this.memberItems[m.id] ?? []).map((item) => item.amount))
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
      const fromItems = sumAmounts(items.map((item) => item.amount));

      // 還沒填總額時，細項加總當底稿（由下往上）；有總額則保留 syncSplitAmounts 寫入的專屬＋共同
      const amount =
        items.length > 0 && anchoredTotal <= 0
          ? fromItems
          : toAmount(nextManual[m.id] ?? (items.length > 0 ? fromItems : 0));

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
      this.remainderSeed,
      {
        mode: this.serviceFeeSplitMode,
        baseAmountsByMember: this.memberBaseSubtotals,
      }
    );
    return Object.fromEntries(shares);
  }

  toggleServiceFeeSplitMode(): void {
    this.serviceFeeSplitMode =
      this.serviceFeeSplitMode === 'equal' ? 'proportional' : 'equal';
    this.feeModeTick += 1;
    this.refreshPreview({ syncSplits: true, syncPayers: true });
  }

  get serviceFeeSplitHint(): string {
    return this.serviceFeeSplitMode === 'proportional'
      ? this.create.serviceFeeHintProportional
      : this.create.serviceFeeHintEqual;
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
      serviceFeeSplitMode: this.serviceFeeSplitMode,
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
    this.serviceFeeSplitMode = normalizeServiceFeeSplitMode(
      tx.serviceFeeSplitMode
    );
    this.remainderSeed = tx.id;
    this.skippedMembers = new Set(
      tx.participants.filter((p) => p.amount === 0).map((p) => p.memberId)
    );

    const serviceFee = tx.serviceFee ?? 0;
    const feeMode = this.serviceFeeSplitMode;
    const consumptionTotal =
      serviceFee > 0 ? Math.max(0, tx.totalAmount - serviceFee) : tx.totalAmount;

    this.advanceForm.patchValue({
      title: tx.title,
      date: tx.date ?? todayLocalDate(),
      totalAmount: consumptionTotal,
      serviceFee: serviceFee > 0 ? serviceFee : null,
      billTotal: tx.billTotal ?? null,
    });
    this.totalAmountAnchored = consumptionTotal > 0;

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
              tx.id,
              feeMode
            )
          : amounts;
    }

    const participating = tx.participants
      .filter((p) => p.amount > 0)
      .map((p) => p.memberId);
    this.applyParticipantMemberIds(participating);
    this.splitLocked.clear();
    this.splitAmountInputs = {};
    this.noCommonShareMembers.clear();
    if (inferred.splitRule === 'custom') {
      for (const p of tx.participants) {
        if (p.amount > 0) {
          const baseAmount = this.manualAmounts[p.memberId] ?? p.amount;
          this.splitLocked.add(p.memberId);
          this.splitAmountInputs[p.memberId] = String(baseAmount);
        }
      }
    }

    // 推測免均分：專屬細項剛好等於應付（沒分到共同）
    if (serviceFee <= 0) {
      for (const p of tx.participants) {
        if (p.amount <= 0) continue;
        const exclusive = sumAmounts(
          (this.memberItems[p.memberId] ?? []).map((item) => item.amount)
        );
        if (exclusive > 0 && exclusive === p.amount) {
          this.noCommonShareMembers.add(p.memberId);
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
