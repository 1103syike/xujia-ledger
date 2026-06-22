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
import { Subscription, filter, map, take } from 'rxjs';
import {
  CreateExpenseInput,
  DisplayMember,
  Expense,
  ExpenseLineItem,
  SplitMode,
} from '../../core/models';
import { AuthService } from '../../core/services/auth.service';
import { ExpenseService } from '../../core/services/expense.service';
import {
  buildSplitPreview,
  calculateEqualSplitAmong,
  SplitPreview,
  validateCreateInput,
} from '../../core/utils/split-calculator';
import { MemberAvatarComponent } from '../../shared/components/member-avatar.component';
import { MemberPickerComponent } from '../../shared/components/member-picker.component';
import { SplitPieChartComponent } from '../../shared/components/split-pie-chart.component';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog.component';
import { todayLocalDate, formatExpenseDateLabel } from '../../core/utils/expense-date';

interface MemberDraft {
  note: string;
  amount: string;
}

@Component({
  selector: 'app-expense-create',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    MemberAvatarComponent,
    MemberPickerComponent,
    SplitPieChartComponent,
    ConfirmDialogComponent,
  ],
  template: `
    <div class="page">
      <a
        *ngIf="isEditMode && expenseId"
        [routerLink]="['/expenses', expenseId]"
        class="back-link"
      >
        ← 返回帳款詳情
      </a>

      <div class="page-title-bar">
        <h2 class="page-title">{{ isEditMode ? '編輯帳款' : '建立帳款' }}</h2>
      </div>

      <form [formGroup]="form" (ngSubmit)="submit()" class="stack-lg pb-28">
        <div class="card-stack">
          <div class="field-group">
            <label class="field-label">項目</label>
            <input
              formControlName="title"
              class="input"
              placeholder="請輸入項目名稱，例：飲料、晚餐"
            />
          </div>

          <div class="field-group">
            <label class="field-label">日期</label>
            <input
              formControlName="date"
              type="date"
              class="input"
            />
          </div>

          <app-member-picker
            label="代墊者"
            [members]="members"
            [value]="form.value.payerId"
            (valueChange)="setPayer($event)"
          />
        </div>

        <div class="card-stack">
          <p class="card-title">分攤方式</p>
          <div class="flex gap-2">
            <button
              type="button"
              class="mode-chip"
              [class.bg-mint]="splitMode === 'equal'"
              [class.text-ink]="splitMode === 'equal'"
              [class.bg-cream]="splitMode !== 'equal'"
              (click)="setSplitMode('equal')"
            >
              平分
            </button>
            <button
              type="button"
              class="mode-chip"
              [class.bg-lavender]="splitMode === 'itemized'"
              [class.text-ink]="splitMode === 'itemized'"
              [class.bg-cream]="splitMode !== 'itemized'"
              (click)="setSplitMode('itemized')"
            >
              細分
            </button>
          </div>

          <ng-container *ngIf="splitMode === 'equal'">
            <div class="field-group">
              <label class="field-label">總金額</label>
              <input
                formControlName="totalAmount"
                type="number"
                inputmode="numeric"
                class="input input-amount"
                placeholder="0"
              />
            </div>

            <p class="helper-text">請標記免分攤的成員，再點選快速平分</p>
            <div class="flex flex-wrap gap-2">
              <button
                *ngFor="let m of members"
                type="button"
                class="chip inline-flex items-center gap-1.5 transition"
                [ngClass]="
                  isSkipped(m.id)
                    ? 'bg-lavender text-ink line-through opacity-70'
                    : 'bg-cream text-ink'
                "
                (click)="toggleSkip(m.id)"
              >
                <app-member-avatar [member]="m" size="xs" />
                <span>{{ m.name }}</span>
              </button>
            </div>

            <button
              type="button"
              class="btn-secondary btn-sm w-full"
              [disabled]="payingCount === 0 || effectiveTotal <= 0"
              (click)="applyQuickEqual()"
            >
              快速平分（{{ payingCount }} 人）
            </button>
          </ng-container>

          <ng-container *ngIf="splitMode === 'itemized'">
            <p class="helper-text">
              請於各成員下方新增消費項目，全員皆可查看明細
            </p>

            <div class="field-group">
              <label class="field-label">帳單總額（選填）</label>
              <input
                formControlName="billTotal"
                type="number"
                inputmode="numeric"
                class="input input-amount"
                placeholder="若高於已分攤金額，圓餅圖將顯示未分配餘額"
              />
            </div>

            <div class="stack-sm">
              <div
                *ngFor="let m of members"
                class="inset-panel"
                [class.opacity-50]="isSkipped(m.id)"
              >
              <div class="mb-2 flex items-center justify-between gap-2">
                <div class="flex min-w-0 items-center gap-2">
                  <app-member-avatar [member]="m" size="sm" />
                  <span class="item-title truncate">{{ m.name }}</span>
                </div>
                <div class="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    class="chip bg-white"
                    [class.bg-lavender]="isSkipped(m.id)"
                    (click)="toggleSkip(m.id)"
                  >
                    {{ isSkipped(m.id) ? '取消免分攤' : '標記免分攤' }}
                  </button>
                  <span *ngIf="!isSkipped(m.id)" class="amount-highlight text-sm">
                    NT$ {{ memberSubtotals[m.id] || '-' }}
                  </span>
                </div>
              </div>

              <ng-container *ngIf="!isSkipped(m.id)">
                <div
                  *ngFor="let item of memberItems[m.id] ?? []; let i = index"
                  class="mb-1 flex items-center justify-between gap-2 body-text"
                >
                  <span class="min-w-0 flex-1 truncate">{{ item.note }}</span>
                  <span class="shrink-0">NT$ {{ item.amount }}</span>
                  <button
                    type="button"
                    class="caption-text shrink-0 text-coral"
                    (click)="removeMemberItem(m.id, i)"
                  >
                    移除
                  </button>
                </div>

                <div class="mt-2 flex gap-2">
                  <input
                    class="input-sm min-w-0 flex-1"
                    [(ngModel)]="memberDrafts[m.id].note"
                    [ngModelOptions]="{ standalone: true }"
                    placeholder="項目備註"
                  />
                  <input
                    type="number"
                    inputmode="numeric"
                    class="input-sm input-amount w-20 shrink-0 text-right"
                    [(ngModel)]="memberDrafts[m.id].amount"
                    [ngModelOptions]="{ standalone: true }"
                    placeholder="金額"
                    (keydown.enter)="addMemberItem(m.id); $event.preventDefault()"
                  />
                  <button
                    type="button"
                    class="btn-primary btn-sm shrink-0 px-3"
                    (click)="addMemberItem(m.id)"
                  >
                    ＋
                  </button>
                </div>
              </ng-container>

              <p *ngIf="isSkipped(m.id)" class="caption-text">免分攤</p>
              </div>
            </div>

            <p class="amount-md text-right">
              總計 NT$ {{ effectiveTotal }}
            </p>
          </ng-container>

          <div class="field-group">
            <label class="field-label">備註（選填）</label>
            <textarea
              formControlName="note"
              rows="2"
              class="textarea"
              placeholder="如需補充說明，請在此填寫"
            ></textarea>
          </div>
        </div>

        <div *ngIf="preview" class="card-stack">
          <p class="card-title">分攤比例</p>
          <app-split-pie-chart
            [slices]="previewSlices"
            [totalAmount]="effectiveTotal"
            [billTotal]="chartBillTotal"
          />

          <p class="card-title mt-1">分攤明細預覽</p>
          <div class="stack-sm">
            <div
              *ngFor="let line of preview.lines"
              class="border-b border-peach/10 py-2 body-text last:border-0"
            >
            <div class="flex items-center justify-between gap-2">
              <span>{{ auth.getMember(line.memberId)?.name }}</span>
              <span [class.opacity-60]="line.amount === 0">
                <ng-container *ngIf="line.amount === 0; else amountLine">免分攤</ng-container>
                <ng-template #amountLine>
                  NT$ {{ line.amount }}
                  <span
                    *ngIf="line.isRemainderBearer"
                    class="chip ml-1 bg-coral/20 text-coral"
                  >
                    零頭 +{{ line.remainderAmount }}
                  </span>
                </ng-template>
              </span>
            </div>
            <div
              *ngFor="let item of memberItems[line.memberId] ?? []"
              class="caption-text mt-1 flex justify-between pl-2"
            >
              <span>{{ item.note }}</span>
              <span>NT$ {{ item.amount }}</span>
            </div>
          </div>
          </div>
          <p class="body-text border-t border-peach/20 pt-2">
            合計 NT$ {{ preview.total }}
          </p>
        </div>

        <p *ngIf="error" class="body-text text-center text-coral">{{ error }}</p>

        <button type="submit" class="btn-primary w-full">
          {{ isEditMode ? '儲存變更' : '建立帳款' }}
        </button>
      </form>

      <app-confirm-dialog
        [open]="submitDialogOpen"
        [title]="isEditMode ? '儲存帳款變更' : '建立帳款'"
        [detail]="submitDialogDetail"
        [message]="submitDialogMessage"
        [confirmLabel]="isEditMode ? '確認儲存' : '確認建立'"
        cancelLabel="取消"
        [busy]="submitBusy"
        (confirmed)="confirmSubmit()"
        (cancelled)="closeSubmitDialog()"
      />
    </div>
  `,
})
export class ExpenseCreateComponent implements OnInit, OnDestroy {
  form: FormGroup;
  members: DisplayMember[] = [];
  splitMode: SplitMode = 'itemized';
  memberItems: Record<string, ExpenseLineItem[]> = {};
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
  isEditMode = false;
  expenseId: string | null = null;
  submitDialogOpen = false;
  submitBusy = false;
  submitDialogDetail = '';
  submitDialogMessage = '';
  private skippedMembers = new Set<string>();
  private expenseHydrated = false;
  private subs: Subscription[] = [];

