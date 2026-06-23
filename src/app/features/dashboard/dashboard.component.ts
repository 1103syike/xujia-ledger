import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { combineLatest, map } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { TransactionService } from '../../core/services/transaction.service';
import { netBalances, settlementsForMember, signedImpactOnMember } from '../../core/utils/ledger-calculator';
import {
  formatOweAmount,
  formatOwedAmount,
} from '../../core/utils/settlement-display';
import {
  allClearQuip,
  buildRoastMessage,
  debtorCardQuip,
  debtorsToCreditor,
  rankQuip,
  rankTitle,
  quoteCounts,
  totalDebtRanking,
} from '../../core/utils/dashboard-insights';
import { activeTransactions, transactionTypeLabel } from '../../core/utils/transaction-date';
import { formatAdvancePayerNames } from '../../core/utils/advance-display';
import { memberNetRowsForTransaction } from '../../core/utils/transaction-member-nets';
import { MemberAvatarComponent } from '../../shared/components/member-avatar.component';
import { MemberNetChipsComponent } from '../../shared/components/member-net-chips.component';
import { TransactionDatePipe } from '../../shared/pipes/transaction-date.pipe';
import { KaomojiDecoComponent } from '../../shared/components/kaomoji-deco.component';
import {
  memberColorBorder,
  memberColorSoftBg,
  memberColorSolid,
} from '../../core/utils/member-color';
import { SettlementEntry, Transaction } from '../../core/models';
import {
  PairSettlementView,
  SettlementPairRow,
  SettlementSheetComponent,
} from '../../shared/components/settlement-sheet.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MemberAvatarComponent,
    TransactionDatePipe,
    KaomojiDecoComponent,
    SettlementSheetComponent,
    MemberNetChipsComponent,
  ],
  template: `
    <div class="page" *ngIf="vm$ | async as vm">
      <div class="page-title-bar">
        <h2 class="page-title">首頁</h2>
      </div>

      <section class="card card-highlight-debt">
        <p class="card-title">目前結算</p>
        <div *ngIf="vm.mySettlements.length === 0" class="empty-state py-4">
          <app-kaomoji-deco mood="celebrate" [salt]="clearSalt" seed="clear" />
          <p class="empty-state__text">{{ clearQuipLine(vm.memberId) }}</p>
        </div>
        <div *ngIf="vm.mySettlements.length > 0" class="stack-sm mt-2">
          <div
            *ngFor="let s of vm.mySettlements"
            class="inset-panel flex items-center justify-between gap-3"
          >
            <button
              type="button"
              class="flex min-w-0 flex-1 items-center gap-3 text-left"
              (click)="openPairSettlement(vm.activeTransactions, vm.memberId, s)"
            >
              <ng-container *ngIf="auth.getMember(s.otherId) as member">
                <app-member-avatar [member]="member" size="sm" />
                <div class="min-w-0 flex-1">
                  <p class="item-title">{{ member.name }}</p>
                  <p class="caption-text">
                    {{ s.direction === 'owe' ? '你債主' : '欠你錢的人' }}
                  </p>
                </div>
              </ng-container>
            </button>
            <a
              *ngIf="s.direction === 'owe'"
              [routerLink]="['/transactions/new']"
              [queryParams]="{ type: 'repayment', to: s.otherId }"
              class="btn-primary btn-sm shrink-0"
            >
              還款
            </a>
            <button
              type="button"
              class="amount-highlight shrink-0"
              [class.text-debt]="s.direction === 'owe'"
              [class.text-positive]="s.direction === 'owed'"
              (click)="openPairSettlement(vm.activeTransactions, vm.memberId, s)"
            >
              {{ s.direction === 'owe' ? formatOweAmount(s.amount) : formatOwedAmount(s.amount) }}
            </button>
          </div>
        </div>
      </section>

      <section class="card card-highlight-rank" *ngIf="vm.debtRanking.length > 0">
        <div class="flex items-start justify-between gap-2">
          <div>
            <p class="card-title">待結算排行</p>
            <p class="helper-text mt-1">淨待結算（欠的扣掉代墊收回）負最多前三名</p>
          </div>
          <button type="button" class="caption-text shrink-0 rounded-full bg-white/80 px-3 py-1 active:scale-95" (click)="refreshRankQuotes()">🔄 換文案</button>
        </div>
        <div class="stack-sm mt-3">
          <button
            type="button"
            *ngFor="let entry of vm.debtRanking.slice(0, 3); let i = index"
            class="inset-panel rank-row flex w-full items-center gap-3 text-left"
            [style.--rank-accent]="memberColorSolid(auth.getMember(entry.memberId)?.color || '')"
            (click)="openDebtBreakdown(vm.activeTransactions, entry.memberId)"
          >
            <span class="text-lg leading-none">{{ rankMedal(i) }}</span>
            <ng-container *ngIf="auth.getMember(entry.memberId) as member">
              <app-member-avatar [member]="member" size="sm" />
              <div class="min-w-0 flex-1">
                <p class="item-title">{{ rankTitle(i) }} · {{ member.name }}</p>
                <p class="caption-text mt-0.5">{{ rankQuipLine(entry.memberId, i) }}</p>
              </div>
            </ng-container>
            <span
              class="amount-highlight shrink-0 text-sm text-debt"
            >{{ formatOweAmount(entry.total) }}</span>
          </button>
        </div>
      </section>

      <section class="card card-highlight-debt" *ngIf="vm.myDebtors.length > 0">
        <div class="flex items-start justify-between gap-2">
          <div>
            <p class="card-title">待向你還款</p>
            <p class="helper-text mt-1">可複製提醒訊息，方便與家人溝通</p>
          </div>
          <button type="button" class="caption-text shrink-0 rounded-full bg-white/80 px-3 py-1 active:scale-95" (click)="refreshDebtorCardQuotes()">🔄 換文案</button>
        </div>
        <div class="stack-sm mt-3">
          <div *ngFor="let debtor of vm.myDebtors" class="inset-panel rank-row" [style.--rank-accent]="memberColorSolid(auth.getMember(debtor.memberId)?.color || '')">
            <div class="flex items-center gap-3">
              <ng-container *ngIf="auth.getMember(debtor.memberId) as member">
                <app-member-avatar [member]="member" size="sm" />
                <div class="min-w-0 flex-1">
                  <p class="item-title">{{ member.name }}</p>
                  <p class="caption-text mt-0.5">{{ debtorQuipLine(debtor.memberId, vm.memberId) }}</p>
                </div>
              </ng-container>
              <span class="amount-highlight shrink-0 text-sm text-positive">{{ formatOwedAmount(debtor.amount) }}</span>
            </div>
            <p class="helper-text mt-2 rounded-xl bg-white/70 px-3 py-2 italic">「{{ roastPreview(debtor.memberId, debtor.amount) }}」</p>
            <div class="mt-2 flex gap-2">
              <button type="button" class="btn-secondary btn-sm flex-1" (click)="refreshDebtorQuote(debtor.memberId)">🔄 換一句</button>
              <button type="button" class="btn-primary btn-sm flex-1" (click)="copyRoast(debtor.memberId, debtor.amount)">{{ copiedId === debtor.memberId ? '已複製 ✓' : '複製提醒' }}</button>
            </div>
          </div>
        </div>
      </section>

      <app-settlement-sheet
        [open]="sheetOpen"
        [title]="sheetTitle"
        [subtitle]="sheetSubtitle"
        [mode]="sheetMode"
        [subjectMemberId]="sheetSubjectId"
        [settlementRows]="sheetSettlementRows"
        [pair]="sheetPair"
        [transactions]="sheetTransactions"
        (closed)="closeSheet()"
      />

      <section class="section">
        <div class="section-header">
          <h2 class="section-title">最新交易</h2>
          <a *ngIf="vm.latest" routerLink="/transactions/new" class="text-link">新增交易</a>
        </div>

        <a *ngIf="vm.latest as tx" [routerLink]="['/transactions', tx.id]" class="card block">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <p class="item-title">{{ tx.title }}</p>
                <span class="chip bg-cream text-xs">{{ typeLabel(tx.type) }}</span>
              </div>
              <p class="helper-text mt-1">
                {{ tx | transactionDate }}
                <ng-container *ngIf="tx.type === 'advance'">· 代墊：{{ advancePayerNames(tx) }}</ng-container>
                <ng-container *ngIf="tx.type === 'repayment'">· {{ auth.getMember(tx.fromMemberId ?? '')?.name }} → {{ auth.getMember(tx.payerId)?.name }}</ng-container>
                <ng-container *ngIf="tx.type === 'transfer'">· 整合 {{ tx.sourceTransactionIds?.length ?? 0 }} 筆交易</ng-container>
              </p>
            </div>
            <span
              class="shrink-0"
              [class.amount-lg]="vm.latestImpact !== 0"
              [class.amount-lg-neutral]="vm.latestImpact === 0"
              [class.text-debt]="vm.latestImpact < 0"
              [class.text-positive]="vm.latestImpact > 0"
            >
              <ng-container *ngIf="vm.latestImpact < 0">{{ formatOweAmount(-vm.latestImpact) }}</ng-container>
              <ng-container *ngIf="vm.latestImpact > 0">+{{ formatOwedAmount(vm.latestImpact) }}</ng-container>
              <ng-container *ngIf="vm.latestImpact === 0">NT$ {{ tx.totalAmount }}</ng-container>
            </span>
          </div>
          <app-member-net-chips
            *ngIf="vm.latestMemberNets.length > 0"
            [rows]="vm.latestMemberNets"
          />
        </a>

        <div *ngIf="!vm.latest" class="empty-state">
          <app-kaomoji-deco mood="expense" seed="latest" />
          <p class="empty-state__text">尚無交易紀錄，歡迎新增第一筆</p>
          <a routerLink="/transactions/new" class="btn-primary mt-4 inline-block">新增交易</a>
        </div>
      </section>
    </div>
  `,
})
export class DashboardComponent {
  formatOweAmount = formatOweAmount;
  formatOwedAmount = formatOwedAmount;
  rankTitle = rankTitle;
  quoteCounts = quoteCounts();
  typeLabel = transactionTypeLabel;
  memberColorSolid = memberColorSolid;
  memberColorSoftBg = memberColorSoftBg;
  memberColorBorder = memberColorBorder;
  copiedId: string | null = null;
  rankSalt = 0;
  debtorCardSalt = 0;
  clearSalt = 0;
  debtorSalts: Record<string, number> = {};
  sheetOpen = false;
  sheetMode: 'debt-breakdown' | 'pair' = 'debt-breakdown';
  sheetTitle = '';
  sheetSubtitle?: string;
  sheetSubjectId = '';
  sheetSettlementRows: SettlementPairRow[] = [];
  sheetPair: PairSettlementView | null = null;
  sheetTransactions: Transaction[] = [];

