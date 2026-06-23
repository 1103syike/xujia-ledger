import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { combineLatest, map } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { TransactionService } from '../../core/services/transaction.service';
import {
  signedImpactOnMember,
  transactionsBetweenMembers,
} from '../../core/utils/ledger-calculator';
import { isConsolidatable } from '../../core/utils/debt-consolidation';
import { memberNetRowsForTransaction } from '../../core/utils/transaction-member-nets';
import { activeTransactions, transactionTypeLabel } from '../../core/utils/transaction-date';
import { formatAdvancePayerNames } from '../../core/utils/advance-display';
import { MemberAvatarComponent } from '../../shared/components/member-avatar.component';
import { MemberNetChipsComponent } from '../../shared/components/member-net-chips.component';
import { TransactionDatePipe } from '../../shared/pipes/transaction-date.pipe';
import { KaomojiDecoComponent } from '../../shared/components/kaomoji-deco.component';
import {
  formatOweAmount,
  formatOwedAmount,
} from '../../core/utils/settlement-display';
import {
  memberColorSolid,
} from '../../core/utils/member-color';

@Component({
  selector: 'app-transaction-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    TransactionDatePipe,
    KaomojiDecoComponent,
    MemberAvatarComponent,
    MemberNetChipsComponent,
  ],
  template: `
    <div class="page" *ngIf="vm$ | async as vm">
      <div class="page-title-bar">
        <h2 class="page-title">
          {{ selectMode ? '勾選要整合的交易' : vm.withMember ? '與' + vm.withMember.name + '的交易' : '所有交易' }}
        </h2>
        <div class="page-title-bar__aside flex gap-2">
          <button
            *ngIf="!selectMode && !vm.withMemberId"
            type="button"
            class="btn-secondary btn-sm"
            (click)="enterSelectMode()"
          >
            債務整合
          </button>
          <a *ngIf="!selectMode" routerLink="/transactions/new" class="btn-primary btn-sm">新增交易</a>
        </div>
      </div>

      <div class="member-filter-bar" *ngIf="!selectMode">
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
        <a *ngIf="!vm.withMember && !selectMode" routerLink="/transactions/new" class="btn-primary mt-4 inline-block">
          建立第一筆交易
        </a>
      </div>

      <div class="list-stack" [class.pb-36]="selectMode">
        <div
          *ngFor="let entry of vm.transactions"
          class="card transition"
          [class.cursor-pointer]="selectMode && entry.consolidatable"
          [class.opacity-50]="selectMode && !entry.consolidatable"
          [class.ring-2]="selectMode && isSelected(entry.tx.id)"
          [class.ring-coral]="selectMode && isSelected(entry.tx.id)"
        >
          <a *ngIf="!selectMode" [routerLink]="['/transactions', entry.tx.id]" class="block">
            <ng-container *ngTemplateOutlet="rowContent; context: { $implicit: entry }" />
          </a>
          <div
            *ngIf="selectMode"
            class="flex items-start gap-3"
            role="button"
            [attr.aria-pressed]="isSelected(entry.tx.id)"
            [attr.aria-disabled]="!entry.consolidatable"
            (click)="onRowClick(entry)"
          >
            <div class="mt-0.5 flex shrink-0 items-center" aria-hidden="true">
              <input
                type="checkbox"
                class="pointer-events-none h-5 w-5 accent-coral"
                [checked]="isSelected(entry.tx.id)"
                [disabled]="!entry.consolidatable"
                tabindex="-1"
              />
            </div>
            <div class="min-w-0 flex-1">
              <ng-container *ngTemplateOutlet="rowContent; context: { $implicit: entry }" />
            </div>
          </div>
        </div>
      </div>

      <p *ngIf="selectMode && vm.consolidatableCount === 0" class="helper-text -mt-2 text-center">
        目前沒有可整合的代墊（已整合或還款的交易無法勾選）
      </p>

      <div
        *ngIf="selectMode"
        class="consolidate-action-bar fixed left-0 right-0 z-20 border-t border-peach/20 bg-white/95 px-4 py-3 backdrop-blur-md"
      >
        <div class="mx-auto flex max-w-md items-center gap-3">
          <button type="button" class="btn-secondary btn-sm" (click)="cancelSelectMode()">取消</button>
          <button
            type="button"
            class="btn-primary btn-sm flex-1"
            [disabled]="selectedIds.length === 0"
            (click)="goToConsolidation()"
          >
            下一步（{{ selectedIds.length }} 筆）
          </button>
        </div>
      </div>
    </div>

    <ng-template #rowContent let-entry>
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <p class="item-title">{{ entry.tx.title }}</p>
            <span class="chip bg-cream text-xs">{{ typeLabel(entry.tx.type) }}</span>
            <span *ngIf="entry.tx.settledByTransferId" class="chip bg-lavender/40 text-xs">已債務轉移</span>
          </div>
          <p class="caption-text mt-1">
            {{ entry.tx | transactionDate }}
            <ng-container *ngIf="entry.tx.type === 'advance'">
              · {{ entry.tx.splitMode === 'equal' ? '平分' : '細分' }}
              · 代墊 {{ advancePayerNames(entry.tx) }}
            </ng-container>
            <ng-container *ngIf="entry.tx.type === 'repayment'">
              · {{ auth.getMember(entry.tx.fromMemberId ?? '')?.name }}
              → {{ auth.getMember(entry.tx.payerId)?.name }}
            </ng-container>
            <ng-container *ngIf="entry.tx.type === 'transfer'">
              · 整合 {{ entry.tx.sourceTransactionIds?.length ?? 0 }} 筆交易
            </ng-container>
          </p>
        </div>
        <span
          class="shrink-0"
          [class.amount-md]="entry.impact !== 0"
          [class.amount-neutral]="entry.impact === 0 && entry.tx.type !== 'transfer'"
          [class.text-debt]="entry.impact < 0"
          [class.text-positive]="entry.impact > 0"
        >
          <ng-container *ngIf="entry.tx.type === 'transfer'">NT$ {{ entry.tx.totalAmount }}</ng-container>
          <ng-container *ngIf="entry.tx.type !== 'transfer' && entry.impact < 0">{{ formatOweAmount(-entry.impact) }}</ng-container>
          <ng-container *ngIf="entry.tx.type !== 'transfer' && entry.impact > 0">+{{ formatOwedAmount(entry.impact) }}</ng-container>
          <ng-container *ngIf="entry.tx.type !== 'transfer' && entry.impact === 0">NT$ {{ entry.tx.totalAmount }}</ng-container>
        </span>
      </div>
      <app-member-net-chips
        *ngIf="entry.memberNets.length > 0"
        [rows]="entry.memberNets"
      />
    </ng-template>
  `,
})
export class TransactionListComponent implements OnInit {
  emptySalt = 0;
  selectMode = false;
  selectedIds: string[] = [];
  typeLabel = transactionTypeLabel;
  formatOweAmount = formatOweAmount;
  formatOwedAmount = formatOwedAmount;

