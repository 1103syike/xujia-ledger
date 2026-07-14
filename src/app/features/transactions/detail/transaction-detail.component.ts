import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { combineLatest, map } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { TransactionService } from '../../../core/services/transaction.service';
import { MemberAvatarComponent } from '../../../shared/components/member/member-avatar.component';
import { SplitPieChartComponent } from '../../../shared/components/ledger/split-pie-chart.component';
import { ConfirmDialogComponent } from '../../../shared/components/form/confirm-dialog.component';
import { TransactionDatePipe } from '../../../shared/pipes/transaction-date.pipe';
import { transactionTypeLabel } from '../../../core/transactions/transaction-date';
import { formatOweAmount, formatOwedAmount } from '../../../core/ledger/settlement-display';
import { participantLineItemsWithChange } from '../../../core/transactions/advance-display';
import { formatTransactionStoryLine } from '../../../core/transactions/transaction-summary';
import { getAdvancePayers, memberNetDisplayAmount, advanceChangeShareByMember } from '../../../core/transactions/advance-allocation';
import { memberNetRowsForTransaction } from '../../../core/transactions/transaction-member-nets';
import { formatRepaymentTitle } from '../../../core/transactions/repayment-display';
import { enrichRepaymentOwedBefore } from '../../../core/ledger/ledger-calculator';
import { LineItem, Transaction, TransactionParticipant, TransferEdge } from '../../../core/models';
import { activeTransactions } from '../../../core/transactions/transaction-date';
import { InterestEstimateComponent } from '../../../shared/components/ledger/interest-estimate.component';
import { ViewSwitchComponent } from '../../../shared/components/form/view-switch.component';
import { TransferBreakdownComponent } from '../../../shared/components/ledger/transfer-breakdown.component';
import { SkeletonComponent } from '../../../shared/components/motion/skeleton.component';
import {
  COPY_ACTIONS,
  COPY_DIALOGS,
  COPY_EMPTY,
  COPY_PAGES,
  COPY_TERMS,
} from '../../../copy';

interface TransferMemberRow {
  memberId: string;
  signedAmount: number;
  lineItems: LineItem[];
}

interface TransactionDetailVm {
  tx: Transaction | undefined;
  activeList: Transaction[];
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
    SkeletonComponent,
  ],
  templateUrl: './transaction-detail.component.html',

})
export class TransactionDetailComponent {
  actions = COPY_ACTIONS;
  pages = COPY_PAGES;
  terms = COPY_TERMS;
  dialogs = COPY_DIALOGS;
  empty = COPY_EMPTY;
  typeLabel = transactionTypeLabel;
  splitView: 'detail' | 'interest' = 'detail';
  splitViewOptions = [
    { id: 'detail', label: COPY_PAGES.eachAmount },
    { id: 'interest', label: '利息試算' },
  ];

  vm$ = combineLatest([
    this.route.paramMap,
    this.transactions.transactions$,
    this.transactions.dataReady$,
  ]).pipe(
    map(([params, list, dataReady]) => ({
      ...this.buildVm(list, params.get('id')),
      dataReady,
    }))
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
    const activeList = activeTransactions(list);
    if (!tx || tx.type !== 'transfer') {
      return {
        tx,
        activeList,
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
      activeList,
      transferEdges: breakdown.edges,
      transferMemberRows: breakdown.memberRows,
      sourceTransactions,
    };
  }

  displayTitle(tx: Transaction, activeList: Transaction[]): string {
    if (tx.type !== 'repayment') return tx.title;
    return formatRepaymentTitle(enrichRepaymentOwedBefore(tx, activeList));
  }

  owingParticipants(tx: Transaction): TransactionParticipant[] {
    const payerIds = new Set(getAdvancePayers(tx).map((p) => p.memberId));
    return tx.participants.filter(
      (p) => p.amount > 0 && !payerIds.has(p.memberId)
    );
  }

  storyLine(tx: Transaction, activeList: Transaction[] = []): string {
    const viewTx =
      tx.type === 'repayment'
        ? enrichRepaymentOwedBefore(tx, activeList)
        : tx;
    return formatTransactionStoryLine(
      viewTx,
      (id) => this.auth.getMember(id)?.name ?? id
    );
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

  memberDisplayNet(tx: Transaction, memberId: string): number {
    return memberNetDisplayAmount(tx, memberId);
  }

  payerChangeShare(tx: Transaction, memberId: string): number | null {
    if (!this.isAdvancePayer(tx, memberId)) return null;
    const share = advanceChangeShareByMember(tx).get(memberId) ?? 0;
    return share > 0 ? share : null;
  }

  participantLineItems(
    tx: Transaction,
    p: TransactionParticipant
  ): LineItem[] {
    return participantLineItemsWithChange(tx, p);
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
