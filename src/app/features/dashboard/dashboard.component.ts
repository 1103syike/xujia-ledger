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
import { MemberAvatarComponent } from '../../shared/components/member-avatar.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, MemberAvatarComponent],
  template: `
    <ng-container *ngIf="vm$ | async as vm">
      <a
        *ngIf="vm.pendingCount > 0"
        routerLink="/pending"
        class="card mb-4 block bg-lavender/30"
      >
        <p class="font-medium text-ink">
          ✨ 有 {{ vm.pendingCount }} 筆等你確認收款
        </p>
        <p class="mt-1 text-sm text-ink/60">點這裡去看看～</p>
      </a>

      <section class="mb-4">
        <div class="mb-2 flex items-center justify-between">
          <h2 class="font-bold text-ink">誰欠誰最多</h2>
        </div>
        <div *ngIf="vm.balances.length === 0" class="card text-center text-sm text-ink/50">
          <p class="text-2xl">🎉</p>
          <p class="mt-2">目前沒有未結清款項</p>
        </div>
        <div *ngIf="vm.balances.length > 0" class="space-y-2">
          <div
            *ngFor="let edge of vm.balances.slice(0, 5)"
            class="card flex items-center justify-between"
          >
            <div class="flex items-center gap-2 text-sm">
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
            <span class="font-bold text-coral">NT$ {{ edge.amount }}</span>
          </div>
        </div>
      </section>

      <section>
        <div class="mb-2 flex items-center justify-between">
          <h2 class="font-bold text-ink">最近一筆開銷</h2>
          <a routerLink="/expenses/new" class="text-sm text-coral">+ 新增</a>
        </div>

        <a
          *ngIf="vm.latest as expense"
          [routerLink]="['/expenses', expense.id]"
          class="card block"
        >
          <div class="flex items-start justify-between">
            <div>
              <p class="font-bold">{{ expense.title }}</p>
              <p class="mt-1 text-sm text-ink/60">
                代墊：{{ auth.getMember(expense.payerId)?.name }}
              </p>
            </div>
            <p class="text-lg font-bold text-ink">NT$ {{ expense.totalAmount }}</p>
          </div>
          <p *ngIf="expense.note" class="mt-2 text-sm text-ink/50">
            💬 {{ expense.note }}
          </p>
          <div class="mt-3 flex flex-wrap gap-2">
            <span
              *ngFor="let split of expense.splits"
              class="chip text-xs"
              [style.background-color]="(auth.getMember(split.memberId)?.color || '#ccc') + '44'"
            >
              {{ auth.getMember(split.memberId)?.emoji }} NT$ {{ split.amount }}
            </span>
          </div>
        </a>

        <div *ngIf="!vm.latest" class="card text-center text-sm text-ink/50">
          <p class="text-2xl">🌱</p>
          <p class="mt-2">還沒有帳款，來新增第一筆吧～</p>
          <a routerLink="/expenses/new" class="btn-primary mt-4 inline-block">
            建立帳款
          </a>
        </div>
      </section>
    </ng-container>
  `,
})
export class DashboardComponent {
  vm$ = combineLatest([
    this.expenses.expenses$,
    this.auth.currentMember$,
  ]).pipe(
    map(([expenses, member]) => {
      const open = expenses.filter((e) => e.status === 'open');
      const pendingCount = member
        ? pendingConfirmationsFor(open, member.id).length
        : 0;

      return {
        balances: netBalances(open),
        latest: open[0] ?? null,
        pendingCount,
      };
    })
  );

  constructor(
    public auth: AuthService,
    private expenses: ExpenseService
  ) {}
}
