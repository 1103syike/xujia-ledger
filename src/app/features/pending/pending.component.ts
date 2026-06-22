import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { combineLatest, map } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { ExpenseService } from '../../core/services/expense.service';
import { pendingConfirmationsFor } from '../../core/utils/balance-calculator';
import { MemberAvatarComponent } from '../../shared/components/member-avatar.component';

@Component({
  selector: 'app-pending',
  standalone: true,
  imports: [CommonModule, RouterLink, MemberAvatarComponent],
  template: `
    <h2 class="mb-4 text-lg font-bold">待確認收款</h2>

    <ng-container *ngIf="items$ | async as items">
      <div *ngIf="items.length === 0" class="card text-center text-sm text-ink/50">
        <p class="text-2xl">🌈</p>
        <p class="mt-2">目前沒有待確認的款項～</p>
      </div>

      <div class="space-y-3">
        <div *ngFor="let item of items" class="card">
          <div class="flex items-center justify-between">
            <div>
              <p class="font-bold">{{ item.expense.title }}</p>
              <div class="mt-1 flex items-center gap-2 text-sm">
                <ng-container *ngIf="auth.getMember(item.split.memberId) as m">
                  <app-member-avatar [member]="m" />
                  <span>{{ m.name }} 已付 NT$ {{ item.split.amount }}</span>
                </ng-container>
              </div>
            </div>
          </div>
          <div class="mt-3 flex gap-2">
            <button
              type="button"
              class="btn-primary flex-1 py-2 text-sm"
              (click)="confirm(item.expense.id, item.split.memberId)"
            >
              確認收到
            </button>
            <a
              [routerLink]="['/expenses', item.expense.id]"
              class="btn-secondary flex-1 py-2 text-center text-sm"
            >
              詳情
            </a>
          </div>
        </div>
      </div>
    </ng-container>
  `,
})
export class PendingComponent {
  items$ = combineLatest([
    this.expenses.expenses$,
    this.auth.currentMember$,
  ]).pipe(
    map(([expenses, member]) => {
      if (!member) return [];
      const open = expenses.filter((e) => e.status === 'open');
      return pendingConfirmationsFor(open, member.id);
    })
  );

  constructor(
    public auth: AuthService,
    private expenses: ExpenseService
  ) {}

  async confirm(expenseId: string, debtorId: string): Promise<void> {
    await this.expenses.confirmPayment(expenseId, debtorId);
  }
}
