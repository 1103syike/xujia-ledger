import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { map } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { ExpenseService } from '../../core/services/expense.service';
import { formatAuditLog } from '../../core/utils/audit-formatter';

@Component({
  selector: 'app-audit',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page">
      <div class="page-title-bar">
        <h2 class="page-title">操作紀錄</h2>
      </div>

      <div *ngIf="(logs$ | async)?.length === 0" class="empty-state">
        <p class="empty-state__icon">📋</p>
        <p class="empty-state__text">尚無操作紀錄</p>
      </div>

      <div class="stack-sm">
        <div *ngFor="let item of logs$ | async" class="card body-text">
          <div class="flex items-start justify-between gap-2">
            <p class="card-title">{{ item.display.title }}</p>
            <p class="caption-text shrink-0">
              {{ item.log.createdAt | date: 'M/d HH:mm' }}
            </p>
          </div>
          <p
            *ngFor="let line of item.display.lines"
            class="helper-text mt-1"
            [class.font-medium]="line.includes('建立') || line.includes('移除') || line.includes('確認') || line.includes('標記')"
          >
            {{ line }}
          </p>
        </div>
      </div>
    </div>
  `,
})
export class AuditComponent {
  logs$ = this.expenses.auditLogs$.pipe(
    map((logs) =>
      logs.slice(0, 50).map((log) => ({
        log,
        display: formatAuditLog(log, (id) => this.auth.getMember(id)?.name),
      }))
    )
  );

  constructor(
    public auth: AuthService,
    private expenses: ExpenseService
  ) {}
}
