import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map, switchMap } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { TransactionService } from '../../core/services/transaction.service';
import { MemberAvatarComponent } from '../../shared/components/member-avatar.component';
import { SplitPieChartComponent } from '../../shared/components/split-pie-chart.component';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog.component';
import { TransactionDatePipe } from '../../shared/pipes/transaction-date.pipe';
import { transactionTypeLabel } from '../../core/utils/transaction-date';

@Component({
  selector: 'app-transaction-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MemberAvatarComponent,
    SplitPieChartComponent,
    ConfirmDialogComponent,
    TransactionDatePipe,
  ],
  template: `
    <div class="page" *ngIf="transaction$ | async as tx">
      <a routerLink="/transactions" class="back-link">← 返回</a>

      <div class="card">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <h2 class="section-title">{{ tx.title }}</h2>
              <span class="chip bg-cream">{{ typeLabel(tx.type) }}</span>
            </div>
            <p class="helper-text mt-1">
              {{ tx | transactionDate }}
              <ng-container *ngIf="tx.type === 'advance'">
                · 代墊 {{ auth.getMember(tx.payerId)?.name }}
                · {{ tx.splitMode === 'equal' ? '平分' : '細分' }}
              </ng-container>
              <ng-container *ngIf="tx.type === 'repayment'">
                · {{ auth.getMember(tx.fromMemberId ?? '')?.name }}
                → {{ auth.getMember(tx.payerId)?.name }}
              </ng-container>
            </p>
          </div>
          <p class="amount-lg shrink-0">NT$ {{ tx.totalAmount }}</p>
        </div>
        <p *ngIf="tx.note" class="helper-text mt-3 inset-panel">
          {{ tx.note }}
        </p>
      </div>

      <div *ngIf="tx.type === 'advance'" class="card-stack">
        <p class="card-title">分攤比例</p>
        <app-split-pie-chart
          [slices]="tx.participants"
          [totalAmount]="tx.totalAmount"
          [billTotal]="tx.billTotal ?? null"
        />
      </div>

      <div *ngIf="tx.type === 'advance'" class="card-stack">
        <p class="card-title">分攤明細</p>
        <div
          *ngFor="let p of tx.participants"
          class="inset-panel"
          [class.opacity-60]="p.amount === 0"
        >
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-2 body-text">
              <ng-container *ngIf="auth.getMember(p.memberId) as m">
                <app-member-avatar [member]="m" />
                <span>{{ m.name }}</span>
                <span *ngIf="p.memberId === tx.payerId" class="chip bg-mint/30 text-xs">代墊者</span>
              </ng-container>
            </div>
            <div class="text-right">
              <p *ngIf="p.amount === 0" class="caption-text">免分攤</p>
              <p *ngIf="p.amount > 0" class="amount-md">NT$ {{ p.amount }}</p>
              <span
                *ngIf="p.isRemainderBearer"
                class="chip ml-1 bg-coral/20 text-coral"
              >
                零頭 +{{ p.remainderAmount }}
              </span>
            </div>
          </div>
          <div
            *ngIf="p.lineItems?.length"
            class="mt-2 stack-sm border-t border-peach/15 pt-2"
          >
            <div
              *ngFor="let item of p.lineItems"
              class="flex justify-between caption-text"
            >
              <span>{{ item.note }}</span>
              <span>NT$ {{ item.amount }}</span>
            </div>
          </div>
          <p *ngIf="p.note && !p.lineItems?.length" class="caption-text mt-2">
            {{ p.note }}
          </p>
        </div>
      </div>

      <button
        *ngIf="tx.status === 'active'"
        type="button"
        class="btn-ghost-danger"
        (click)="openVoidDialog(tx)"
      >
        作廢此筆交易
      </button>

      <app-confirm-dialog
        [open]="voidDialogOpen"
        title="作廢交易"
        [detail]="voidTargetTitle"
        message="確定要作廢此筆交易嗎？作廢後結算會重新計算，操作紀錄仍會保留。"
        confirmLabel="確認作廢"
        cancelLabel="取消"
        [destructive]="true"
        [busy]="voidBusy"
        (confirmed)="confirmVoid()"
        (cancelled)="closeVoidDialog()"
      />

      <p *ngIf="message" class="body-text text-center text-coral">{{ message }}</p>
    </div>
  `,
})
export class TransactionDetailComponent {
  typeLabel = transactionTypeLabel;

  transaction$ = this.route.paramMap.pipe(
    switchMap((params) =>
      this.transactions.transactions$.pipe(
        map((list) => list.find((t) => t.id === params.get('id')))
      )
    )
  );

  message = '';
  voidDialogOpen = false;
  voidTargetId = '';
  voidTargetTitle = '';
  voidBusy = false;

  constructor(
    public auth: AuthService,
    private transactions: TransactionService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  openVoidDialog(tx: { id: string; title: string }): void {
    this.voidTargetId = tx.id;
    this.voidTargetTitle = tx.title;
    this.voidDialogOpen = true;
  }

  closeVoidDialog(): void {
    if (this.voidBusy) return;
    this.voidDialogOpen = false;
    this.voidTargetId = '';
    this.voidTargetTitle = '';
  }

  async confirmVoid(): Promise<void> {
    if (!this.voidTargetId || this.voidBusy) return;
    this.voidBusy = true;
    const err = await this.transactions.voidTransaction(this.voidTargetId);
    this.voidBusy = false;

    if (err) {
      this.message = err;
      this.closeVoidDialog();
      return;
    }

    this.voidDialogOpen = false;
    this.router.navigateByUrl('/transactions');
  }
}
