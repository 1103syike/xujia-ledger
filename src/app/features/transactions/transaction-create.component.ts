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
import { Subscription, combineLatest, filter, map, startWith, take } from 'rxjs';
import {
  CreateAdvanceInput,
  DEFAULT_ACCOUNT_ID,
  DisplayMember,
  LineItem,
  SplitMode,
  Transaction,
  TransferEdge,
} from '../../core/models';
import { AuthService } from '../../core/services/auth.service';
import { TransactionService } from '../../core/services/transaction.service';
import {
  buildSplitPreview,
  previewToParticipants,
  SplitPreview,
  validateCreateInput,
  validateRepaymentInput,
} from '../../core/utils/split-calculator';
import {
  buildConsolidationPreview,
  ConsolidationPreview,
  validateConsolidationInput,
} from '../../core/utils/debt-consolidation';
import {
  buildAdvanceInputFromDraft,
  computeStickySummary,
  CustomInputMethod,
  inferSplitRuleFromTransaction,
  SplitRule,
} from '../../core/utils/advance-draft';
import {
  advanceChangeAmount,
  getAdvancePayers,
  primaryPayerId,
} from '../../core/utils/advance-allocation';
import { filterManualLineItems } from '../../core/utils/advance-display';
import { formatOweAmount } from '../../core/utils/settlement-display';
import { amountViewerOwesOther } from '../../core/utils/ledger-calculator';
import { activeTransactions, formatTransactionDateLabel, todayLocalDate } from '../../core/utils/transaction-date';
import { MemberAvatarComponent } from '../../shared/components/member-avatar.component';
import { MemberSelectGridComponent } from '../../shared/components/member-select-grid.component';
import { MemberPickerComponent } from '../../shared/components/member-picker.component';
import { DateFieldComponent } from '../../shared/components/date-field.component';
import { SplitPieChartComponent } from '../../shared/components/split-pie-chart.component';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog.component';
import { KaomojiDecoComponent } from '../../shared/components/kaomoji-deco.component';
import { TransferBreakdownComponent } from '../../shared/components/transfer-breakdown.component';
import {
  COPY_ACTIONS,
  COPY_DIALOGS,
  COPY_EMPTY,
  COPY_ERRORS,
  COPY_PAGES,
  COPY_RECORD_TYPE,
  COPY_SPLIT,
  COPY_TERMS,
} from '../../copy';

type CreateMode = 'advance' | 'repayment' | 'transfer';

interface MemberDraft {
  note: string;
  amount: string;
}

