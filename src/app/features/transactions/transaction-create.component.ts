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
import { Subscription, combineLatest, filter, startWith, take } from 'rxjs';
import {
  CreateAdvanceInput,
  DisplayMember,
  LineItem,
  SplitMode,
  Transaction,
} from '../../core/models';
import { AuthService } from '../../core/services/auth.service';
import { TransactionService } from '../../core/services/transaction.service';
import {
  buildSplitPreview,
  calculateEqualSplitAmong,
  SplitPreview,
  validateCreateInput,
  validateRepaymentInput,
} from '../../core/utils/split-calculator';
import { amountViewerOwesOther } from '../../core/utils/ledger-calculator';
import { activeTransactions, formatTransactionDateLabel, todayLocalDate } from '../../core/utils/transaction-date';
import { MemberAvatarComponent } from '../../shared/components/member-avatar.component';
import { MemberPickerComponent } from '../../shared/components/member-picker.component';
import { DateFieldComponent } from '../../shared/components/date-field.component';
import { SplitPieChartComponent } from '../../shared/components/split-pie-chart.component';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog.component';
import { KaomojiDecoComponent } from '../../shared/components/kaomoji-deco.component';

type CreateMode = 'advance' | 'repayment';

interface MemberDraft {
  note: string;
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
    MemberPickerComponent,
    DateFieldComponent,
    SplitPieChartComponent,
    ConfirmDialogComponent,
    KaomojiDecoComponent,
  ],
  template: `
    <div class="page">
      <a routerLink="/transactions" class="back-link">← 返回</a>

      <div class="page-title-bar">
        <h2 class="page-title">新增交易</h2>
      </div>

      <div class="card-stack mb-4">
        <p class="card-title">交易類型</p>
        <div class="flex gap-2">
          <button type="button" class="mode-chip flex-1" [class.bg-mint]="mode === 'advance'" [class.text-ink]="mode === 'advance'" [class.bg-cream]="mode !== 'advance'" (click)="setMode('advance')">代墊</button>
          <button type="button" class="mode-chip flex-1" [class.bg-lavender]="mode === 'repayment'" [class.text-ink]="mode === 'repayment'" [class.bg-cream]="mode !== 'repayment'" (click)="setMode('repayment')">還款</button>
        </div>
      </div>

      <form *ngIf="mode === 'advance'" [formGroup]="advanceForm" (ngSubmit)="submitAdvance()" class="stack-lg pb-28">
        <div class="card-stack">
          <div class="field-group">
            <label class="field-label">項目</label>
            <input formControlName="title" class="input" placeholder="請輸入項目名稱，例：飲料、晚餐" />
          </div>
          <app-date-field formControlName="date" />
          <app-member-picker label="代墊者" [members]="members" [value]="advanceForm.value.payerId" (valueChange)="setPayer($event)" />
        </div>

        <div class="card-stack">
          <p class="card-title">分攤方式</p>
          <div class="flex gap-2">
            <button type="button" class="mode-chip" [class.bg-mint]="splitMode === 'equal'" [class.text-ink]="splitMode === 'equal'" [class.bg-cream]="splitMode !== 'equal'" (click)="setSplitMode('equal')">平分</button>
            <button type="button" class="mode-chip" [class.bg-lavender]="splitMode === 'itemized'" [class.text-ink]="splitMode === 'itemized'" [class.bg-cream]="splitMode !== 'itemized'" (click)="setSplitMode('itemized')">細分</button>
          </div>

          <ng-container *ngIf="splitMode === 'equal'">
            <div class="field-group">
              <label class="field-label">總金額</label>
              <input formControlName="totalAmount" type="number" inputmode="numeric" class="input input-amount" placeholder="0" />
            </div>
            <p class="helper-text">請標記免分攤的成員，再點選快速平分</p>
            <div class="flex flex-wrap gap-2">
              <button *ngFor="let m of members" type="button" class="chip inline-flex items-center gap-1.5 transition" [ngClass]="isSkipped(m.id) ? 'bg-lavender text-ink line-through opacity-70' : 'bg-cream text-ink'" (click)="toggleSkip(m.id)">
                <app-member-avatar [member]="m" size="xs" /><span>{{ m.name }}</span>
              </button>
            </div>
            <button type="button" class="btn-secondary btn-sm w-full" [disabled]="payingCount === 0 || effectiveTotal <= 0" (click)="applyQuickEqual()">快速平分（{{ payingCount }} 人）</button>
          </ng-container>

          <ng-container *ngIf="splitMode === 'itemized'">
            <p class="helper-text">請於各成員下方新增消費項目，全員皆可查看明細</p>
            <div class="field-group">
              <label class="field-label">帳單總額（選填）</label>
              <input formControlName="billTotal" type="number" inputmode="numeric" class="input input-amount" placeholder="若高於已分攤金額，圓餅圖將顯示未分配餘額" />
            </div>
            <div class="stack-sm">
              <div *ngFor="let m of members" class="inset-panel" [class.opacity-50]="isSkipped(m.id)">
                <div class="mb-2 flex items-center justify-between gap-2">
                  <div class="flex min-w-0 items-center gap-2">
                    <app-member-avatar [member]="m" size="sm" />
                    <span class="item-title truncate">{{ m.name }}</span>
                  </div>
                  <div class="flex shrink-0 items-center gap-2">
                    <button type="button" class="chip bg-white" [class.bg-lavender]="isSkipped(m.id)" (click)="toggleSkip(m.id)">{{ isSkipped(m.id) ? '取消免分攤' : '標記免分攤' }}</button>
                    <span *ngIf="!isSkipped(m.id)" class="amount-highlight text-sm">NT$ {{ memberSubtotals[m.id] || '-' }}</span>
                  </div>
                </div>
                <ng-container *ngIf="!isSkipped(m.id)">
                  <div *ngFor="let item of memberItems[m.id] ?? []; let i = index" class="mb-1 flex items-center justify-between gap-2 body-text">
                    <span class="min-w-0 flex-1 truncate">{{ item.note }}</span>
                    <span class="shrink-0">NT$ {{ item.amount }}</span>
                    <button type="button" class="caption-text shrink-0 text-coral" (click)="removeMemberItem(m.id, i)">移除</button>
                  </div>
                  <div class="mt-2 flex gap-2">
                    <input class="input-sm min-w-0 flex-1" [(ngModel)]="memberDrafts[m.id].note" [ngModelOptions]="{ standalone: true }" placeholder="項目備註" />
                    <input type="number" inputmode="numeric" class="input-sm input-amount w-20 shrink-0 text-right" [(ngModel)]="memberDrafts[m.id].amount" [ngModelOptions]="{ standalone: true }" placeholder="金額" (keydown.enter)="addMemberItem(m.id); $event.preventDefault()" />
                    <button type="button" class="btn-primary btn-sm shrink-0 px-3" (click)="addMemberItem(m.id)">＋</button>
                  </div>
                </ng-container>
                <p *ngIf="isSkipped(m.id)" class="caption-text">免分攤</p>
              </div>
            </div>
            <p class="amount-md text-right">總計 NT$ {{ effectiveTotal }}</p>
          </ng-container>

          <div class="field-group">
            <label class="field-label">備註（選填）</label>
            <textarea formControlName="note" rows="2" class="textarea" placeholder="如需補充說明，請在此填寫"></textarea>
          </div>
        </div>

        <div *ngIf="preview" class="card-stack">
          <p class="card-title">分攤比例</p>
          <app-split-pie-chart [slices]="previewSlices" [totalAmount]="effectiveTotal" [billTotal]="chartBillTotal" />
        </div>

        <p *ngIf="error" class="body-text text-center text-coral">{{ error }}</p>
        <button type="submit" class="btn-primary w-full">建立代墊</button>
      </form>

      <form *ngIf="mode === 'repayment'" [formGroup]="repaymentForm" (ngSubmit)="submitRepayment()" class="stack-lg pb-28">
        <div class="card-stack">
          <app-date-field formControlName="date" />

          <ng-container *ngIf="hasRepaymentCreditors; else noRepaymentCreditors">
            <app-member-picker
              label="還款對象"
              [members]="repaymentTargets"
              [oweAmounts]="repaymentOweAmounts"
              [value]="repaymentForm.value.toMemberId"
              (valueChange)="setRepaymentTarget($event)"
            />
            <div class="field-group">
              <label class="field-label">還款金額</label>
              <div class="flex gap-2">
                <input formControlName="amount" type="number" inputmode="numeric" class="input input-amount flex-1" placeholder="0" />
                <button type="button" class="btn-secondary btn-sm shrink-0" [disabled]="!repaymentBalance || repaymentBalance <= 0" (click)="fillFullRepayment()">全部還清</button>
              </div>
            </div>
            <div class="field-group">
              <label class="field-label">備註（選填）</label>
              <textarea formControlName="note" rows="2" class="textarea" placeholder="如需補充說明，請在此填寫"></textarea>
            </div>
          </ng-container>

          <ng-template #noRepaymentCreditors>
            <div class="empty-state py-6">
              <app-kaomoji-deco mood="celebrate" seed="no-repay" [salt]="noRepaySalt" />
              <p class="empty-state__text">沒有欠錢的對象</p>
              <p class="helper-text mt-1">目前不需要還款，帳本清清白白 (ﾉ◕ヮ◕)ﾉ*:･ﾟ✧</p>
              <button type="button" class="caption-text mt-2 rounded-full bg-cream px-3 py-1 active:scale-95" (click)="noRepaySalt = noRepaySalt + 1">🔄 換顏文字</button>
            </div>
          </ng-template>
        </div>
        <p *ngIf="error" class="body-text text-center text-coral">{{ error }}</p>
        <button type="submit" class="btn-primary w-full" [disabled]="!hasRepaymentCreditors">建立還款</button>
      </form>

      <app-confirm-dialog [open]="submitDialogOpen" [title]="mode === 'advance' ? '建立代墊' : '建立還款'" [detail]="submitDialogDetail" [message]="submitDialogMessage" confirmLabel="確認建立" cancelLabel="取消" [busy]="submitBusy" (confirmed)="confirmSubmit()" (cancelled)="closeSubmitDialog()" />
    </div>
  `,
})
export class TransactionCreateComponent implements OnInit, OnDestroy {
  mode: CreateMode = 'advance';
  advanceForm: FormGroup;
  repaymentForm: FormGroup;
  members: DisplayMember[] = [];
  repaymentTargets: DisplayMember[] = [];
  repaymentOweAmounts: Record<string, number> = {};
  hasRepaymentCreditors = false;
  noRepaySalt = 0;
  splitMode: SplitMode = 'itemized';
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
  submitDialogDetail = '';
  submitDialogMessage = '';
  private skippedMembers = new Set<string>();
  private subs: Subscription[] = [];
  private activeTx: Transaction[] = [];
  private initialRepaymentToId: string | null = null;

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
      payerId: [defaultPayer],
      note: [''],
    });
    this.repaymentForm = this.fb.group({
      date: [todayLocalDate(), Validators.required],
      toMemberId: [''],
      amount: [null, [Validators.min(1)]],
      note: [''],
    });
    this.remainderSeed = crypto.randomUUID?.() ?? String(Date.now());
    this.reloadMembers();
  }

  ngOnInit(): void {
    if (this.route.snapshot.queryParamMap.get('type') === 'repayment') {
      this.mode = 'repayment';
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
          this.advanceForm.patchValue({ payerId: member.id });
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

  setPayer(id: string): void {
    this.advanceForm.patchValue({ payerId: id });
    this.refreshPreview();
  }

  setSplitMode(mode: SplitMode): void {
    this.splitMode = mode;
    if (mode === 'equal') {
      this.memberItems = {};
      this.initDrafts();
    } else {
      this.manualAmounts = {};
    }
    this.refreshPreview();
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
    }
    this.syncAmountsFromItems();
    this.refreshPreview();
  }

  applyQuickEqual(): void {
    const total = this.effectiveTotal;
    if (total <= 0) {
      this.error = '請先輸入總金額';
      return;
    }
    const payingIds = this.members.filter((m) => !this.skippedMembers.has(m.id)).map((m) => m.id);
    if (payingIds.length === 0) {
      this.error = '至少需要一位成員參與分攤';
      return;
    }
    this.error = '';
    calculateEqualSplitAmong(total, payingIds, this.advanceForm.value.payerId, this.remainderSeed);
    this.refreshPreview();
  }

  refreshPreview(): void {
    this.syncAmountsFromItems();
    this.effectiveTotal = this.computeEffectiveTotal();
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
    this.error = validateCreateInput(this.buildAdvanceInput(), this.members) ?? '';
    if (this.error) return;
    const title = (this.advanceForm.value.title ?? '').trim();
    const date = this.advanceForm.value.date ?? '';
    this.submitDialogDetail = `${formatTransactionDateLabel(date)} · ${title} · NT$ ${this.effectiveTotal}`;
    this.submitDialogMessage = '確定要建立此筆代墊嗎？建立後全員皆可查看。';
    this.submitDialogOpen = true;
  }

  submitRepayment(): void {
    if (!this.hasRepaymentCreditors) {
      this.error = '目前沒有可還款的對象';
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
    this.submitDialogDetail = `${formatTransactionDateLabel(v.date)} · 還款給 ${toName} · NT$ ${v.amount}`;
    this.submitDialogMessage = '確定要建立此筆還款嗎？建立後結算會立即更新。';
    this.submitDialogOpen = true;
  }

  closeSubmitDialog(): void {
    if (this.submitBusy) return;
    this.submitDialogOpen = false;
  }

  async confirmSubmit(): Promise<void> {
    if (this.submitBusy) return;
    this.submitBusy = true;
    let err: string | null = null;
    if (this.mode === 'advance') {
      err = await this.transactions.createAdvance(this.buildAdvanceInput());
    } else {
      const viewer = this.auth.currentMember!;
      const v = this.repaymentForm.value;
      err = await this.transactions.createRepayment({
        fromMemberId: viewer.id,
        toMemberId: v.toMemberId,
        amount: Number(v.amount),
        date: v.date,
        note: v.note || null,
      });
    }
    this.submitBusy = false;
    if (err) {
      this.error = err;
      this.closeSubmitDialog();
      return;
    }
    this.submitDialogOpen = false;
    this.router.navigateByUrl('/transactions');
  }

  private initDrafts(): void {
    const next: Record<string, MemberDraft> = {};
    for (const m of this.members) {
      next[m.id] = this.memberDrafts[m.id] ?? { note: '', amount: '' };
    }
    this.memberDrafts = next;
  }

  private computeEffectiveTotal(): number {
    if (this.splitMode === 'itemized') {
      return this.members.filter((m) => !this.isSkipped(m.id)).reduce((sum, m) => sum + (this.memberSubtotals[m.id] ?? 0), 0);
    }
    return Number(this.advanceForm.value.totalAmount) || 0;
  }

  private computeChartBillTotal(): number | null {
    if (this.splitMode === 'equal') {
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
      const subtotal = (this.memberItems[m.id] ?? []).reduce((sum, item) => sum + item.amount, 0);
      subtotals[m.id] = subtotal;
      amounts[m.id] = this.splitMode === 'itemized' ? (this.isSkipped(m.id) ? 0 : subtotal) : (this.manualAmounts[m.id] ?? 0);
    }
    this.memberSubtotals = subtotals;
    if (this.splitMode === 'itemized') {
      this.manualAmounts = amounts;
    }
  }

  private buildAdvanceInput(): CreateAdvanceInput {
    const v = this.advanceForm.value;
    const splitItems = this.pruneSplitItems();
    return {
      title: v.title ?? '',
      date: v.date ?? todayLocalDate(),
      totalAmount: this.effectiveTotal,
      billTotal: this.chartBillTotal,
      payerId: v.payerId,
      participantScope: 'all',
      participantIds: this.members.map((m) => m.id),
      splitMode: this.splitMode,
      note: v.note || null,
      splitItems: Object.keys(splitItems).length > 0 ? splitItems : undefined,
      manualAmounts: { ...this.manualAmounts },
      excludedMemberIds: [...this.skippedMembers],
      remainderSeed: this.remainderSeed,
    };
  }

  private pruneSplitItems(): Record<string, LineItem[]> {
    const result: Record<string, LineItem[]> = {};
    for (const [id, items] of Object.entries(this.memberItems)) {
      if (items.length > 0) result[id] = items;
    }
    return result;
  }
}
