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
    <div class="mb-4 flex items-center justify-between">
      <h2 class="text-lg font-bold">所有帳款</h2>
      <a routerLink="/expenses/new" class="btn-primary py-2 text-sm">+ 新增</a>
    </div>

    <div *ngIf="(openExpenses$ | async)?.length === 0" class="card text-center text-sm text-ink/50">
      <p class="text-2xl">📭</p>
      <p class="mt-2">還沒有帳款</p>
    </div>

    <div class="space-y-3">
      <a
        *ngFor="let expense of openExpenses$ | async"
        [routerLink]="['/expenses', expense.id]"
        class="card block"
      >
        <div class="flex items-start justify-between">
          <div>
            <p class="font-bold">{{ expense.title }}</p>
            <p class="mt-1 text-xs text-ink/50">
              {{ expense.splitMode === 'equal' ? '平分' : '細分' }}
              · 代墊 {{ auth.getMember(expense.payerId)?.name }}
            </p>
          </div>
          <span class="font-bold">NT$ {{ expense.totalAmount }}</span>
        </div>
      </a>
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