  vm$ = combineLatest([
    this.transactions.transactions$,
    this.auth.currentMember$,
  ]).pipe(
    map(([transactions, member]) => {
      const active = activeTransactions(transactions);
      const memberId = member?.id ?? '';

      const latest = active[0] ?? null;
      const latestImpact =
        latest && memberId ? signedImpactOnMember(latest, memberId) : 0;
      const latestMemberNets = latest
        ? memberNetRowsForTransaction(latest)
        : [];

      return {
        memberId,
        activeTransactions: active,
        balances: netBalances(active),
        mySettlements: memberId ? settlementsForMember(active, memberId) : [],
        debtRanking: totalDebtRanking(active),
        myDebtors: memberId ? debtorsToCreditor(active, memberId) : [],
        latest,
        latestImpact,
        latestMemberNets,
      };
    })
  );

  constructor(
    public auth: AuthService,
    private transactions: TransactionService
  ) {}

  rankMedal(index: number): string {
    return ['🥇', '🥈', '🥉'][index] ?? `${index + 1}.`;
  }

  refreshRankQuotes(): void {
    this.rankSalt++;
  }

  refreshDebtorCardQuotes(): void {
    this.debtorCardSalt++;
  }

  refreshClearQuote(): void {
    this.clearSalt++;
  }

