import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map, switchMap } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { ExpenseService } from '../../core/services/expense.service';
import { MemberAvatarComponent } from '../../shared/components/member-avatar.component';
import { SplitPieChartComponent } from '../../shared/components/split-pie-chart.component';

@Component({
  selector: 'app-expense-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, MemberAvatarComponent, SplitPieChartComponent],
  template: `
    <ng-container *ngIf="expense$ | async as expense">
      <a routerLink="/expenses" class="mb-4 inline-block text-sm text-ink/50">
        ← 返回
      </a>

      <div class="card mb-4">
        <div class="flex items-start justify-between">
          <div>
            <h2 class="text-xl font-bold">{{ expense.title }}</h2>
            <p class="mt-1 text-sm text-ink/60">
              代墊 {{ auth.getMember(expense.payerId)?.name }}
              · {{ expense.splitMode === 'equal' ? '平分' : '細分' }}
            </p>
          </div>
          <p class="text-xl font-bold">NT$ {{ expense.totalAmount }}</p>
        </div>
        <p *ngIf="expense.note" class="mt-3 rounded-2xl bg-cream p-3 text-sm">
          💬 {{ expense.note }}
        </p>
      </div>

      <div class="card mb-4">
        <p class="mb-1 font-medium">分攤比例</p>
        <app-split-pie-chart
          [slices]="expense.splits"
          [totalAmount]="expense.totalAmount"
        />
      </div>

      <div class="card mb-4 space-y-3">
        <p class="font-medium">分攤明細</p>
        <div
          *ngFor="let split of expense.splits"
          class="rounded-2xl bg-cream p-3"
          [class.opacity-60]="split.amount === 0"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <ng-container *ngIf="auth.getMember(split.memberId) as m">
                <app-member-avatar [member]="m" />
                <span>{{ m.name }}</span>
              </ng-container>
            </div>
            <div class="text-right">
              <p *ngIf="split.amount === 0" class="font-medium text-ink/40">不用付</p>
              <p *ngIf="split.amount > 0" class="font-bold">NT$ {{ split.amount }}</p>
              <span
                *ngIf="split.isRemainderBearer"
                class="chip bg-coral/20 text-xs text-coral"
              >
                零頭 +{{ split.remainderAmount }}
              </span>
            </div>
          </div>
          <p *ngIf="split.note" class="mt-2 text-xs text-ink/50">
            {{ split.note }}
          </p>
          <p class="mt-2 text-xs" [ngClass]="statusClass(split.paymentStatus)">
            {{ statusLabel(split, expense.payerId) }}
          </p>

          <div *ngIf="canMarkPaid(split, expense)" class="mt-2">
            <button
              type="button"
              class="btn-primary w-full py-2 text-sm"
              (click)="markPaid(expense.id)"
            >
              我已付 NT$ {{ split.amount }}
            </button>
          </div>

          <div
            *ngIf="canConfirm(split, expense)"
            class="mt-2 flex gap-2"
          >
            <button
              type="button"
              class="btn-primary flex-1 py-2 text-sm"
              (click)="confirm(expense.id, split.memberId)"
            >
              確認收到
            </button>
          </div>

          <div *ngIf="canUnconfirm(split, expense)" class="mt-2">
            <button
              type="button"
              class="btn-secondary w-full py-2 text-sm"
              (click)="unconfirm(expense.id, split.memberId)"
            >
              撤銷確認
            </button>
          </div>
        </div>
      </div>

      <button
        type="button"
        class="w-full rounded-2xl py-3 text-sm text-coral"
        (click)="cancel(expense.id)"
      >
        移除此帳款
      </button>

      <p *ngIf="message" class="mt-3 text-center text-sm text-coral">{{ message }}</p>
    </ng-container>
  `,
})
export class ExpenseDetailComponent {
  expense$ = this.route.paramMap.pipe(
    switchMap((params) =>
      this.expenses.expenses$.pipe(
        map((list) => list.find((e) => e.id === params.get('id')))
      )
    )
  );

  message = '';

  constructor(
    public auth: AuthService,
    private expenses: ExpenseService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  statusLabel(
    split: { memberId: string; paymentStatus: string; amount: number },
    payerId: string
  ): string {
    if (split.amount === 0) return '— 不用付';
    if (split.memberId === payerId) return '代墊者';
    switch (split.paymentStatus) {
      case 'confirmed':
        return '✅ 已結清';
      case 'marked':
        return '⏳ 待確認收款';
      default:
        return '💸 尚未標記已付';
    }
  }

  statusClass(status: string): string {
    if (status === 'confirmed') return 'text-mint';
    if (status === 'marked') return 'text-coral';
    return 'text-ink/50';
  }

  canMarkPaid(
    split: { memberId: string; paymentStatus: string; amount: number },
    expense: { payerId: string }
  ): boolean {
    return (
      split.amount > 0 &&
      split.memberId === this.auth.currentMember?.id &&
      split.memberId !== expense.payerId &&
      split.paymentStatus === 'unpaid'
    );
  }

  canConfirm(
    split: { memberId: string; paymentStatus: string; amount: number },
    expense: { payerId: string }
  ): boolean {
    return (
      split.amount > 0 &&
      expense.payerId === this.auth.currentMember?.id &&
      split.memberId !== expense.payerId &&
      split.paymentStatus === 'marked'
    );
  }

  canUnconfirm(
    split: { memberId: string; paymentStatus: string; amount: number },
    expense: { payerId: string }
  ): boolean {
    return (
      split.amount > 0 &&
      expense.payerId === this.auth.currentMember?.id &&
      split.memberId !== expense.payerId &&
      split.paymentStatus === 'confirmed'
    );
  }

  async markPaid(id: string): Promise<void> {
    this.message = (await this.expenses.markPaid(id)) ?? '已標記';
  }

  async confirm(expenseId: string, debtorId: string): Promise<void> {
    this.message = (await this.expenses.confirmPayment(expenseId, debtorId)) ?? '已確認';
  }

  async unconfirm(expenseId: string, debtorId: string): Promise<void> {
    this.message = (await this.expenses.unconfirmPayment(expenseId, debtorId)) ?? '已撤銷';
  }

  async cancel(id: string): Promise<void> {
    if (!confirm('確定移除此帳款？')) return;
    await this.expenses.cancelExpense(id);
    this.router.navigateByUrl('/expenses');
  }
}