  advancePayerNames(tx: { type: string; payerId: string; payers?: { memberId: string; amount: number }[] }): string {
    return formatAdvancePayerNames(tx as import('../../core/models').Transaction, (id) =>
      this.auth.getMember(id)?.name ?? id
    );
  }
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
        consolidatableCount: filtered.filter((tx) => isConsolidatable(tx)).length,
        transactions: filtered.map((tx) => ({
          tx,
          impact: viewerId ? signedImpactOnMember(tx, viewerId) : 0,
          consolidatable: isConsolidatable(tx),
          memberNets: memberNetRowsForTransaction(tx),
        })),
      };
    })
  );

  constructor(
    public auth: AuthService,
    private transactions: TransactionService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      if (params.get('consolidate') === '1') {
        this.enterSelectMode();
      }
      const preselected = params.get('ids');
      if (preselected) {
        this.selectedIds = preselected.split(',').filter(Boolean);
      }
    });
  }

  enterSelectMode(): void {
    this.selectMode = true;
  }

  cancelSelectMode(): void {
    this.selectMode = false;
    this.selectedIds = [];
    void this.router.navigate(['/transactions'], { replaceUrl: true });
  }

  isSelected(id: string): boolean {
    return this.selectedIds.includes(id);
  }

  onRowClick(entry: { tx: { id: string }; consolidatable: boolean }): void {
    if (!this.selectMode || !entry.consolidatable) return;
    this.toggleSelect(entry.tx.id);
  }

  toggleSelect(id: string): void {
    if (this.selectedIds.includes(id)) {
      this.selectedIds = this.selectedIds.filter((x) => x !== id);
    } else {
      this.selectedIds = [...this.selectedIds, id];
    }
  }

  goToConsolidation(): void {
    if (this.selectedIds.length === 0) return;
    const ids = this.selectedIds.join(',');
    this.router.navigate(['/transactions/new'], {
      queryParams: { type: 'transfer', ids },
    });
  }
}