  refreshDebtorQuote(debtorId: string): void {
    this.debtorSalts = { ...this.debtorSalts, [debtorId]: (this.debtorSalts[debtorId] ?? 0) + 1 };
  }

  rankQuipLine(memberId: string, index: number): string {
    return rankQuip(memberId, index, this.rankSalt);
  }

  openPairSettlement(
    active: Transaction[],
    memberId: string,
    settlement: SettlementEntry
  ): void {
    const name = this.auth.getMember(settlement.otherId)?.name ?? '';
    this.sheetMode = 'pair';
    this.sheetTitle = `${name} · 結算明細`;
    this.sheetSubtitle = undefined;
    this.sheetPair = {
      viewerId: memberId,
      otherId: settlement.otherId,
      direction: settlement.direction,
      amount: settlement.amount,
    };
    this.sheetSubjectId = '';
    this.sheetSettlementRows = [];
    this.sheetTransactions = active;
    this.sheetOpen = true;
  }

  openDebtBreakdown(active: Transaction[], memberId: string): void {
    const name = this.auth.getMember(memberId)?.name ?? '';
    this.sheetMode = 'debt-breakdown';
    this.sheetTitle = `${name} 的待結算明細`;
    this.sheetSubtitle = '淨待結算含代墊與還款，以下分別列出與各家人的往來';
    this.sheetSubjectId = memberId;
    this.sheetSettlementRows = settlementsForMember(active, memberId)
      .map((s) => ({
        otherId: s.otherId,
        direction: s.direction,
        amount: s.amount,
      }))
      .sort((a, b) => {
        if (a.direction !== b.direction) {
          return a.direction === 'owe' ? -1 : 1;
        }
        return b.amount - a.amount;
      });
    this.sheetPair = null;
    this.sheetTransactions = active;
    this.sheetOpen = true;
  }

  closeSheet(): void {
    this.sheetOpen = false;
  }

  debtorQuipLine(debtorId: string, creditorId: string): string {
    return debtorCardQuip(debtorId, creditorId, this.debtorCardSalt);
  }

  clearQuipLine(memberId: string): string {
    if (!memberId) return '目前沒有待結算款項，帳本狀態良好。';
    return allClearQuip(memberId, this.clearSalt);
  }

  advancePayerNames(tx: import('../../core/models').Transaction): string {
    return formatAdvancePayerNames(tx, (id) => this.auth.getMember(id)?.name ?? id);
  }

  roastPreview(debtorId: string, amount: number): string {
    const creditorId = this.auth.currentMember?.id ?? '';
    const name = this.auth.getMember(debtorId)?.name ?? '你';
    const salt = this.debtorSalts[debtorId] ?? 0;
    return buildRoastMessage(name, amount, debtorId, creditorId, salt);
  }

  async copyRoast(debtorId: string, amount: number): Promise<void> {
    const text = this.roastPreview(debtorId, amount);
    try {
      await navigator.clipboard.writeText(text);
      this.copiedId = debtorId;
      setTimeout(() => {
        if (this.copiedId === debtorId) this.copiedId = null;
      }, 2000);
    } catch {
      /* clipboard unavailable */
    }
  }
}