  constructor(
    public auth: AuthService,
    private fb: FormBuilder,
    private expenses: ExpenseService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.form = this.fb.group({
      title: ['', Validators.required],
      date: [todayLocalDate(), Validators.required],
      totalAmount: [null, [Validators.min(1)]],
      billTotal: [null, [Validators.min(1)]],
      payerId: [this.members[0]?.id ?? auth.getAllMembers()[0]?.id ?? ''],
      note: [''],
    });
    this.remainderSeed = crypto.randomUUID?.() ?? String(Date.now());
    this.reloadMembers();
  }

  ngOnInit(): void {
    this.isEditMode = !!this.route.snapshot.data['edit'];
    this.expenseId = this.route.snapshot.paramMap.get('id');

    if (this.isEditMode && this.expenseId) {
      this.tryLoadExpense(this.expenseId);
    }

    this.subs.push(
      this.form.valueChanges.subscribe(() => this.refreshPreview())
    );
    if (!this.isEditMode) {
      this.refreshPreview();
    }
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
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
    this.memberItems = {
      ...this.memberItems,
      [memberId]: [...(this.memberItems[memberId] ?? []), { note, amount }],
    };
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
    this.form.patchValue({ payerId: id });
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

    const payingIds = this.members
      .filter((m) => !this.skippedMembers.has(m.id))
      .map((m) => m.id);

    if (payingIds.length === 0) {
      this.error = '至少需要一位成員參與分攤';
      return;
    }

    this.error = '';
    calculateEqualSplitAmong(
      total,
      payingIds,
      this.form.value.payerId,
      this.remainderSeed
    );
    this.refreshPreview();
  }

