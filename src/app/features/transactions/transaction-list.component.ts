import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { combineLatest, map } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { TransactionService } from '../../core/services/transaction.service';
import {
  signedImpactOnMember,
  transactionsBetweenMembers,
} from '../../core/utils/ledger-calculator';
import { activeTransactions, transactionTypeLabel } from '../../core/utils/transaction-date';
import { MemberAvatarComponent } from '../../shared/components/member-avatar.component';
import { TransactionDatePipe } from '../../shared/pipes/transaction-date.pipe';
import { KaomojiDecoComponent } from '../../shared/components/kaomoji-deco.component';
import { memberColorSolid } from '../../core/utils/member-color';

@Component({
  selector: 'app-transaction-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    TransactionDatePipe,
    KaomojiDecoComponent,
    MemberAvatarComponent,
  ],
  template: `
    <div class="page" *ngIf="vm$ | async as vm">
      <div class="page-title-bar">
        <h2 class="page-title">
          {{ vm.withMember ? '與' + vm.withMember.name + '的交易' : '所有交易' }}
        </h2>
        <div class="page-title-bar__aside">
          <a routerLink="/transactions/new" class="btn-primary btn-sm">新增交易</a>
        </div>
      </div>

      <div class="member-filter-bar">
        <a
          routerLink="/transactions"
          class="member-filter-chip"
          [class.member-filter-chip--active]="!vm.withMemberId"
          aria-label="全部交易"
        >
          <span class="member-filter-chip__all">全</span>
          <span class="member-filter-chip__label">全部</span>
        </a>
        <a
          *ngFor="let m of vm.otherMembers"
          [routerLink]="['/transactions']"
          [queryParams]="{ with: m.id }"
          class="member-filter-chip"
          [class.member-filter-chip--active]="vm.withMemberId === m.id"
          [attr.aria-label]="'與' + m.name + '的交易'"
          [style.--filter-accent]="memberColorSolid(m.color)"
        >
          <app-member-avatar [member]="m" size="sm" />
          <span class="member-filter-chip__label">{{ m.name }}</span>
        </a>
      </div>

      <div *ngIf="vm.transactions.length === 0" class="empty-state">
        <app-kaomoji-deco mood="expense" seed="transaction-list" [salt]="emptySalt" />
        <p class="empty-state__text">
          {{ vm.withMember ? '與' + vm.withMember.name + '尚無相關交易' : '尚無交易紀錄' }}
        </p>
        <a *ngIf="!vm.withMember" routerLink="/transactions/new" class="btn-primary mt-4 inline-block">
          建立第一筆交易
        </a>
      </div>

      <div class="list-stack">
        <a
          *ngFor="let entry of vm.transactions"
          [routerLink]="['/transactions', entry.tx.id]"
          class="card block"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <p class="item-title">{{ entry.tx.title }}</p>
                <span class="chip bg-cream text-xs">{{ typeLabel(entry.tx.type) }}</span>
              </div>
              <p class="caption-text mt-1">
                {{ entry.tx | transactionDate }}
                <ng-container *ngIf="entry.tx.type === 'advance'">
                  · {{ entry.tx.splitMode === 'equal' ? '平分' : '細分' }}
                  · 代墊 {{ auth.getMember(entry.tx.payerId)?.name }}
                </ng-container>
                <ng-container *ngIf="entry.tx.type === 'repayment'">
                  · {{ auth.getMember(entry.tx.fromMemberId ?? '')?.name }}
                  → {{ auth.getMember(entry.tx.payerId)?.name }}
                </ng-container>
              </p>
            </div>
            <span
              class="amount-md shrink-0"
              [class.text-coral]="entry.impact < 0"
              [class.text-positive]="entry.impact > 0"
            >
              <ng-container *ngIf="vm.withMemberId && entry.impact !== 0">
                {{ entry.impact > 0 ? '+' : '-' }}NT$
                {{ entry.impact < 0 ? -entry.impact : entry.impact }}
              </ng-container>
              <ng-container *ngIf="!vm.withMemberId">NT$ {{ entry.tx.totalAmount }}</ng-container>
              <ng-container *ngIf="vm.withMemberId && entry.impact === 0">—</ng-container>
            </span>
          </div>
        </a>
      </div>
    </div>
  `,
})
export class TransactionListComponent {
  emptySalt = 0;
  typeLabel = transactionTypeLabel;
  memberColorSolid = memberColorSolid;

  vm$ = combineLatest([
    this.transactions.transactions$,
    this.auth.currentMember$,
    this.route.queryParamMap,
  ]).pipe(
    map(([transactions, viewer, params]) => {
      const viewerId = viewer?.id ?? '';
      const withMemberId = params.get('with');
      const active = activeTransactions(transactions);
      const otherMembers = this.auth
        .getAllMembers()
        .filter((m) => m.id !== viewerId);
      const withMember = withMemberId
        ? this.auth.getMember(withMemberId)
        : undefined;

      const filtered =
        withMemberId && viewerId
          ? transactionsBetweenMembers(active, viewerId, withMemberId)
          : active;

      return {
        withMemberId,
        withMember,
        otherMembers,
        transactions: filtered.map((tx) => ({
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
