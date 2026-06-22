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
    <div class="page">
      <div class="page-title-bar">
        <h2 class="page-title">待確認收款</h2>
      </div>

      <ng-container *ngIf="items$ | async as items">
        <div *ngIf="items.length === 0" class="empty-state">
          <p class="empty-state__icon">🌈</p>
          <p class="empty-state__text">目前沒有待確認的款項</p>
        </div>

        <div class="list-stack">
          <div *ngFor="let item of items" class="card-stack">
            <div>
              <p class="item-title">{{ item.expense.title }}</p>
              <div class="mt-1 flex items-center gap-2 body-text">
                <ng-container *ngIf="auth.getMember(item.split.memberId) as m">
                  <app-member-avatar [member]="m" />
                  <span>{{ m.name }} 已付款 NT$ {{ item.split.amount }}</span>
                </ng-container>
              </div>
            </div>
            <div class="flex gap-2">
              <button
                type="button"
                class="btn-primary btn-sm flex-1"
                (click)="confirm(item.expense.id, item.split.memberId)"
              >
                確認收款
              </button>
              <a
                [routerLink]="['/expenses', item.expense.id]"
                class="btn-secondary btn-sm flex-1 text-center"
              >
                查看詳情
              </a>
            </div>
          </div>
        </div>
      </ng-container>
    </div>
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