  refreshPreview(): void {
    this.syncAmountsFromItems();
    this.effectiveTotal = this.computeEffectiveTotal();
    this.chartBillTotal = this.computeChartBillTotal();
    this.payingCount = this.members.filter((m) => !this.isSkipped(m.id)).length;

    const input = this.buildInput();
    if (!input.totalAmount || input.totalAmount <= 0) {
      this.preview = null;
      this.previewSlices = [];
      return;
    }
    this.preview = buildSplitPreview(input, this.members);
    this.previewSlices = this.preview.lines.map((line) => ({
      memberId: line.memberId,
      amount: line.amount,
    }));
  }

  submit(): void {
    const input = this.buildInput();
    this.error = validateCreateInput(input, this.members) ?? '';
    if (this.error) return;

    const title = (this.form.value.title ?? '').trim();
    const date = this.form.value.date ?? '';
    this.submitDialogDetail = `${formatExpenseDateLabel(date)} · ${title} · NT$ ${this.effectiveTotal}`;
    this.submitDialogMessage = this.isEditMode
      ? '確定要儲存變更嗎？若分攤金額有調整，相關付款狀態可能會重設。'
      : '確定要建立此筆帳款嗎？建立後全員皆可查看。';
    this.submitDialogOpen = true;
  }

  closeSubmitDialog(): void {
    if (this.submitBusy) return;
    this.submitDialogOpen = false;
  }

