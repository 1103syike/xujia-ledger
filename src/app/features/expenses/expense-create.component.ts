import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import {
  CreateExpenseInput,
  SplitMode,
} from '../../core/models';
import { AuthService } from '../../core/services/auth.service';
import { ExpenseService } from '../../core/services/expense.service';
import {
  buildSplitPreview,
  SplitPreview,
  validateCreateInput,
} from '../../core/utils/split-calculator';
import { MemberAvatarComponent } from '../../shared/components/member-avatar.component';
import { MemberPickerComponent } from '../../shared/components/member-picker.component';
import { SplitPieChartComponent } from '../../shared/components/split-pie-chart.component';

@Component({
  selector: 'app-expense-create',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MemberAvatarComponent,
    MemberPickerComponent,
    SplitPieChartComponent,
  ],
  template: `
    <h2 class="mb-4 text-lg font-bold">建立帳款</h2>

    <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-4">
      <div class="card space-y-3">
        <label class="block text-sm font-medium">項目</label>
        <input
          formControlName="title"
          class="w-full rounded-2xl border border-peach/30 bg-cream px-4 py-3 outline-none focus:border-peach"
          placeholder="例如：電影、晚餐"
        />

        <label class="block text-sm font-medium">總金額</label>
        <input
          formControlName="totalAmount"
          type="number"
          inputmode="numeric"
          class="w-full rounded-2xl border border-peach/30 bg-cream px-4 py-3 outline-none focus:border-peach"
          placeholder="0"
        />

        <app-member-picker
          label="代墊者"
          [members]="auth.getAllMembers()"
          [value]="form.value.payerId"
          (valueChange)="setPayer($event)"
        />
      </div>

      <div class="card space-y-3">
        <p class="text-sm font-medium">怎麼分？</p>
        <div class="flex gap-2">
          <button
            type="button"
            class="rounded-2xl px-4 py-2 text-sm"
            [class.bg-mint]="splitMode === 'equal'"
            [class.text-ink]="splitMode === 'equal'"
            [class.bg-cream]="splitMode !== 'equal'"
            (click)="setSplitMode('equal')"
          >
            平分
          </button>
          <button
            type="button"
            class="rounded-2xl px-4 py-2 text-sm"
            [class.bg-lavender]="splitMode === 'itemized'"
            [class.text-ink]="splitMode === 'itemized'"
            [class.bg-cream]="splitMode !== 'itemized'"
            (click)="setSplitMode('itemized')"
          >
            細分
          </button>
        </div>

        <div *ngIf="splitMode === 'itemized'" class="space-y-3">
          <p class="text-xs text-ink/50">五人全列出，不用付請填 0</p>
          <div
            *ngFor="let m of auth.getAllMembers()"
            class="rounded-2xl bg-cream p-3"
            [class.opacity-60]="isZeroAmount(m.id)"
          >
            <div class="flex items-center gap-2">
              <app-member-avatar [member]="m" />
              <span class="flex-1 text-sm">{{ m.name }}</span>
              <input
                type="number"
                inputmode="numeric"
                class="w-24 rounded-xl border border-peach/30 px-2 py-1 text-right"
                [value]="amountDisplay(m.id)"
                (input)="setManualAmount(m.id, $any($event.target).value)"
                placeholder="0"
              />
            </div>
            <input
              class="mt-2 w-full rounded-xl border border-peach/20 bg-white px-3 py-2 text-sm"
              [value]="noteDisplay(m.id)"
              (input)="setSplitNote(m.id, $any($event.target).value)"
              placeholder="小備注（選填）"
            />
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium">
            {{ splitMode === 'equal' ? '備注（選填）' : '大備注（選填）' }}
          </label>
          <textarea
            formControlName="note"
            rows="2"
            class="mt-1 w-full rounded-2xl border border-peach/30 bg-cream px-4 py-3 text-sm outline-none"
            placeholder="想說明什麼都可以～"
          ></textarea>
        </div>
      </div>

      <div *ngIf="preview" class="card">
        <p class="mb-2 text-sm font-medium">分攤比例</p>
        <app-split-pie-chart
          [slices]="previewSlices"
          [totalAmount]="form.value.totalAmount"
        />

        <p class="mb-2 mt-4 text-sm font-medium">預覽明細</p>
        <div
          *ngFor="let line of preview.lines"
          class="flex items-center justify-between py-1 text-sm"
        >
          <span>{{ auth.getMember(line.memberId)?.name }}</span>
          <span [class.opacity-60]="line.amount === 0">
            <ng-container *ngIf="line.amount === 0; else amountLine">不用付</ng-container>
            <ng-template #amountLine>
              NT$ {{ line.amount }}
              <span
                *ngIf="line.isRemainderBearer"
                class="chip ml-1 bg-coral/20 text-xs text-coral"
              >
                零頭 +{{ line.remainderAmount }}
              </span>
            </ng-template>
          </span>
        </div>
        <p class="mt-2 border-t border-peach/20 pt-2 text-sm">
          合計 NT$ {{ preview.total }}
          <span *ngIf="preview.total === form.value.totalAmount" class="text-mint">✓</span>
        </p>
      </div>

      <p *ngIf="error" class="text-center text-sm text-coral">{{ error }}</p>

      <button type="submit" class="btn-primary w-full">建立帳款</button>
    </form>
  `,
})
export class ExpenseCreateComponent implements OnInit {
  form: FormGroup;
  splitMode: SplitMode = 'equal';
  manualAmounts: Record<string, number> = {};
  splitNotes: Record<string, string> = {};
  preview: SplitPreview | null = null;
  error = '';
  remainderSeed = '';
  private itemizedCustomized = false;

