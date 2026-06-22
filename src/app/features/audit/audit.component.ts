import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { map } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { ExpenseService } from '../../core/services/expense.service';

@Component({
  selector: 'app-audit',
  standalone: true,
  imports: [CommonModule],
  template: `
    <h2 class="mb-4 text-lg font-bold">操作紀錄</h2>

    <div *ngIf="(logs$ | async)?.length === 0" class="card text-center text-sm text-ink/50">
      <p class="text-2xl">📋</p>
      <p class="mt-2">還沒有任何紀錄</p>
    </div>

    <div class="space-y-2">
      <div *ngFor="let log of logs$ | async" class="card text-sm">
        <div class="flex items-start justify-between gap-2">
          <p class="font-medium">{{ actionLabel(log.action) }}</p>
          <p class="shrink-0 text-xs text-ink/40">{{ log.createdAt | date: 'M/d HH:mm' }}</p>
        </div>
        <p class="mt-1 text-ink/60">
          {{ auth.getMember(log.actorId)?.name ?? log.actorId }}
        </p>
      </div>
    </div>
  `,
})
export class AuditComponent {
  logs$ = this.expenses.auditLogs$.pipe(
    map((logs) => logs.slice(0, 50))
  );

  constructor(
    public auth: AuthService,
    private expenses: ExpenseService
  ) {}

  actionLabel(action: string): string {
    const labels: Record<string, string> = {
      'expense.created': '📝 建立帳款',
      'expense.cancelled': '🗑️ 移除帳款',
      'payment.marked': '💸 標記已付',
      'payment.confirmed': '✅ 確認收款',
      'payment.unconfirmed': '↩️ 撤銷確認',
    };
    return labels[action] ?? action;
  }
}
