import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { ExpenseService } from '../../core/services/expense.service';
import { formatAuditLog } from '../../core/utils/audit-formatter';
import { KaomojiDecoComponent } from '../../shared/components/kaomoji-deco.component';
import { COPY_ACTIONS, COPY_EMPTY, COPY_PAGES } from '../../copy';

@Component({
  selector: 'app-audit',
  standalone: true,
  imports: [CommonModule, RouterLink, KaomojiDecoComponent],
  templateUrl: './audit.component.html',

})
export class AuditComponent {
  pages = COPY_PAGES;
  empty = COPY_EMPTY;
  actions = COPY_ACTIONS;

  logs$ = this.expenses.auditLogs$.pipe(
    map((logs) =>
      logs.map((log) => ({
        log,
        display: formatAuditLog(log, (id) => this.auth.getMember(id)?.name),
      }))
    )
  );

  constructor(
    private auth: AuthService,
    private expenses: ExpenseService
  ) {}
}