  async confirmSubmit(): Promise<void> {
    if (this.submitBusy) return;

    const input = this.buildInput();
    this.error = validateCreateInput(input, this.members) ?? '';
    if (this.error) {
      this.closeSubmitDialog();
      return;
    }

    this.submitBusy = true;
    const err =
      this.isEditMode && this.expenseId
        ? await this.expenses.updateExpense(this.expenseId, input)
        : await this.expenses.createExpense(input);
    this.submitBusy = false;

    if (err) {
      this.error = err;
      this.closeSubmitDialog();
      return;
    }

    this.submitDialogOpen = false;
    this.router.navigateByUrl(
      this.isEditMode && this.expenseId
        ? `/expenses/${this.expenseId}`
        : '/expenses'
    );
  }

  private tryLoadExpense(id: string): void {
    const existing = this.expenses.getExpense(id);
    if (existing) {
      this.applyExpense(existing);
      return;
    }

    this.subs.push(
      this.expenses.expenses$
        .pipe(
          map((list) => list.find((e) => e.id === id)),
          filter((e): e is Expense => !!e),
          take(1)
        )
        .subscribe((expense) => this.applyExpense(expense))
    );
  }

  private applyExpense(expense: Expense): void {
    if (this.expenseHydrated) return;
    if (expense.status !== 'open') {
      this.router.navigateByUrl('/expenses');
      return;
    }

    this.expenseHydrated = true;
    this.splitMode = expense.splitMode;
    this.remainderSeed = expense.id;
    this.skippedMembers = new Set(
      expense.splits.filter((s) => s.amount === 0).map((s) => s.memberId)
    );

    this.form.patchValue({
      title: expense.title,
      date: expense.date ?? todayLocalDate(),
      totalAmount:
        expense.splitMode === 'equal' ? expense.totalAmount : null,
      billTotal: expense.billTotal ?? null,
      payerId: expense.payerId,
      note: expense.note ?? '',
    });

    if (expense.splitMode === 'itemized') {
      const items: Record<string, ExpenseLineItem[]> = {};
      for (const split of expense.splits) {
        if (split.items?.length) {
          items[split.memberId] = split.items.map((item) => ({ ...item }));
        }
      }
      this.memberItems = items;
    }

    this.initDrafts();
    this.syncAmountsFromItems();
    this.refreshPreview();
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
      return this.members
        .filter((m) => !this.isSkipped(m.id))
        .reduce((sum, m) => sum + (this.memberSubtotals[m.id] ?? 0), 0);
    }
    return Number(this.form.value.totalAmount) || 0;
  }

  private computeChartBillTotal(): number | null {
    if (this.splitMode === 'equal') {
      const total = Number(this.form.value.totalAmount) || 0;
      return total > 0 ? total : null;
    }
    const bill = Number(this.form.value.billTotal) || 0;
    return bill > this.effectiveTotal ? bill : null;
  }

  private syncAmountsFromItems(): void {
    const subtotals: Record<string, number> = {};
    const amounts: Record<string, number> = {};

    for (const m of this.members) {
      const subtotal = (this.memberItems[m.id] ?? []).reduce(
        (sum, item) => sum + item.amount,
        0
      );
      subtotals[m.id] = subtotal;
      amounts[m.id] =
        this.splitMode === 'itemized'
          ? this.isSkipped(m.id)
            ? 0
            : subtotal
          : (this.manualAmounts[m.id] ?? 0);
    }

    this.memberSubtotals = subtotals;
    if (this.splitMode === 'itemized') {
      this.manualAmounts = amounts;
    }
  }

  private buildInput(): CreateExpenseInput {
    const v = this.form.value;
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

  private pruneSplitItems(): Record<string, ExpenseLineItem[]> {
    const result: Record<string, ExpenseLineItem[]> = {};
    for (const [id, items] of Object.entries(this.memberItems)) {
      if (items.length > 0) {
        result[id] = items;
      }
    }
    return result;
  }
}
