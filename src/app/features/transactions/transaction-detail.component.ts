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
import { formatOweAmount, formatOwedAmount } from '../../core/utils/settlement-display';
import { formatAdvancePayersDetail } from '../../core/utils/advance-display';
import { getAdvancePayers } from '../../core/utils/advance-allocation';
import { memberNetRowsForTransaction } from '../../core/utils/transaction-member-nets';
import { LineItem, Transaction, TransactionParticipant, TransferEdge } from '../../core/models';
import { InterestEstimateComponent } from '../../shared/components/interest-estimate.component';
import { ViewSwitchComponent } from '../../shared/components/view-switch.component';
import { TransferBreakdownComponent } from '../../shared/components/transfer-breakdown.component';

interface TransferMemberRow {
  memberId: string;
  signedAmount: number;
  lineItems: LineItem[];
}

interface TransactionDetailVm {
  tx: Transaction | undefined;
  transferEdges: TransferEdge[];
  transferMemberRows: TransferMemberRow[];
  sourceTransactions: Transaction[];
}

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
    InterestEstimateComponent,
    ViewSwitchComponent,
    TransferBreakdownComponent,
  ],
  template: `
    <div class="page" *ngIf="vm$ | async as vm">
      <ng-container *ngIf="vm.tx as tx; else notFound">
      <a routerLink="/transactions" class="back-link">← 返回</a>

      <div class="card">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <h2 class="section-title">{{ tx.title }}</h2>
              <span class="chip bg-cream">{{ typeLabel(tx.type) }}</span>
              <span *ngIf="tx.settledByTransferId" class="chip bg-lavender/40 text-xs">已債務轉移</span>
            </div>
            <p class="helper-text mt-1">
              {{ tx | transactionDate }}
              <ng-container *ngIf="tx.type === 'advance'">
                · 代墊 {{ advancePayersLabel(tx) }}
                · {{ tx.splitMode === 'equal' ? '平分' : '細分' }}
              </ng-container>
              <ng-container *ngIf="tx.type === 'repayment'">
                · {{ auth.getMember(tx.fromMemberId ?? '')?.name }}
                → {{ auth.getMember(tx.payerId)?.name }}
              </ng-container>
              <ng-container *ngIf="tx.type === 'transfer'">
                · 整合 {{ tx.sourceTransactionIds?.length ?? 0 }} 筆交易
              </ng-container>
            </p>
          </div>
          <p class="amount-lg shrink-0">NT$ {{ tx.totalAmount }}</p>
        </div>
        <p *ngIf="tx.note" class="helper-text mt-3 inset-panel">
          {{ tx.note }}
        </p>
      </div>

      <div *ngIf="tx.type === 'transfer'" class="stack-lg">
        <app-transfer-breakdown
          [edges]="vm.transferEdges"
          [memberRows]="vm.transferMemberRows"
        />
        <div *ngIf="vm.sourceTransactions.length > 0" class="card-stack">
          <p class="card-title">整合來源</p>
          <div class="stack-sm">
            <a
              *ngFor="let src of vm.sourceTransactions"
              [routerLink]="['/transactions', src.id]"
              class="inset-panel block"
            >
              <p class="item-title text-sm">{{ src.title }}</p>
              <p class="caption-text">NT$ {{ src.totalAmount }}</p>
            </a>
          </div>
        </div>
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
        <div class="flex items-center justify-between gap-3">
          <p class="card-title mb-0">分攤</p>
          <app-view-switch
            [options]="splitViewOptions"
            [value]="splitView"
            (valueChange)="setSplitView($event)"
          />
        </div>

        <ng-container *ngIf="splitView === 'detail'">
          <div
            *ngFor="let p of tx.participants"
            class="inset-panel mt-3"
            [class.opacity-60]="p.amount === 0"
          >
            <div class="flex items-center justify-between gap-3">
              <div class="flex items-center gap-2 body-text">
                <ng-container *ngIf="auth.getMember(p.memberId) as m">
                  <app-member-avatar [member]="m" />
                  <span>{{ m.name }}</span>
                  <span *ngIf="isAdvancePayer(tx, p.memberId)" class="chip bg-mint/30 text-xs">代墊者</span>
                </ng-container>
              </div>
              <div class="text-right">
                <p *ngIf="p.amount === 0 && !isAdvancePayer(tx, p.memberId)" class="caption-text">免分攤</p>
                <ng-container *ngIf="memberNet(tx, p.memberId) as net">
                  <p
                    *ngIf="net !== 0"
                    class="text-base font-bold tabular-nums"
                    [class.text-debt]="net < 0"
                    [class.text-positive]="net > 0"
                  >
                    <ng-container *ngIf="net < 0">{{ formatOwe(-net) }}</ng-container>
                    <ng-container *ngIf="net > 0">+{{ formatOwed(net) }}</ng-container>
                  </p>
                  <p *ngIf="net === 0 && isAdvancePayer(tx, p.memberId)" class="caption-text">無需收回</p>
                </ng-container>
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
        </ng-container>

        <ng-container *ngIf="splitView === 'interest'">
          <div
            *ngFor="let p of owingParticipants(tx)"
            class="inset-panel mt-3"
          >
            <div class="flex items-center gap-2 pb-2">
              <ng-container *ngIf="auth.getMember(p.memberId) as m">
                <app-member-avatar [member]="m" size="sm" />
                <p class="item-title">{{ m.name }}</p>
              </ng-container>
              <span class="amount-highlight ml-auto text-sm text-debt">{{
                formatOwe(p.amount)
              }}</span>
            </div>
            <app-interest-estimate [principal]="p.amount" [showPrincipal]="false" />
          </div>
          <p
            *ngIf="owingParticipants(tx).length === 0"
            class="helper-text mt-3 text-center"
          >
            此筆無需試算利息的分攤
          </p>
        </ng-container>
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
      </ng-container>

      <ng-template #notFound>
        <a routerLink="/transactions" class="back-link">← 返回</a>
        <p class="helper-text mt-4 text-center">找不到此筆交易</p>
      </ng-template>
    </div>
  `,
})
export class TransactionDetailComponent {
  typeLabel = transactionTypeLabel;
  splitView: 'detail' | 'interest' = 'detail';
  splitViewOptions = [
    { id: 'detail', label: '分攤明細' },
    { id: 'interest', label: '利息試算' },
  ];

