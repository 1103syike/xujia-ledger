import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Transaction } from '../../../core/models';
import { AuthService } from '../../../core/services/auth.service';
import { signedImpactOnMember, signedImpactOnPair, enrichRepaymentOwedBefore } from '../../../core/ledger/ledger-calculator';
import { transactionTypeLabel } from '../../../core/transactions/transaction-date';
import { formatAdvancePayerNames } from '../../../core/transactions/advance-display';
import { formatRepaymentTitle } from '../../../core/transactions/repayment-display';
import {
  formatOweAmount,
  formatOwedAmount,
} from '../../../core/ledger/settlement-display';
import {
  memberColorBorder,
  memberColorSoftBg,
} from '../../../core/display/member-color';
import { MemberAvatarComponent } from '../member/member-avatar.component';
import { TransactionDatePipe } from '../../../shared/pipes/transaction-date.pipe';
import { COPY_EMPTY, COPY_SPLIT, COPY_TERMS } from '../../../copy';

export interface InlineTransactionEntry {
  tx: Transaction;
  displayTitle: string;
  impact: number;
  splitParticipants: { memberId: string; amount: number }[];
}

@Component({
  selector: 'app-inline-transaction-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MemberAvatarComponent,
    TransactionDatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './inline-transaction-list.component.html',

})
export class InlineTransactionListComponent implements OnChanges {
  split = COPY_SPLIT;
  terms = COPY_TERMS;
  @Input({ required: true }) transactions: Transaction[] = [];
  @Input({ required: true }) viewerId = '';
  @Input() counterpartyId = '';
  @Input() emptyText: string = COPY_EMPTY.noRelatedRecords;
  @Input() compact = false;
  @Output() navigated = new EventEmitter<void>();

  entries: InlineTransactionEntry[] = [];

  typeLabel = transactionTypeLabel;
  formatOweAmount = formatOweAmount;
  formatOwedAmount = formatOwedAmount;
  memberColorSoftBg = memberColorSoftBg;
  memberColorBorder = memberColorBorder;

  constructor(public auth: AuthService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['transactions'] || changes['viewerId'] || changes['counterpartyId']) {
      this.rebuildEntries();
    }
  }

  trackEntry(_index: number, entry: InlineTransactionEntry): string {
    return entry.tx.id;
  }

  trackParticipant(_index: number, p: { memberId: string }): string {
    return p.memberId;
  }

  private rebuildEntries(): void {
    this.entries = this.transactions.map((tx) => ({
      tx,
      displayTitle:
        tx.type === 'repayment'
          ? formatRepaymentTitle(
              enrichRepaymentOwedBefore(tx, this.transactions)
            )
          : tx.title,
      impact: this.viewerId
        ? this.counterpartyId
          ? signedImpactOnPair(tx, this.viewerId, this.counterpartyId)
          : signedImpactOnMember(tx, this.viewerId, this.transactions)
        : 0,
      splitParticipants:
        tx.type === 'advance'
          ? tx.participants.filter((p) => p.amount > 0)
          : [],
    }));
  }

  advancePayerNames(tx: Transaction): string {
    return formatAdvancePayerNames(tx, (id) => this.auth.getMember(id)?.name ?? id);
  }

  transferPairLabel(entry: InlineTransactionEntry): string | null {
    if (!this.counterpartyId || entry.tx.type !== 'transfer') return null;
    const otherName =
      this.auth.getMember(this.counterpartyId)?.name ?? '對方';
    if (entry.impact < 0) return `付給 ${otherName}`;
    if (entry.impact > 0) return `收自 ${otherName}`;
    return null;
  }
}
