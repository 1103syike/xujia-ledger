import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { BehaviorSubject, combineLatest, map } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { TransactionService } from '../../../core/services/transaction.service';
import {
  signedImpactOnMember,
  transactionsBetweenMembers,
} from '../../../core/ledger/ledger-calculator';
import { isConsolidatable } from '../../../core/consolidation/debt-consolidation';
import { memberNetRowsForTransaction } from '../../../core/transactions/transaction-member-nets';
import { getAdvancePayers } from '../../../core/transactions/advance-allocation';
import {
  formatRepaymentTitle,
  repaymentCreditorIds,
} from '../../../core/transactions/repayment-display';
import { enrichRepaymentOwedBefore } from '../../../core/ledger/ledger-calculator';
import { activeTransactions, transactionTypeLabel } from '../../../core/transactions/transaction-date';
import {
  formatTransactionListTime,
  formatTransactionPickDate,
  groupByTransactionDate,
} from '../../../core/transactions/transaction-date-groups';
import {
  formatConsolidatePickParticipants,
  formatTransactionStoryLine,
} from '../../../core/transactions/transaction-summary';
import {
  formatViewerImpact,
  ViewerImpactDisplay,
} from '../../../core/transactions/transaction-impact';
import { MemberFilterBarComponent } from '../../../shared/components/member/member-filter-bar.component';
import { MemberNetChipsComponent } from '../../../shared/components/member/member-net-chips.component';
import { ConsolidatePickRowComponent } from '../../../shared/components/ledger/consolidate-pick-row.component';
import { SkeletonComponent } from '../../../shared/components/motion/skeleton.component';
import { KaomojiDecoComponent } from '../../../shared/components/branding/kaomoji-deco.component';
import { Transaction } from '../../../core/models';
import {
  COPY_ACTIONS,
  COPY_EMPTY,
  COPY_NAV,
  COPY_PAGES,
  COPY_TERMS,
} from '../../../copy';
import { prefetchTransactionCreateRoute } from '../../../core/routing/lazy-routes';

interface ListEntry {
  tx: Transaction;
  displayTitle: string;
  impact: number;
  impactDisplay: ViewerImpactDisplay;
  consolidatable: boolean;
  memberNets: ReturnType<typeof memberNetRowsForTransaction>;
  payerIds: string[];
  storyLine: string;
  listTime: string;
  listDate: string;
  participantLine: string;
}

@Component({
  selector: 'app-transaction-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    KaomojiDecoComponent,
    MemberFilterBarComponent,
    MemberNetChipsComponent,
    ConsolidatePickRowComponent,
    SkeletonComponent,
  ],
  templateUrl: './transaction-list.component.html',

})
export class TransactionListComponent implements OnInit {
  emptySalt = 0;
  selectMode = false;
  selectedIds: string[] = [];
  private readonly selectMode$ = new BehaviorSubject(false);
  nav = COPY_NAV;
  actions = COPY_ACTIONS;
  pages = COPY_PAGES;
  terms = COPY_TERMS;
  empty = COPY_EMPTY;
  typeLabel = transactionTypeLabel;

  vm$ = combineLatest([
    this.transactions.transactions$,
    this.auth.currentMember$,
    this.route.queryParamMap,
    this.transactions.dataReady$,
    this.selectMode$,
  ]).pipe(
    map(([transactions, viewer, params, dataReady, selectMode]) => {
      const inSelectMode = selectMode || params.get('consolidate') === '1';
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

      const consolidatableActive = active.filter((tx) => isConsolidatable(tx));
      const filterMembers = inSelectMode
        ? otherMembers.filter((m) =>
            viewerId
              ? transactionsBetweenMembers(
                  consolidatableActive,
                  viewerId,
                  m.id
                ).length > 0
              : false
          )
        : otherMembers;

      const nameOf = (id: string) => this.auth.getMember(id)?.name ?? id;
      let entries: ListEntry[] = filtered.map((tx) => {
        const impact = viewerId
          ? signedImpactOnMember(tx, viewerId, active)
          : 0;
        const enriched =
          tx.type === 'repayment' ? enrichRepaymentOwedBefore(tx, active) : tx;
        const memberNets = memberNetRowsForTransaction(tx, active);
        return {
          tx,
          displayTitle:
            tx.type === 'repayment'
              ? formatRepaymentTitle(enriched)
              : tx.title,
          impact,
          impactDisplay: formatViewerImpact(tx, viewerId, active),
          consolidatable: isConsolidatable(tx),
          memberNets,
          payerIds:
            tx.type === 'advance'
              ? getAdvancePayers(tx).map((p) => p.memberId)
              : tx.type === 'repayment'
                ? repaymentCreditorIds(enriched)
                : [],
          storyLine: formatTransactionStoryLine(tx, nameOf),
          listTime: formatTransactionListTime(tx),
          listDate: formatTransactionPickDate(tx),
          participantLine: formatConsolidatePickParticipants(
            tx,
            nameOf,
            COPY_TERMS.payerBadge
          ),
        };
      });

      if (inSelectMode) {
        entries = entries.filter((e) => e.consolidatable);
      }

      return {
        inSelectMode,
        withMemberId,
        withMember,
        otherMembers: filterMembers,
        dataReady,
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
    prefetchTransactionCreateRoute();
    this.route.queryParamMap.subscribe((params) => {
      if (params.get('consolidate') === '1') {
        this.setSelectMode(true);
      }
      const preselected = params.get('ids');
      if (preselected) {
        this.selectedIds = preselected.split(',').filter(Boolean);
      }
    });
  }

  enterSelectMode(): void {
    void this.router.navigate(['/transactions'], {
      queryParams: { consolidate: '1' },
      queryParamsHandling: 'merge',
    });
  }

  cancelSelectMode(): void {
    this.setSelectMode(false);
    this.selectedIds = [];
    void this.router.navigate(['/transactions'], { replaceUrl: true });
  }

  private setSelectMode(on: boolean): void {
    this.selectMode = on;
    this.selectMode$.next(on);
  }

  isSelected(id: string): boolean {
    return this.selectedIds.includes(id);
  }

  onRowClick(entry: { tx: { id: string } }): void {
    if (!this.selectMode) return;
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
