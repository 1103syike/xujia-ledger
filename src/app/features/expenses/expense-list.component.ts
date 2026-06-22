import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { ExpenseService } from '../../core/services/expense.service';

@Component({
  selector: 'app-expense-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="page">
      <div class="page-title-bar">
        <h2 class="page-title">所有帳款</h2>
        <div class="page-title-bar__aside">
          <a routerLink="/expenses/new" class="btn-primary btn-sm">新增帳款</a>
        </div>
      </div>

      <div
        *ngIf="(openExpenses$ | async)?.length === 0"
        class="empty-state"
      >
        <p class="empty-state__icon">📭</p>
        <p class="empty-state__text">尚無帳款紀錄</p>
      </div>

      <div class="list-stack">
        <a
          *ngFor="let expense of openExpenses$ | async"
          [routerLink]="['/expenses', expense.id]"
          class="card block"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="item-title">{{ expense.title }}</p>
              <p class="caption-text mt-1">
                {{ expense.splitMode === 'equal' ? '平分' : '細分' }}
                · 代墊 {{ auth.getMember(expense.payerId)?.name }}
              </p>
            </div>
            <span class="amount-md shrink-0">NT$ {{ expense.totalAmount }}</span>
          </div>
        </a>
      </div>
    </div>
  `,
})
export class ExpenseListComponent {
  openExpenses$ = this.expenses.expenses$.pipe(
    map((list) => list.filter((e) => e.status === 'open'))
  );

  constructor(
    public auth: AuthService,
    private expenses: ExpenseService
  ) {}
}
