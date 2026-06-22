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
  ParticipantScope,
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

@Component({
  selector: 'app-expense-create',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MemberAvatarComponent],
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

        <label class="block text-sm font-medium">代墊者</label>
        <select
          formControlName="payerId"
          class="w-full rounded-2xl border border-peach/30 bg-cream px-4 py-3"
        >
          <option *ngFor="let m of auth.members" [value]="m.id">
            {{ m.emoji }} {{ m.name }}
          </option>
        </select>
      </div>

      <div class="card space-y-3">
        <p class="text-sm font-medium">誰要分攤？</p>
        <div class="flex gap-2">
          <button
            type="button"
            class="rounded-2xl px-4 py-2 text-sm"
            [class.bg-peach]="participantScope === 'all'"
            [class.text-white]="participantScope === 'all'"
            [class.bg-cream]="participantScope !== 'all'"
            (click)="setScope('all')"
          >
            全部人
          </button>
          <button
            type="button"
            class="rounded-2xl px-4 py-2 text-sm"
            [class.bg-peach]="participantScope === 'specific'"
            [class.text-white]="participantScope === 'specific'"
            [class.bg-cream]="participantScope !== 'specific'"
            (click)="setScope('specific')"
          >
            特定人
          </button>
        </div>

        <div *ngIf="participantScope === 'specific'" class="space-y-2">
          <label
            *ngFor="let m of auth.members"
            class="flex items-center gap-3 rounded-2xl bg-cream p-3"
          >
            <input
              type="checkbox"
              [checked]="selectedIds.has(m.id)"
              (change)="toggleMember(m.id, $any($event.target).checked)"
            />
            <app-member-avatar [member]="m" />
            <span>{{ m.name }}</span>
          </label>
        </div>
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
          <div
            *ngFor="let m of activeMembers"
            class="rounded-2xl bg-cream p-3"
          >
            <div class="flex items-center gap-2">
              <app-member-avatar [member]="m" />
              <span class="flex-1 text-sm">{{ m.name }}</span>
              <input
                type="number"
                inputmode="numeric"
                class="w-24 rounded-xl border border-peach/30 px-2 py-1 text-right"
                [value]="manualAmounts[m.id] ?? ''"
                (input)="setManualAmount(m.id, $any($event.target).value)"
                placeholder="0"
              />
            </div>
            <input
              class="mt-2 w-full rounded-xl border border-peach/20 bg-white px-3 py-2 text-sm"
              [value]="splitNotes[m.id] ?? ''"
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
        <p class="mb-2 text-sm font-medium">預覽分攤</p>
        <div
          *ngFor="let line of preview.lines"
          class="flex items-center justify-between py-1 text-sm"
        >
          <span>{{ auth.getMember(line.memberId)?.name }}</span>
          <span>
            NT$ {{ line.amount }}
            <span
              *ngIf="line.isRemainderBearer"
              class="chip ml-1 bg-coral/20 text-xs text-coral"
            >
              零頭 +{{ line.remainderAmount }}
            </span>
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
  participantScope: ParticipantScope = 'all';
  splitMode: SplitMode = 'equal';
  selectedIds = new Set<string>();
  manualAmounts: Record<string, number> = {};
  splitNotes: Record<string, string> = {};
  preview: SplitPreview | null = null;
  error = '';
  remainderSeed = '';

  constructor(
    public auth: AuthService,
    private fb: FormBuilder,
    private expenses: ExpenseService,
    private router: Router
  ) {
    this.form = this.fb.group({
      title: ['', Validators.required],
      totalAmount: [null, [Validators.required, Validators.min(1)]],
      payerId: [auth.members[0]?.id ?? ''],
      note: [''],
    });
    this.remainderSeed = crypto.randomUUID?.() ?? String(Date.now());
  }

  ngOnInit(): void {
    this.auth.members.forEach((m) => this.selectedIds.add(m.id));
    this.form.valueChanges.subscribe(() => this.refreshPreview());
    this.refreshPreview();
  }

  get activeMembers() {
    return this.participantScope === 'all'
      ? this.auth.members
      : this.auth.members.filter((m) => this.selectedIds.has(m.id));
  }

  setScope(scope: ParticipantScope): void {
    this.participantScope = scope;
    if (scope === 'all') {
      this.auth.members.forEach((m) => this.selectedIds.add(m.id));
    } else {
      const payerId = this.form.value.payerId;
      this.selectedIds.clear();
      this.auth.members.forEach((m) => this.selectedIds.add(m.id));
      if (payerId) this.selectedIds.add(payerId);
    }
    this.refreshPreview();
  }

  setSplitMode(mode: SplitMode): void {
    this.splitMode = mode;
    if (mode === 'equal') {
      this.splitNotes = {};
    }
    this.refreshPreview();
  }

  toggleMember(id: string, checked: boolean): void {
    if (checked) this.selectedIds.add(id);
    else this.selectedIds.delete(id);
    this.refreshPreview();
  }

  setManualAmount(id: string, value: string): void {
    const n = Number(value);
    if (value === '' || Number.isNaN(n)) {
      delete this.manualAmounts[id];
    } else {
      this.manualAmounts[id] = n;
    }
    this.refreshPreview();
  }

  setSplitNote(id: string, value: string): void {
    if (value.trim()) this.splitNotes[id] = value.trim();
    else delete this.splitNotes[id];
  }

  refreshPreview(): void {
    const input = this.buildInput();
    if (!input.totalAmount || input.totalAmount <= 0) {
      this.preview = null;
      return;
    }
    this.preview = buildSplitPreview(input, this.auth.members);
  }

  submit(): void {
    const input = this.buildInput();
    this.error = validateCreateInput(input, this.auth.members) ?? '';
    if (this.error) return;

    const err = this.expenses.createExpense(input);
    if (err) {
      this.error = err;
      return;
    }
    this.router.navigateByUrl('/expenses');
  }

  private buildInput(): CreateExpenseInput {
    const v = this.form.value;
    return {
      title: v.title ?? '',
      totalAmount: Number(v.totalAmount) || 0,
      payerId: v.payerId,
      participantScope: this.participantScope,
      participantIds: [...this.selectedIds],
      splitMode: this.splitMode,
      note: v.note || null,
      manualAmounts: { ...this.manualAmounts },
      splitNotes: { ...this.splitNotes },
      remainderSeed: this.remainderSeed,
    };
  }
}
