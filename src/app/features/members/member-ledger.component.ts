import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { combineLatest, map } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { TransactionService } from '../../core/services/transaction.service';
import {
  pairwiseSettlement,
  signedImpactOnMember,
  transactionsBetweenMembers,
} from '../../core/utils/ledger-calculator';
import {
  formatOweAmount,
  formatOwedAmount,
} from '../../core/utils/settlement-display';
import { activeTransactions, transactionTypeLabel } from '../../core/utils/transaction-date';
import { MemberAvatarComponent } from '../../shared/components/member-avatar.component';
import { TransactionDatePipe } from '../../shared/pipes/transaction-date.pipe';

@Component({
  selector: 'app-member-ledger',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MemberAvatarComponent,
    TransactionDatePipe,
  ],
  template: `
    <div class="page" *ngIf="vm$ | async as vm">
      <a [routerLink]="['/transactions']" [queryParams]="{ with: vm.memberId }" class="back-link">← 返回交易紀錄</a>

      <div class="page-title-bar" *ngIf="auth.getMember(vm.memberId) as member">
        <div class="flex items-center gap-3">
          <app-member-avatar [member]="member" size="lg" />
          <div>
            <h2 class="page-title">{{ member.name }}</h2>
            <p class="helper-text">交易紀錄</p>
          </div>
        </div>
      </div>

      <section class="card card-highlight-debt">
        <p class="card-title">目前結算</p>
        <div *ngIf="vm.settlement as s" class="mt-2">
          <p class="body-text">
            <ng-container *ngIf="s.fromId === vm.viewerId">
              待還給 {{ auth.getMember(s.toId)?.name }}
              <span class="amount-highlight text-debt">{{ formatOweAmount(s.amount) }}</span>
            </ng-container>
            <ng-container *ngIf="s.toId === vm.viewerId">
              {{ auth.getMember(s.fromId)?.name }} 待向你還款
              <span class="amount-highlight text-positive">{{ formatOwedAmount(s.amount) }}</span>
            </ng-container>
          </p>
          <a
            *ngIf="s.fromId === vm.viewerId"
            [routerLink]="['/transactions/new']"
            [queryParams]="{ type: 'repayment', to: vm.memberId }"
            class="btn-primary btn-sm mt-3 inline-block"
          >
            還款
          </a>
        </div>
        <p *ngIf="!vm.settlement" class="helper-text mt-2">目前與此人沒有待結算款項</p>
      </section>

      <section class="section">
        <h2 class="section-title">交易紀錄</h2>
        <div *ngIf="vm.entries.length === 0" class="empty-state">
          <p class="empty-state__text">尚無相關交易</p>
        </div>
        <div class="list-stack">
          <a
            *ngFor="let entry of vm.entries"
            [routerLink]="['/transactions', entry.tx.id]"
            class="card block"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <p class="item-title">{{ entry.tx.title }}</p>
                  <span class="chip bg-cream text-xs">{{ typeLabel(entry.tx.type) }}</span>
                </div>
                <p class="caption-text mt-1">{{ entry.tx | transactionDate }}</p>
              </div>
              <span
                class="shrink-0"
                [class.amount-md]="entry.impact !== 0"
                [class.amount-neutral]="entry.impact === 0"
                [class.text-debt]="entry.impact < 0"
                [class.text-positive]="entry.impact > 0"
              >
                <ng-container *ngIf="entry.impact !== 0">
                  {{ entry.impact > 0 ? '+' : '-' }}NT$ {{ entry.impact < 0 ? -entry.impact : entry.impact }}
                </ng-container>
                <ng-container *ngIf="entry.impact === 0">—</ng-container>
              </span>
            </div>
          </a>
        </div>
      </section>
    </div>
  `,
})
export class MemberLedgerComponent {
  formatOweAmount = formatOweAmount;
  formatOwedAmount = formatOwedAmount;
  typeLabel = transactionTypeLabel;

  vm$ = combineLatest([
    this.route.paramMap,
    this.transactions.transactions$,
    this.auth.currentMember$,
  ]).pipe(
    map(([params, txs, viewer]) => {
      const memberId = params.get('id') ?? '';
      const viewerId = viewer?.id ?? '';
      const active = activeTransactions(txs);
      const related =
        viewerId && memberId
          ? transactionsBetweenMembers(active, viewerId, memberId)
          : [];
      const settlement = viewerId
        ? pairwiseSettlement(active, viewerId, memberId)
        : null;

      return {
        memberId,
        viewerId,
        settlement,
        entries: related.map((tx) => ({
          tx,
          impact: viewerId ? signedImpactOnMember(tx, viewerId) : 0,
        })),
      };
    })
  );

  constructor(
    public auth: AuthService,
    private transactions: TransactionService,
    private route: ActivatedRoute
  ) {}
}