  constructor(
    public auth: AuthService,
    private fb: FormBuilder,
    private expenses: ExpenseService,
    private router: Router
  ) {
    this.form = this.fb.group({
      title: ['', Validators.required],
      totalAmount: [null, [Validators.required, Validators.min(1)]],
      payerId: [auth.getAllMembers()[0]?.id ?? ''],
      note: [''],
    });
    this.remainderSeed = crypto.randomUUID?.() ?? String(Date.now());
  }

  get previewSlices() {
    return (
      this.preview?.lines.map((line) => ({
        memberId: line.memberId,
        amount: line.amount,
      })) ?? []
    );
  }

  ngOnInit(): void {
    this.form.valueChanges.subscribe(() => {
      if (this.splitMode === 'itemized' && !this.itemizedCustomized) {
        this.applyEqualItemizedDefaults();
      }
      this.refreshPreview();
    });
    this.refreshPreview();
  }

  setPayer(id: string): void {
    this.form.patchValue({ payerId: id });
    this.syncItemizedDefaults();
    this.refreshPreview();
  }

  setSplitMode(mode: SplitMode): void {
    this.splitMode = mode;
    if (mode === 'equal') {
      this.splitNotes = {};
      this.manualAmounts = {};
      this.itemizedCustomized = false;
    } else {
      this.itemizedCustomized = false;
      this.applyEqualItemizedDefaults();
    }
    this.refreshPreview();
  }

  setManualAmount(id: string, value: string): void {
    this.itemizedCustomized = true;
    const n = Number(value);
    if (value === '' || Number.isNaN(n)) {
      delete this.manualAmounts[id];
    } else {
      this.manualAmounts[id] = Math.max(0, n);
    }
    this.refreshPreview();
  }

  setSplitNote(id: string, value: string): void {
    if (value.trim()) this.splitNotes[id] = value.trim();
    else delete this.splitNotes[id];
  }

  amountDisplay(id: string): string {
    return id in this.manualAmounts ? String(this.manualAmounts[id]) : '';
  }

  noteDisplay(id: string): string {
    return this.splitNotes[id] ?? '';
  }

  isZeroAmount(id: string): boolean {
    return id in this.manualAmounts && this.manualAmounts[id] === 0;
  }

  refreshPreview(): void {
    const input = this.buildInput();
    if (!input.totalAmount || input.totalAmount <= 0) {
      this.preview = null;
      return;
    }
    this.preview = buildSplitPreview(input, this.auth.getAllMembers());
  }

  async submit(): Promise<void> {
    const input = this.buildInput();
    this.error = validateCreateInput(input, this.auth.getAllMembers()) ?? '';
    if (this.error) return;

    const err = await this.expenses.createExpense(input);
    if (err) {
      this.error = err;
      return;
    }
    this.router.navigateByUrl('/expenses');
  }

  private syncItemizedDefaults(): void {
    if (this.splitMode === 'itemized' && !this.itemizedCustomized) {
      this.applyEqualItemizedDefaults();
    }
  }

  /** 細分模式預設帶入平分金額（含零頭規則） */
  private applyEqualItemizedDefaults(): void {
    const total = Number(this.form.value.totalAmount) || 0;
    if (total <= 0) {
      this.manualAmounts = {};
      return;
    }

    const input = this.buildInput();
    const preview = buildSplitPreview(
      { ...input, splitMode: 'equal' },
      this.auth.getAllMembers()
    );

    const amounts: Record<string, number> = {};
    for (const line of preview.lines) {
      amounts[line.memberId] = line.amount;
    }
    this.manualAmounts = amounts;
  }

  private buildInput(): CreateExpenseInput {
    const v = this.form.value;
    return {
      title: v.title ?? '',
      totalAmount: Number(v.totalAmount) || 0,
      payerId: v.payerId,
      participantScope: 'all',
      participantIds: this.auth.members.map((m) => m.id),
      splitMode: this.splitMode,
      note: v.note || null,
      manualAmounts: { ...this.manualAmounts },
      splitNotes: { ...this.splitNotes },
      remainderSeed: this.remainderSeed,
    };
  }
}
