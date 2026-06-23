import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { combineLatest, map } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { TransactionService } from '../../core/services/transaction.service';
import { netBalances, settlementsForMember } from '../../core/utils/ledger-calculator';
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
import { MemberAvatarComponent } from '../../shared/components/member-avatar.component';
import { TransactionDatePipe } from '../../shared/pipes/transaction-date.pipe';
import { KaomojiDecoComponent } from '../../shared/components/kaomoji-deco.component';
import {
  memberColorBorder,
  memberColorSoftBg,
  memberColorSolid,
} from '../../core/utils/member-color';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MemberAvatarComponent,
    TransactionDatePipe,
    KaomojiDecoComponent,
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
            <a
              [routerLink]="['/transactions']"
              [queryParams]="{ with: s.otherId }"
              class="flex min-w-0 flex-1 items-center gap-3"
            >
              <ng-container *ngIf="auth.getMember(s.otherId) as member">
                <app-member-avatar [member]="member" size="sm" />
                <div class="min-w-0 flex-1">
                  <p class="item-title">{{ member.name }}</p>
                  <p class="caption-text">
                    {{ s.direction === 'owe' ? '你欠他' : '欠你' }}
                  </p>
                </div>
              </ng-container>
            </a>
            <a
              *ngIf="s.direction === 'owe'"
              [routerLink]="['/transactions/new']"
              [queryParams]="{ type: 'repayment', to: s.otherId }"
              class="btn-primary btn-sm shrink-0"
            >
              還款
            </a>
            <a
              [routerLink]="['/transactions']"
              [queryParams]="{ with: s.otherId }"
              class="amount-highlight shrink-0"
            >
              NT$ {{ s.amount }}
            </a>
          </div>
        </div>
      </section>

      <section class="card card-highlight-rank" *ngIf="vm.debtRanking.length > 0">
        <div class="flex items-start justify-between gap-2">
          <div>
            <p class="card-title">🏆 許家負債排行榜</p>
            <p class="helper-text mt-1">娛樂用途，認真你就輸了 · 共 {{ quoteCounts.roast }} 種催法</p>
          </div>
          <button type="button" class="caption-text shrink-0 rounded-full bg-white/80 px-3 py-1 active:scale-95" (click)="refreshRankQuotes()">🔄 換文案</button>
        </div>
        <div class="stack-sm mt-3">
          <a
            *ngFor="let entry of vm.debtRanking.slice(0, 3); let i = index"
            [routerLink]="['/transactions']"
            [queryParams]="{ with: entry.memberId }"
            class="inset-panel rank-row flex items-center gap-3"
            [style.--rank-accent]="memberColorSolid(auth.getMember(entry.memberId)?.color || '')"
          >
            <span class="text-lg leading-none">{{ rankMedal(i) }}</span>
            <ng-container *ngIf="auth.getMember(entry.memberId) as member">
              <app-member-avatar [member]="member" size="sm" />
              <div class="min-w-0 flex-1">
                <p class="item-title">{{ rankTitle(i) }} · {{ member.name }}</p>
                <p class="caption-text mt-0.5">{{ rankQuipLine(entry.memberId, i) }}</p>
              </div>
            </ng-container>
            <span class="amount-highlight shrink-0 text-sm">NT$ {{ entry.total }}</span>
          </a>
        </div>
      </section>

      <section class="card card-highlight-debt" *ngIf="vm.myDebtors.length > 0">
        <div class="flex items-start justify-between gap-2">
          <div>
            <p class="card-title">📣 欠我錢的人</p>
            <p class="helper-text mt-1">複製訊息，靠北得剛剛好</p>
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
              <span class="amount-highlight shrink-0 text-sm">NT$ {{ debtor.amount }}</span>
            </div>
            <p class="helper-text mt-2 rounded-xl bg-white/70 px-3 py-2 italic">「{{ roastPreview(debtor.memberId, debtor.amount) }}」</p>
            <div class="mt-2 flex gap-2">
              <button type="button" class="btn-secondary btn-sm flex-1" (click)="refreshDebtorQuote(debtor.memberId)">🔄 換一句</button>
              <button type="button" class="btn-primary btn-sm flex-1" (click)="copyRoast(debtor.memberId, debtor.amount)">{{ copiedId === debtor.memberId ? '已複製 ✓' : '複製催款' }}</button>
            </div>
          </div>
        </div>
      </section>

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
                <ng-container *ngIf="tx.type === 'advance'">· 代墊：{{ auth.getMember(tx.payerId)?.name }}</ng-container>
                <ng-container *ngIf="tx.type === 'repayment'">· {{ auth.getMember(tx.fromMemberId ?? '')?.name }} → {{ auth.getMember(tx.payerId)?.name }}</ng-container>
              </p>
            </div>
            <p class="amount-lg shrink-0">NT$ {{ tx.totalAmount }}</p>
          </div>
          <div *ngIf="tx.type === 'advance'" class="mt-3 flex flex-wrap gap-2">
            <span *ngFor="let p of tx.participants" class="chip inline-flex items-center gap-1.5" [style.background-color]="memberColorSoftBg(auth.getMember(p.memberId)?.color || '')" [style.box-shadow]="'inset 0 0 0 1px ' + memberColorBorder(auth.getMember(p.memberId)?.color || '')">
              <app-member-avatar *ngIf="auth.getMember(p.memberId) as splitMember" [member]="splitMember" size="xs" />
              NT$ {{ p.amount }}
            </span>
          </div>
        </a>

        <div *ngIf="!vm.latest" class="empty-state">
          <app-kaomoji-deco mood="expense" seed="latest" />
          <p class="empty-state__text">尚無交易紀錄，歡迎建立第一筆</p>
          <a routerLink="/transactions/new" class="btn-primary mt-4 inline-block">新增交易</a>
        </div>
      </section>
    </div>
  `,
})
export class DashboardComponent {
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

  vm$ = combineLatest([
    this.transactions.transactions$,
    this.auth.currentMember$,
  ]).pipe(
    map(([transactions, member]) => {
      const active = activeTransactions(transactions);
      const memberId = member?.id ?? '';

      return {
        memberId,
        balances: netBalances(active),
        mySettlements: memberId ? settlementsForMember(active, memberId) : [],
        debtRanking: totalDebtRanking(active),
        myDebtors: memberId ? debtorsToCreditor(active, memberId) : [],
        latest: active[0] ?? null,
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

  debtorQuipLine(debtorId: string, creditorId: string): string {
    return debtorCardQuip(debtorId, creditorId, this.debtorCardSalt);
  }

  clearQuipLine(memberId: string): string {
    if (!memberId) return '全家清清白白的，今天可以加雞腿。';
    return allClearQuip(memberId, this.clearSalt);
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
