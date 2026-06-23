import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { combineLatest, map } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { TransactionService } from '../../core/services/transaction.service';
import { netBalances, settlementsForMember, signedImpactOnMember } from '../../core/utils/ledger-calculator';
import {
  formatOweAmount,
  formatOwedAmount,
} from '../../core/utils/settlement-display';
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
import { activeTransactions, transactionTypeLabel } from '../../core/utils/transaction-date';
import { formatAdvancePayerNames } from '../../core/utils/advance-display';
import { memberNetRowsForTransaction } from '../../core/utils/transaction-member-nets';
import { MemberAvatarComponent } from '../../shared/components/member-avatar.component';
import { MemberNetChipsComponent } from '../../shared/components/member-net-chips.component';
import { TransactionDatePipe } from '../../shared/pipes/transaction-date.pipe';
import { KaomojiDecoComponent } from '../../shared/components/kaomoji-deco.component';
import {
  memberColorBorder,
  memberColorSoftBg,
  memberColorSolid,
} from '../../core/utils/member-color';
import { SettlementEntry, Transaction } from '../../core/models';
import {
  PairSettlementView,
  SettlementPairRow,
  SettlementSheetComponent,
} from '../../shared/components/settlement-sheet.component';
import {
  COPY_ACTIONS,
  COPY_EMPTY,
  COPY_PAGES,
} from '../../copy';

interface LatestEntry {
  tx: Transaction;
  impact: number;
  memberNets: ReturnType<typeof memberNetRowsForTransaction>;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MemberAvatarComponent,
    TransactionDatePipe,
    KaomojiDecoComponent,
    SettlementSheetComponent,
    MemberNetChipsComponent,
  ],
  templateUrl: './dashboard.component.html',

})
export class DashboardComponent {
  actions = COPY_ACTIONS;
  pages = COPY_PAGES;
  empty = COPY_EMPTY;
  formatOweAmount = formatOweAmount;
  formatOwedAmount = formatOwedAmount;
  rankTitle = rankTitle;
  quoteCounts = quoteCounts();
  typeLabel = transactionTypeLabel;
  memberColorSolid = memberColorSolid;
  memberColorSoftBg = memberColorSoftBg;
  memberColorBorder = memberColorBorder;
  copiedId: string | null = null;
  rankSalt = 0;
  debtorCardSalt = 0;
  clearSalt = 0;
  debtorSalts: Record<string, number> = {};
  sheetOpen = false;
  sheetMode: 'debt-breakdown' | 'pair' = 'debt-breakdown';
  sheetTitle = '';
  sheetSubtitle?: string;
  sheetSubjectId = '';
  sheetSettlementRows: SettlementPairRow[] = [];
  sheetPair: PairSettlementView | null = null;
  sheetTransactions: Transaction[] = [];

  vm$ = combineLatest([
    this.transactions.transactions$,
    this.auth.currentMember$,
  ]).pipe(
    map(([transactions, member]) => {
      const active = activeTransactions(transactions);
      const memberId = member?.id ?? '';

      const latestEntries: LatestEntry[] = active
        .slice(0, 3)
        .map((tx) => ({
          tx,
          impact: memberId ? signedImpactOnMember(tx, memberId) : 0,
          memberNets: memberNetRowsForTransaction(tx),
        }));

      return {
        memberId,
        activeTransactions: active,
        balances: netBalances(active),
        mySettlements: memberId ? settlementsForMember(active, memberId) : [],
        debtRanking: totalDebtRanking(active),
        myDebtors: memberId ? debtorsToCreditor(active, memberId) : [],
        latestEntries,
      };
    })
  );

  constructor(
    public auth: AuthService,
    private transactions: TransactionService
  ) {}

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
    this.debtorSalts = { ...this.debtorSalts, [debtorId]: (this.debtorSalts[debtorId] ?? 0) + 1 };
  }

  rankQuipLine(memberId: string, index: number): string {
    return rankQuip(memberId, index, this.rankSalt);
  }

  openPairSettlement(
    active: Transaction[],
    memberId: string,
    settlement: SettlementEntry
  ): void {
    const name = this.auth.getMember(settlement.otherId)?.name ?? '';
    this.sheetMode = 'pair';
    this.sheetTitle = this.pages.settlementWith(name);
    this.sheetSubtitle = undefined;
    this.sheetPair = {
      viewerId: memberId,
      otherId: settlement.otherId,
      direction: settlement.direction,
      amount: settlement.amount,
    };
    this.sheetSubjectId = '';
    this.sheetSettlementRows = [];
    this.sheetTransactions = active;
    this.sheetOpen = true;
  }

  openDebtBreakdown(active: Transaction[], memberId: string): void {
    const name = this.auth.getMember(memberId)?.name ?? '';
    this.sheetMode = 'debt-breakdown';
    this.sheetTitle = this.pages.memberPendingDetail(name);
    this.sheetSubtitle = this.pages.settlementDetailHint;
    this.sheetSubjectId = memberId;
    this.sheetSettlementRows = settlementsForMember(active, memberId)
      .map((s) => ({
        otherId: s.otherId,
        direction: s.direction,
        amount: s.amount,
      }))
      .sort((a, b) => {
        if (a.direction !== b.direction) {
          return a.direction === 'owe' ? -1 : 1;
        }
        return b.amount - a.amount;
      });
    this.sheetPair = null;
    this.sheetTransactions = active;
    this.sheetOpen = true;
  }

  closeSheet(): void {
    this.sheetOpen = false;
  }

  debtorQuipLine(debtorId: string, creditorId: string): string {
    return debtorCardQuip(debtorId, creditorId, this.debtorCardSalt);
  }

  clearQuipLine(memberId: string): string {
    if (!memberId) return `${this.pages.noPendingSettlement}，${this.pages.ledgerHealthy}。`;
    return allClearQuip(memberId, this.clearSalt);
  }

  advancePayerNames(tx: import('../../core/models').Transaction): string {
    return formatAdvancePayerNames(tx, (id) => this.auth.getMember(id)?.name ?? id);
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
