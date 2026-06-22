import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { combineLatest, map } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { ExpenseService } from '../../core/services/expense.service';
import {
  netBalances,
  pendingConfirmationsFor,
} from '../../core/utils/balance-calculator';
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
import { MemberAvatarComponent } from '../../shared/components/member-avatar.component';
import { ExpenseDatePipe } from '../../shared/pipes/expense-date.pipe';
import { KaomojiDecoComponent } from '../../shared/components/kaomoji-deco.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MemberAvatarComponent,
    ExpenseDatePipe,
    KaomojiDecoComponent,
  ],
  template: `
    <div class="page" *ngIf="vm$ | async as vm">
      <div class="page-title-bar">
        <h2 class="page-title">首頁</h2>
      </div>

      <a
        *ngIf="vm.pendingCount > 0"
        routerLink="/pending"
        class="card block bg-lavender/30"
      >
        <p class="card-title">您有 {{ vm.pendingCount }} 筆款項待確認</p>
        <p class="helper-text mt-1">點選查看詳情 (・∀・)ノ</p>
      </a>

      <section class="card bg-peach/10" *ngIf="vm.debtRanking.length > 0">
        <div class="flex items-start justify-between gap-2">
          <div>
            <p class="card-title">🏆 許家負債排行榜</p>
            <p class="helper-text mt-1">娛樂用途，認真你就輸了 · 共 {{ quoteCounts.roast }} 種催法</p>
          </div>
          <button
            type="button"
            class="caption-text shrink-0 rounded-full bg-white/80 px-3 py-1 active:scale-95"
            (click)="refreshRankQuotes()"
          >
            🔄 換文案
          </button>
        </div>

        <div class="stack-sm mt-3">
          <div
            *ngFor="let entry of vm.debtRanking.slice(0, 3); let i = index"
            class="inset-panel flex items-center gap-3"
          >
            <span class="text-lg leading-none">{{ rankMedal(i) }}</span>
            <ng-container *ngIf="auth.getMember(entry.memberId) as member">
              <app-member-avatar [member]="member" size="sm" />
              <div class="min-w-0 flex-1">
                <p class="item-title">
                  {{ rankTitle(i) }} · {{ member.name }}
                </p>
                <p class="caption-text mt-0.5">
                  {{ rankQuipLine(entry.memberId, i) }}
                </p>
              </div>
            </ng-container>
            <span class="amount-highlight shrink-0 text-sm">
              NT$ {{ entry.total }}
            </span>
          </div>
        </div>
      </section>

      <section class="card bg-coral/20" *ngIf="vm.myDebtors.length > 0">
        <div class="flex items-start justify-between gap-2">
          <div>
            <p class="card-title">📣 欠我錢的人</p>
            <p class="helper-text mt-1">複製訊息，靠北得剛剛好</p>
          </div>
          <button
            type="button"
            class="caption-text shrink-0 rounded-full bg-white/80 px-3 py-1 active:scale-95"
            (click)="refreshDebtorCardQuotes()"
          >
            🔄 換文案
          </button>
        </div>
        <div class="stack-sm mt-3">
          <div
            *ngFor="let debtor of vm.myDebtors"
            class="inset-panel"
          >
            <div class="flex items-center gap-3">
              <ng-container *ngIf="auth.getMember(debtor.memberId) as member">
                <app-member-avatar [member]="member" size="sm" />
                <div class="min-w-0 flex-1">
                  <p class="item-title">{{ member.name }}</p>
                  <p class="caption-text mt-0.5">
                    {{ debtorQuipLine(debtor.memberId, vm.memberId) }}
                  </p>
                </div>
              </ng-container>
              <span class="amount-highlight shrink-0 text-sm">
                NT$ {{ debtor.amount }}
              </span>
            </div>
            <p class="helper-text mt-2 rounded-xl bg-white/70 px-3 py-2 italic">
              「{{ roastPreview(debtor.memberId, debtor.amount) }}」
            </p>
            <div class="mt-2 flex gap-2">
              <button
                type="button"
                class="btn-secondary btn-sm flex-1"
                (click)="refreshDebtorQuote(debtor.memberId)"
              >
                🔄 換一句
              </button>
              <button
                type="button"
                class="btn-primary btn-sm flex-1"
                (click)="copyRoast(debtor.memberId, debtor.amount)"
              >
                {{ copiedId === debtor.memberId ? '已複製 ✓' : '複製催款' }}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section
        class="card text-center"
        *ngIf="vm.debtRanking.length === 0 && vm.balances.length === 0"
      >
        <app-kaomoji-deco mood="celebrate" [salt]="clearSalt" seed="clear" />
        <p class="empty-state__text">{{ clearQuipLine(vm.memberId) }}</p>
        <button
          type="button"
          class="caption-text mt-2 rounded-full bg-cream px-3 py-1 active:scale-95"
          (click)="refreshClearQuote()"
        >
          🔄 換一句
        </button>
      </section>

      <section class="section">
        <div class="section-header">
          <h2 class="section-title">待結清款項</h2>
        </div>
        <div *ngIf="vm.balances.length === 0" class="empty-state">
          <app-kaomoji-deco mood="celebrate" seed="balances" />
          <p class="empty-state__text">目前已無待結清款項</p>
        </div>
        <div *ngIf="vm.balances.length > 0" class="stack-sm">
          <div
            *ngFor="let edge of vm.balances.slice(0, 5)"
            class="card flex items-center justify-between gap-3"
          >
            <div class="flex min-w-0 items-center gap-2 body-text">
              <ng-container *ngIf="auth.getMember(edge.fromId) as from">
                <app-member-avatar [member]="from" />
                <span>{{ from.name }}</span>
              </ng-container>
              <span class="text-ink/40">→</span>
              <ng-container *ngIf="auth.getMember(edge.toId) as to">
                <app-member-avatar [member]="to" />
                <span>{{ to.name }}</span>
              </ng-container>
            </div>
            <span class="amount-highlight shrink-0">NT$ {{ edge.amount }}</span>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="section-header">
          <h2 class="section-title">最新帳款</h2>
          <a *ngIf="vm.latest" routerLink="/expenses/new" class="text-link">
            新增帳款
          </a>
        </div>

        <a
          *ngIf="vm.latest as expense"
          [routerLink]="['/expenses', expense.id]"
          class="card block"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="item-title">{{ expense.title }}</p>
              <p class="helper-text mt-1">
                {{ expense | expenseDate }}
                · 代墊：{{ auth.getMember(expense.payerId)?.name }}
              </p>
            </div>
            <p class="amount-lg shrink-0">NT$ {{ expense.totalAmount }}</p>
          </div>
          <p *ngIf="expense.note" class="helper-text mt-2">
            {{ expense.note }}
          </p>
          <div class="mt-3 flex flex-wrap gap-2">
            <span
              *ngFor="let split of expense.splits"
              class="chip inline-flex items-center gap-1.5"
              [style.background-color]="(auth.getMember(split.memberId)?.color || '#ccc') + '44'"
            >
              <app-member-avatar
                *ngIf="auth.getMember(split.memberId) as splitMember"
                [member]="splitMember"
                size="xs"
              />
              NT$ {{ split.amount }}
            </span>
          </div>
        </a>

        <div *ngIf="!vm.latest" class="empty-state">
          <app-kaomoji-deco mood="expense" seed="latest" />
          <p class="empty-state__text">尚無帳款紀錄，歡迎建立第一筆</p>
          <a routerLink="/expenses/new" class="btn-primary mt-4 inline-block">
            建立帳款
          </a>
        </div>
      </section>
    </div>
  `,
})
export class DashboardComponent {
  rankTitle = rankTitle;
  quoteCounts = quoteCounts();
  copiedId: string | null = null;
  rankSalt = 0;
  debtorCardSalt = 0;
  clearSalt = 0;
  debtorSalts: Record<string, number> = {};

  vm$ = combineLatest([
    this.expenses.expenses$,
    this.auth.currentMember$,
  ]).pipe(
    map(([expenses, member]) => {
      const open = expenses.filter((e) => e.status === 'open');
      const memberId = member?.id ?? '';
      const pendingCount = member
        ? pendingConfirmationsFor(open, member.id).length
        : 0;

      return {
        memberId,
        balances: netBalances(open),
        debtRanking: totalDebtRanking(open),
        myDebtors: memberId ? debtorsToCreditor(open, memberId) : [],
        latest: open[0] ?? null,
        pendingCount,
      };
    })
  );

  constructor(public auth: AuthService, private expenses: ExpenseService) {}

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
    this.debtorSalts = {
      ...this.debtorSalts,
      [debtorId]: (this.debtorSalts[debtorId] ?? 0) + 1,
    };
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
