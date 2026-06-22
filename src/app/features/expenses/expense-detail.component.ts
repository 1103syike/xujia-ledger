import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map, switchMap } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { ExpenseService } from '../../core/services/expense.service';
import { MemberAvatarComponent } from '../../shared/components/member-avatar.component';
import { SplitPieChartComponent } from '../../shared/components/split-pie-chart.component';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog.component';

@Component({
  selector: 'app-expense-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MemberAvatarComponent,
    SplitPieChartComponent,
    ConfirmDialogComponent,
  ],
  template: `
    <div class="page" *ngIf="expense$ | async as expense">
      <a routerLink="/expenses" class="back-link">← 返回</a>

      <div class="card">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <h2 class="section-title">{{ expense.title }}</h2>
            <p class="helper-text mt-1">
              代墊 {{ auth.getMember(expense.payerId)?.name }}
              · {{ expense.splitMode === 'equal' ? '平分' : '細分' }}
            </p>
          </div>
          <p class="amount-lg shrink-0">NT$ {{ expense.totalAmount }}</p>
        </div>
        <p *ngIf="expense.note" class="helper-text mt-3 inset-panel">
          {{ expense.note }}
        </p>
      </div>

      <div class="card-stack">
        <p class="card-title">分攤比例</p>
        <app-split-pie-chart
          [slices]="expense.splits"
          [totalAmount]="expense.totalAmount"
          [billTotal]="expense.billTotal ?? null"
        />
      </div>

      <div class="card-stack">
        <p class="card-title">分攤明細</p>
        <div
          *ngFor="let split of expense.splits"
          class="inset-panel"
          [class.opacity-60]="split.amount === 0"
        >
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-2 body-text">
              <ng-container *ngIf="auth.getMember(split.memberId) as m">
                <app-member-avatar [member]="m" />
                <span>{{ m.name }}</span>
              </ng-container>
            </div>
            <div class="text-right">
              <p *ngIf="split.amount === 0" class="caption-text">免分攤</p>
              <p *ngIf="split.amount > 0" class="amount-md">NT$ {{ split.amount }}</p>
              <span
                *ngIf="split.isRemainderBearer"
                class="chip ml-1 bg-coral/20 text-coral"
              >
                零頭 +{{ split.remainderAmount }}
              </span>
            </div>
          </div>
          <div
            *ngIf="split.items?.length"
            class="mt-2 stack-sm border-t border-peach/15 pt-2"
          >
            <div
              *ngFor="let item of split.items"
              class="flex justify-between caption-text"
            >
              <span>{{ item.note }}</span>
              <span>NT$ {{ item.amount }}</span>
            </div>
          </div>
          <p *ngIf="split.note && !split.items?.length" class="caption-text mt-2">
            {{ split.note }}
          </p>
          <p class="caption-text mt-2" [ngClass]="statusClass(split.paymentStatus)">
            {{ statusLabel(split, expense.payerId) }}
          </p>

          <div *ngIf="canMarkPaid(split, expense)" class="mt-3">
            <button
              type="button"
              class="btn-primary btn-sm w-full"
              (click)="markPaid(expense.id)"
            >
              標記已付款 NT$ {{ split.amount }}
            </button>
          </div>

          <div *ngIf="canConfirm(split, expense)" class="mt-3">
            <button
              type="button"
              class="btn-primary btn-sm w-full"
              (click)="confirm(expense.id, split.memberId)"
            >
              確認收款
            </button>
          </div>

          <div *ngIf="canUnconfirm(split, expense)" class="mt-3">
            <button
              type="button"
              class="btn-secondary btn-sm w-full"
              (click)="unconfirm(expense.id, split.memberId)"
            >
              撤銷確認
            </button>
          </div>
        </div>
      </div>

      <div class="card-stack" *ngIf="expense.status === 'open'">
        <a
          [routerLink]="['/expenses', expense.id, 'edit']"
          class="btn-secondary w-full text-center"
        >
          編輯帳款
        </a>
      </div>

      <button
        *ngIf="expense.status === 'open'"
        type="button"
        class="btn-ghost-danger"
        (click)="openRemoveDialog(expense)"
      >
        移除此筆帳款
      </button>

      <app-confirm-dialog
        [open]="removeDialogOpen"
        title="移除此筆帳款"
        [detail]="removeTargetTitle"
        message="確定要移除此筆帳款嗎？移除後將無法復原，操作紀錄仍會保留。"
        confirmLabel="確認移除"
        cancelLabel="取消"
        [destructive]="true"
        [busy]="removeBusy"
        (confirmed)="confirmRemove()"
        (cancelled)="closeRemoveDialog()"
      />

      <p *ngIf="message" class="body-text text-center text-coral">{{ message }}</p>
    </div>
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
  removeDialogOpen = false;
  removeTargetId = '';
  removeTargetTitle = '';
  removeBusy = false;

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
    if (split.amount === 0) return '免分攤';
    if (split.memberId === payerId) return '代墊者';
    switch (split.paymentStatus) {
      case 'confirmed':
        return '已結清';
      case 'marked':
        return '待確認收款';
      default:
        return '尚未標記付款';
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
    this.message = (await this.expenses.markPaid(id)) ?? '已成功標記付款';
  }

  async confirm(expenseId: string, debtorId: string): Promise<void> {
    this.message = (await this.expenses.confirmPayment(expenseId, debtorId)) ?? '已成功確認收款';
  }

  async unconfirm(expenseId: string, debtorId: string): Promise<void> {
    this.message = (await this.expenses.unconfirmPayment(expenseId, debtorId)) ?? '已撤銷確認';
  }

  openRemoveDialog(expense: { id: string; title: string }): void {
    this.removeTargetId = expense.id;
    this.removeTargetTitle = expense.title;
    this.removeDialogOpen = true;
  }

  closeRemoveDialog(): void {
    if (this.removeBusy) return;
    this.removeDialogOpen = false;
    this.removeTargetId = '';
    this.removeTargetTitle = '';
  }

  async confirmRemove(): Promise<void> {
    if (!this.removeTargetId || this.removeBusy) return;
    this.removeBusy = true;
    const err = await this.expenses.cancelExpense(this.removeTargetId);
    this.removeBusy = false;

    if (err) {
      this.message = err;
      this.closeRemoveDialog();
      return;
    }

    this.removeDialogOpen = false;
    this.router.navigateByUrl('/expenses');
  }
}