  vm$ = this.route.paramMap.pipe(
    switchMap((params) =>
      this.transactions.transactions$.pipe(
        map((list) => this.buildVm(list, params.get('id')))
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

  private buildVm(list: Transaction[], id: string | null): TransactionDetailVm {
    const tx = id ? list.find((t) => t.id === id) : undefined;
    if (!tx || tx.type !== 'transfer') {
      return {
        tx,
        transferEdges: [],
        transferMemberRows: [],
        sourceTransactions: [],
      };
    }

    const breakdown = TransferBreakdownComponent.fromTransaction(tx);
    const sourceTransactions = (tx.sourceTransactionIds ?? [])
      .map((sourceId) => list.find((t) => t.id === sourceId))
      .filter((t): t is Transaction => !!t);

    return {
      tx,
      transferEdges: breakdown.edges,
      transferMemberRows: breakdown.memberRows,
      sourceTransactions,
    };
  }

  owingParticipants(tx: Transaction): TransactionParticipant[] {
    const payerIds = new Set(getAdvancePayers(tx).map((p) => p.memberId));
    return tx.participants.filter(
      (p) => p.amount > 0 && !payerIds.has(p.memberId)
    );
  }

  advancePayersLabel(tx: Transaction): string {
    return formatAdvancePayersDetail(tx, (id) => this.auth.getMember(id)?.name ?? id);
  }

  isAdvancePayer(tx: Transaction, memberId: string): boolean {
    return getAdvancePayers(tx).some((p) => p.memberId === memberId);
  }

  formatOwe(amount: number): string {
    return formatOweAmount(amount);
  }

  formatOwed(amount: number): string {
    return formatOwedAmount(amount);
  }

  memberNet(tx: Transaction, memberId: string): number {
    return (
      memberNetRowsForTransaction(tx).find((r) => r.memberId === memberId)?.net ?? 0
    );
  }

  setSplitView(view: string): void {
    this.splitView = view as 'detail' | 'interest';
  }

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
