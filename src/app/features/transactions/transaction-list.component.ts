import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { combineLatest, map } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { TransactionService } from '../../core/services/transaction.service';
import {
  signedImpactOnMember,
  transactionsBetweenMembers,
} from '../../core/utils/ledger-calculator';
import { isConsolidatable } from '../../core/utils/debt-consolidation';
import { memberNetRowsForTransaction } from '../../core/utils/transaction-member-nets';
import { activeTransactions, transactionTypeLabel } from '../../core/utils/transaction-date';
import {
  formatTransactionListTime,
  groupByTransactionDate,
} from '../../core/utils/transaction-date-groups';
import {
  formatTransactionPaymentDetail,
  formatTransactionSplitDetail,
  formatTransactionStoryLine,
} from '../../core/utils/transaction-summary';
import {
  formatViewerImpact,
  ViewerImpactDisplay,
} from '../../core/utils/transaction-impact';
import { MemberAvatarComponent } from '../../shared/components/member-avatar.component';
import { MemberNetChipsComponent } from '../../shared/components/member-net-chips.component';
import { TransactionDatePipe } from '../../shared/pipes/transaction-date.pipe';
import { KaomojiDecoComponent } from '../../shared/components/kaomoji-deco.component';
import { memberColorSolid } from '../../core/utils/member-color';
import { Transaction } from '../../core/models';
import {
  COPY_ACTIONS,
  COPY_EMPTY,
  COPY_NAV,
  COPY_PAGES,
  COPY_RECORD_TYPE,
  COPY_TERMS,
} from '../../copy';

interface ListEntry {
  tx: Transaction;
  impact: number;
  impactDisplay: ViewerImpactDisplay;
  consolidatable: boolean;
  memberNets: ReturnType<typeof memberNetRowsForTransaction>;
  storyLine: string;
  paymentDetail: string;
  splitDetail: string;
  listTime: string;
}

@Component({
  selector: 'app-transaction-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    TransactionDatePipe,
    KaomojiDecoComponent,
    MemberAvatarComponent,
    MemberNetChipsComponent,
  ],
  templateUrl: './transaction-list.component.html',

})
export class TransactionListComponent implements OnInit {
  emptySalt = 0;
  selectMode = false;
  selectedIds: string[] = [];
  expandedId: string | null = null;
  nav = COPY_NAV;
  actions = COPY_ACTIONS;
  pages = COPY_PAGES;
  terms = COPY_TERMS;
  empty = COPY_EMPTY;
  typeLabel = transactionTypeLabel;
  memberColorSolid = memberColorSolid;

  vm$ = combineLatest([
    this.transactions.transactions$,
    this.auth.currentMember$,
    this.route.queryParamMap,
  ]).pipe(
    map(([transactions, viewer, params]) => {
      const viewerId = viewer?.id ?? '';
      const withMemberId = params.get('with');
      const active = activeTransactions(transactions);
      const otherMembers = this.auth
        .getAllMembers()
        .filter((m) => m.id !== viewerId);
      const withMember = withMemberId
        ? this.auth.getMember(withMemberId)
        : undefined;

      const filtered =
        withMemberId && viewerId
          ? transactionsBetweenMembers(active, viewerId, withMemberId)
          : active;

      const nameOf = (id: string) => this.auth.getMember(id)?.name ?? id;
      const entries: ListEntry[] = filtered.map((tx) => {
        const impact = viewerId ? signedImpactOnMember(tx, viewerId) : 0;
        return {
          tx,
          impact,
          impactDisplay: formatViewerImpact(tx, viewerId),
          consolidatable: isConsolidatable(tx),
          memberNets: memberNetRowsForTransaction(tx),
          storyLine: formatTransactionStoryLine(tx, nameOf),
          paymentDetail: formatTransactionPaymentDetail(tx, nameOf),
          splitDetail: formatTransactionSplitDetail(tx, nameOf),
          listTime: formatTransactionListTime(tx),
        };
      });

      return {
        withMemberId,
        withMember,
        otherMembers,
        consolidatableCount: filtered.filter((tx) => isConsolidatable(tx)).length,
        sections: groupByTransactionDate(entries),
      };
    })
  );

  constructor(
    public auth: AuthService,
    private transactions: TransactionService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      if (params.get('consolidate') === '1') {
        this.enterSelectMode();
      }
      const preselected = params.get('ids');
      if (preselected) {
        this.selectedIds = preselected.split(',').filter(Boolean);
      }
    });
  }

  isExpanded(id: string): boolean {
    return this.expandedId === id;
  }

  toggleExpanded(id: string): void {
    this.expandedId = this.expandedId === id ? null : id;
  }

  enterSelectMode(): void {
    this.selectMode = true;
    this.expandedId = null;
  }

  cancelSelectMode(): void {
    this.selectMode = false;
    this.selectedIds = [];
    void this.router.navigate(['/transactions'], { replaceUrl: true });
  }

  isSelected(id: string): boolean {
    return this.selectedIds.includes(id);
  }

  onRowClick(entry: { tx: { id: string }; consolidatable: boolean }): void {
    if (!this.selectMode || !entry.consolidatable) return;
    this.toggleSelect(entry.tx.id);
  }

  toggleSelect(id: string): void {
    if (this.selectedIds.includes(id)) {
      this.selectedIds = this.selectedIds.filter((x) => x !== id);
    } else {
      this.selectedIds = [...this.selectedIds, id];
    }
  }

  goToConsolidation(): void {
    if (this.selectedIds.length === 0) return;
    const ids = this.selectedIds.join(',');
    this.router.navigate(['/transactions/new'], {
      queryParams: { type: 'transfer', ids },
    });
  }
}
