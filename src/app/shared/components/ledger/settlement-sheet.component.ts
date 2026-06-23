import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import {
  formatOweAmount,
  formatOwedAmount,
} from '../../../core/ledger/settlement-display';
import { Transaction } from '../../../core/models';
import { transactionsBetweenMembers } from '../../../core/ledger/ledger-calculator';
import { MemberAvatarComponent } from '../member/member-avatar.component';
import { InterestEstimateComponent } from './interest-estimate.component';
import { ViewSwitchComponent } from '../form/view-switch.component';
import { InlineTransactionListComponent } from './inline-transaction-list.component';
import { COPY_ACTIONS, COPY_EMPTY, COPY_PAGES } from '../../../copy';

export interface SettlementPairRow {
  otherId: string;
  direction: 'owe' | 'owed';
  amount: number;
}

/** @deprecated 使用 SettlementPairRow */
export type SettlementDebtRow = SettlementPairRow;

export interface PairSettlementView {
  viewerId: string;
  otherId: string;
  direction: 'owe' | 'owed';
  amount: number;
}

@Component({
  selector: 'app-settlement-sheet',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MemberAvatarComponent,
    InterestEstimateComponent,
    ViewSwitchComponent,
    InlineTransactionListComponent,
  ],
  templateUrl: './settlement-sheet.component.html',

})
export class SettlementSheetComponent implements OnChanges {
  empty = COPY_EMPTY;
  actions = COPY_ACTIONS;
  pages = COPY_PAGES;
  @Input() open = false;
  @Input() title = '';
  @Input() subtitle?: string;
  @Input() mode: 'debt-breakdown' | 'pair' = 'debt-breakdown';
  @Input() subjectMemberId?: string;
  @Input() settlementRows: SettlementPairRow[] = [];
  /** @deprecated 使用 settlementRows */
  @Input() set debtRows(rows: SettlementPairRow[]) {
    this.settlementRows = rows;
  }
  @Input() pair: PairSettlementView | null = null;
  @Input() transactions: Transaction[] = [];
  @Output() closed = new EventEmitter<void>();

  formatOweAmount = formatOweAmount;
  formatOwedAmount = formatOwedAmount;
  contentView: 'detail' | 'interest' = 'detail';
  viewOptions = [
    { id: 'detail', label: '明細' },
    { id: 'interest', label: '利息試算' },
  ];
  pairTxList: Transaction[] = [];
  settlementTxByOther = new Map<string, Transaction[]>();
  readonly emptyTx: Transaction[] = [];

  constructor(public auth: AuthService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if ('open' in changes) {
      document.body.style.overflow = this.open ? 'hidden' : '';
      if (this.open) {
        this.contentView = 'detail';
        this.rebuildTransactionCaches();
      }
    }

    if (
      'transactions' in changes ||
      'settlementRows' in changes ||
      'debtRows' in changes ||
      'subjectMemberId' in changes ||
      'pair' in changes ||
      'mode' in changes
    ) {
      this.rebuildTransactionCaches();
    }
  }

  get settlementNetTotal(): number {
    return this.settlementRows.reduce((sum, row) => {
      return row.direction === 'owe' ? sum - row.amount : sum + row.amount;
    }, 0);
  }

  get settlementOweRows(): SettlementPairRow[] {
    return this.settlementRows.filter((row) => row.direction === 'owe');
  }

  /** 淨待結算中尚欠的金額（用於利息試算本金） */
  get settlementNetDebt(): number {
    const net = this.settlementNetTotal;
    return net < 0 ? -net : 0;
  }

  /** @deprecated 使用 settlementNetTotal */
  get debtTotal(): number {
    return -this.settlementNetTotal;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open) this.close();
  }

  close(): void {
    this.closed.emit();
    document.body.style.overflow = '';
  }

  setContentView(view: string): void {
    this.contentView = view as 'detail' | 'interest';
  }

  private rebuildTransactionCaches(): void {
    if (this.pair) {
      this.pairTxList = transactionsBetweenMembers(
        this.transactions,
        this.pair.viewerId,
        this.pair.otherId
      );
    } else {
      this.pairTxList = [];
    }

    const next = new Map<string, Transaction[]>();
    if (this.subjectMemberId) {
      for (const row of this.settlementRows) {
        next.set(
          row.otherId,
          transactionsBetweenMembers(
            this.transactions,
            this.subjectMemberId,
            row.otherId
          )
        );
      }
    }
    this.settlementTxByOther = next;
  }
}