interface PayerDraft {
  memberId: string;
  amount: string;
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
export class TransactionCreateComponent implements OnInit, OnDestroy {
  actions = COPY_ACTIONS;
  pages = COPY_PAGES;
  terms = COPY_TERMS;
  split = COPY_SPLIT;
  recordType = COPY_RECORD_TYPE;
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
  manualAmounts: Record<string, number> = {};
  preview: SplitPreview | null = null;
  previewSlices: Array<{ memberId: string; amount: number }> = [];
  effectiveTotal = 0;
  chartBillTotal: number | null = null;
  payingCount = 0;
  error = '';
  remainderSeed = '';
  repaymentBalance: number | null = null;
  submitDialogOpen = false;
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
      billTotal: [null, [Validators.min(1)]],
      note: [''],
    });
    this.payerRows = [{ memberId: defaultPayer, amount: '' }];
    this.repaymentForm = this.fb.group({
      date: [todayLocalDate(), Validators.required],
      toMemberId: [''],
      amount: [null, [Validators.min(1)]],
      note: [''],
    });
    this.transferForm = this.fb.group({
      date: [todayLocalDate(), Validators.required],
      note: [''],
    });
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

    this.subs.push(
      this.auth.currentMember$
        .pipe(
          filter((m): m is DisplayMember => !!m),
          take(1)
        )
        .subscribe((member) => {
          if (this.payerRows.length === 1 && !this.payerRows[0].memberId) {
            this.payerRows = [{ memberId: member.id, amount: this.payerRows[0].amount }];
          }
          this.refreshPreview();
        }),
      this.advanceForm.valueChanges.subscribe(() => this.refreshPreview()),
      combineLatest([
        this.transactions.transactions$,
        this.auth.currentMember$,
        this.repaymentForm.valueChanges.pipe(startWith(this.repaymentForm.value)),
      ]).subscribe(([txs, member]) => {
        this.activeTx = activeTransactions(txs);
        this.refreshRepaymentTargets(member?.id);
        this.updateRepaymentBalance(member?.id);
        this.refreshTransferPreview();
      })
    );
    this.refreshPreview();
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
  }

  setMode(mode: CreateMode): void {
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
  }

  fillFullRepayment(): void {
    if (this.repaymentBalance && this.repaymentBalance > 0) {
      this.repaymentForm.patchValue({ amount: this.repaymentBalance });
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
      this.repaymentForm.patchValue({ toMemberId: pickDefault() }, { emitEvent: true });
    }

    this.initialRepaymentToId = null;
  }

  private reloadMembers(): void {
    this.members = this.auth.getAllMembers();
    this.initDrafts();
    this.refreshPreview();
  }

  get splitMode(): SplitMode {
    return this.splitRule === 'equal' ? 'equal' : 'itemized';
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
    if (this.splitRule !== 'equal' || !this.preview || this.payingCount === 0) {
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

  selectPrimaryPayer(memberId: string): void {
    if (this.payerRows.length === 1) {
      this.payerRows = [{ memberId, amount: this.payerRows[0].amount }];
      this.syncSinglePayerAmount();
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
    void this.router.navigateByUrl('/transactions');
  }

  createAnother(): void {
    this.successOpen = false;
    this.successImpactLines = [];
    this.resetAdvanceForm();
  }

  private resetAdvanceForm(): void {
    const defaultPayer = this.auth.currentMember?.id ?? this.members[0]?.id ?? '';
    this.advanceForm.reset({
      title: '',
      date: todayLocalDate(),
      totalAmount: null,
      billTotal: null,
      note: '',
    });
    this.payerRows = [{ memberId: defaultPayer, amount: '' }];
    this.splitRule = 'equal';
    this.customInputMethod = 'lineItems';
    this.memberItems = {};
    this.manualAmounts = {};
    this.skippedMembers = new Set();
    this.addingItemFor = null;
    this.error = '';
    this.remainderSeed = crypto.randomUUID?.() ?? String(Date.now());
    this.initDrafts();
    this.refreshPreview();
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
    const note = draft.note.trim() || '未命名項目';
    if (!amount || amount <= 0 || Number.isNaN(amount)) {
      this.error = '請輸入有效的金額';
      return;
    }
    this.error = '';
    this.memberItems = { ...this.memberItems, [memberId]: [...(this.memberItems[memberId] ?? []), { note, amount }] };
    draft.note = '';
    draft.amount = '';
    this.addingItemFor = null;
    this.syncAmountsFromItems();
    this.refreshPreview();
  }

  removeMemberItem(memberId: string, index: number): void {
    const next = [...(this.memberItems[memberId] ?? [])];
    next.splice(index, 1);
    this.memberItems = { ...this.memberItems, [memberId]: next };
    this.syncAmountsFromItems();
    this.refreshPreview();
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
      { memberId: available?.id ?? '', amount: '' },
    ];
    this.syncSinglePayerAmount();
    this.refreshPreview();
  }

  removePayer(index: number): void {
    if (this.payerRows.length <= 1) return;
    this.payerRows = this.payerRows.filter((_, i) => i !== index);
    this.syncSinglePayerAmount();
    this.refreshPreview();
  }

  setPayerMember(index: number, memberId: string): void {
    const next = [...this.payerRows];
    next[index] = { ...next[index], memberId };
    this.payerRows = next;
    this.refreshPreview();
  }

  setPayerAmount(index: number, value: string): void {
    const next = [...this.payerRows];
    next[index] = { ...next[index], amount: value };
    this.payerRows = next;
    this.refreshPreview();
  }

  /**
   * 單人代墊時同步實付金額：
   * - 細分：實付不足分攤總額時自動補齊；付更多（找錢）則不動
   * - 平分：僅空欄時預填分攤總額
   */
  private syncSinglePayerAmount(): void {
    if (this.payerRows.length !== 1) return;
    const total = this.effectiveTotal;
    if (total <= 0) return;
    const row = this.payerRows[0];
    const current = Number(row.amount) || 0;
    const isEmpty = !String(row.amount ?? '').trim();

    if (this.splitRule === 'custom') {
      if (current < total) {
        this.payerRows = [{ ...row, amount: String(total) }];
      }
      return;
    }

    if (isEmpty) {
      this.payerRows = [{ ...row, amount: String(total) }];
    }
  }

  setPayer(id: string): void {
    if (this.payerRows.length === 1) {
      this.payerRows = [{ memberId: id, amount: this.payerRows[0].amount }];
      this.syncSinglePayerAmount();
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
    this.refreshPreview();
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
    this.refreshPreview();
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
      if (this.addingItemFor === id) {
        this.addingItemFor = null;
      }
    }
    this.syncAmountsFromItems();
    this.refreshPreview();
  }

  refreshPreview(): void {
    this.syncAmountsFromItems();
    this.effectiveTotal = this.computeEffectiveTotal();
    this.syncSinglePayerAmount();
    this.chartBillTotal = this.computeChartBillTotal();
    this.payingCount = this.members.filter((m) => !this.isSkipped(m.id)).length;
    const input = this.buildAdvanceInput();
    if (!input.totalAmount || input.totalAmount <= 0) {
      this.preview = null;
      this.previewSlices = [];
      return;
    }
    this.preview = buildSplitPreview(input, this.members);
    this.previewSlices = this.preview.lines.map((line) => ({ memberId: line.memberId, amount: line.amount }));
  }

  submitAdvance(): void {
    this.error = this.advanceSubmitHint;
    if (this.error) return;

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
    this.error = validateRepaymentInput(viewer.id, v.toMemberId, Number(v.amount)) ?? '';
    if (this.error) return;
    const toName = this.auth.getMember(v.toMemberId)?.name ?? '';
    this.submitDialogTitle = COPY_DIALOGS.addRepaymentTitle;
    this.submitDialogDetail = `${formatTransactionDateLabel(v.date)} · 還款給 ${toName} · NT$ ${v.amount}`;
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
    const v = this.transferForm.value;
    this.submitDialogTitle = COPY_DIALOGS.consolidateTitle;
    this.submitDialogDetail = `${formatTransactionDateLabel(v.date)} · ${COPY_RECORD_TYPE.consolidate} · 整合 ${this.selectedSourceIds.length} 筆記錄`;
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
          await this.router.navigateByUrl('/transactions');
          return;
        }
      } else if (this.mode === 'repayment') {
        const viewer = this.auth.currentMember!;
        const v = this.repaymentForm.value;
        err = await this.transactions.createRepayment({
          fromMemberId: viewer.id,
          toMemberId: v.toMemberId,
          amount: Number(v.amount),
          date: v.date,
          note: v.note || null,
        });
      } else {
        const v = this.transferForm.value;
        const result = await this.transactions.createTransfer({
          date: v.date,
          note: v.note || null,
          sourceTransactionIds: [...this.selectedSourceIds],
        });
        err = result.error;
        if (!err && result.transactionId) {
          this.submitDialogOpen = false;
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
    if (this.splitRule === 'equal') {
      return Number(this.advanceForm.value.totalAmount) || 0;
    }
    if (this.customInputMethod === 'direct') {
      return this.members
        .filter((m) => !this.isSkipped(m.id))
        .reduce((sum, m) => sum + (this.manualAmounts[m.id] ?? 0), 0);
    }
    return this.members
      .filter((m) => !this.isSkipped(m.id))
      .reduce((sum, m) => sum + (this.memberSubtotals[m.id] ?? 0), 0);
  }

  private computeChartBillTotal(): number | null {
    if (this.splitRule === 'equal') {
      const total = Number(this.advanceForm.value.totalAmount) || 0;
      return total > 0 ? total : null;
    }
    const bill = Number(this.advanceForm.value.billTotal) || 0;
    return bill > this.effectiveTotal ? bill : null;
  }

  private syncAmountsFromItems(): void {
    const subtotals: Record<string, number> = {};
    const amounts: Record<string, number> = {};
    for (const m of this.members) {
      if (this.splitRule === 'custom' && this.customInputMethod === 'lineItems') {
        const subtotal = (this.memberItems[m.id] ?? []).reduce(
          (sum, item) => sum + item.amount,
          0
        );
        subtotals[m.id] = subtotal;
        amounts[m.id] = this.isSkipped(m.id) ? 0 : subtotal;
      } else if (this.splitRule === 'custom' && this.customInputMethod === 'direct') {
        const amount = this.isSkipped(m.id) ? 0 : (this.manualAmounts[m.id] ?? 0);
        amounts[m.id] = amount;
        subtotals[m.id] = amount;
      } else {
        amounts[m.id] = this.manualAmounts[m.id] ?? 0;
        subtotals[m.id] = amounts[m.id];
      }
    }
    this.memberSubtotals = subtotals;
    if (this.splitRule === 'custom') {
      this.manualAmounts = amounts;
    }
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
    return buildAdvanceInputFromDraft({
      title: v.title ?? '',
      date: v.date ?? todayLocalDate(),
      note: v.note || null,
      splitRule: this.splitRule,
      customInputMethod: this.customInputMethod,
      splitTotal: this.effectiveTotal,
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
    this.mode = 'advance';
    const inferred = inferSplitRuleFromTransaction(tx);
    this.splitRule = inferred.splitRule;
    this.customInputMethod = inferred.customInputMethod;
    this.remainderSeed = tx.id;
    this.skippedMembers = new Set(
      tx.participants.filter((p) => p.amount === 0).map((p) => p.memberId)
    );

    this.advanceForm.patchValue({
      title: tx.title,
      date: tx.date ?? todayLocalDate(),
      totalAmount: this.splitRule === 'equal' ? tx.totalAmount : null,
      billTotal: tx.billTotal ?? null,
      note: tx.note ?? '',
    });

    this.payerRows = getAdvancePayers(tx).map((p) => ({
      memberId: p.memberId,
      amount: String(p.amount),
    }));
    if (this.payerRows.length === 0) {
      this.payerRows = [{ memberId: tx.payerId, amount: String(tx.totalAmount) }];
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
    } else if (this.splitRule === 'custom' && this.customInputMethod === 'direct') {
      const amounts: Record<string, number> = {};
      for (const p of tx.participants) {
        amounts[p.memberId] = p.amount;
      }
      this.manualAmounts = amounts;
    } else {
      const amounts: Record<string, number> = {};
      for (const p of tx.participants) {
        amounts[p.memberId] = p.amount;
      }
      this.manualAmounts = amounts;
    }

    this.initDrafts();
    this.syncAmountsFromItems();
    this.refreshPreview();
  }
}
