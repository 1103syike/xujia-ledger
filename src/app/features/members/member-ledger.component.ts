import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { combineLatest, map } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { TransactionService } from '../../core/services/transaction.service';
import {
  pairwiseSettlement,
  signedImpactOnMember,
  transactionsBetweenMembers,
} from '../../core/utils/ledger-calculator';
import {
  formatOweAmount,
  formatOwedAmount,
} from '../../core/utils/settlement-display';
import { activeTransactions, transactionTypeLabel } from '../../core/utils/transaction-date';
import { MemberAvatarComponent } from '../../shared/components/member-avatar.component';
import { TransactionDatePipe } from '../../shared/pipes/transaction-date.pipe';
import { COPY_ACTIONS, COPY_NAV, COPY_PAGES } from '../../copy';

@Component({
  selector: 'app-member-ledger',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MemberAvatarComponent,
    TransactionDatePipe,
  ],
  templateUrl: './member-ledger.component.html',

})
export class MemberLedgerComponent {
  nav = COPY_NAV;
  actions = COPY_ACTIONS;
  pages = COPY_PAGES;
  formatOweAmount = formatOweAmount;
  formatOwedAmount = formatOwedAmount;
  typeLabel = transactionTypeLabel;

  vm$ = combineLatest([
    this.route.paramMap,
    this.transactions.transactions$,
    this.auth.currentMember$,
  ]).pipe(
    map(([params, txs, viewer]) => {
      const memberId = params.get('id') ?? '';
      const viewerId = viewer?.id ?? '';
      const active = activeTransactions(txs);
      const related =
        viewerId && memberId
          ? transactionsBetweenMembers(active, viewerId, memberId)
          : [];
      const settlement = viewerId
        ? pairwiseSettlement(active, viewerId, memberId)
        : null;

      return {
        memberId,
        viewerId,
        settlement,
        entries: related.map((tx) => ({
          tx,
          impact: viewerId ? signedImpactOnMember(tx, viewerId) : 0,
        })),
      };
    })
  );

  constructor(
    public auth: AuthService,
    private transactions: TransactionService,
    private route: ActivatedRoute
  ) {}
}
