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
import { Transaction } from '../../core/models';
import { AuthService } from '../../core/services/auth.service';
import { signedImpactOnMember, signedImpactOnPair } from '../../core/utils/ledger-calculator';
import { transactionTypeLabel } from '../../core/utils/transaction-date';
import { formatAdvancePayerNames } from '../../core/utils/advance-display';
import {
  formatOweAmount,
  formatOwedAmount,
} from '../../core/utils/settlement-display';
import {
  memberColorBorder,
  memberColorSoftBg,
} from '../../core/utils/member-color';
import { MemberAvatarComponent } from './member-avatar.component';
import { TransactionDatePipe } from '../pipes/transaction-date.pipe';

export interface InlineTransactionEntry {
  tx: Transaction;
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
  template: `
    <div *ngIf="entries.length === 0" class="helper-text py-3 text-center">
      {{ emptyText }}
    </div>

    <div [class.stack-sm]="!compact" [class.settlement-tx-list]="compact">
      <a
        *ngFor="let entry of entries; trackBy: trackEntry"
        [routerLink]="['/transactions', entry.tx.id]"
        class="block transition active:scale-[0.99]"
        [class.inset-panel]="!compact"
        [class.settlement-tx-row]="compact"
        (click)="navigated.emit()"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <p class="item-title text-sm">{{ entry.tx.title }}</p>
              <span class="chip bg-cream text-xs">{{ typeLabel(entry.tx.type) }}</span>
            </div>
            <p class="caption-text mt-1">
              {{ entry.tx | transactionDate }}
              <ng-container *ngIf="entry.tx.type === 'advance'">
                · {{ entry.tx.splitMode === 'equal' ? '平分' : '細分' }}
                · {{ advancePayerNames(entry.tx) }} 代墊
              </ng-container>
              <ng-container *ngIf="entry.tx.type === 'repayment'">
                · {{ auth.getMember(entry.tx.fromMemberId ?? '')?.name }}
                還給 {{ auth.getMember(entry.tx.payerId)?.name }}
              </ng-container>
              <ng-container *ngIf="entry.tx.type === 'transfer'">
                · 整合 {{ entry.tx.sourceTransactionIds?.length ?? 0 }} 筆交易
                <ng-container *ngIf="counterpartyId && transferPairLabel(entry) as label">
                  · {{ label }}
                </ng-container>
              </ng-container>
            </p>
          </div>
          <div class="shrink-0 text-right">
            <p *ngIf="compact" class="caption-text mb-0.5">此筆待結算</p>
            <span
              class="text-sm"
              [class.amount-md]="entry.impact !== 0"
              [class.amount-neutral]="entry.impact === 0"
              [class.text-debt]="entry.impact < 0"
              [class.text-positive]="entry.impact > 0"
            >
              <ng-container *ngIf="entry.impact < 0">{{
                formatOweAmount(-entry.impact)
              }}</ng-container>
              <ng-container *ngIf="entry.impact > 0">+{{
                formatOwedAmount(entry.impact)
              }}</ng-container>
              <ng-container *ngIf="entry.impact === 0">—</ng-container>
            </span>
          </div>
        </div>
        <div
          *ngIf="!compact && entry.splitParticipants.length > 0"
          class="mt-2 flex flex-wrap gap-1.5"
        >
          <span
            *ngFor="let p of entry.splitParticipants; trackBy: trackParticipant"
            class="chip inline-flex items-center gap-1 text-xs"
            [style.background-color]="
              memberColorSoftBg(auth.getMember(p.memberId)?.color || '')
            "
            [style.box-shadow]="
              'inset 0 0 0 1px ' +
              memberColorBorder(auth.getMember(p.memberId)?.color || '')
            "
          >
            <app-member-avatar
              *ngIf="auth.getMember(p.memberId) as splitMember"
              [member]="splitMember"
              size="xs"
            />
            NT$ {{ p.amount }}
          </span>
        </div>
      </a>
    </div>
  `,
})
export class InlineTransactionListComponent implements OnChanges {
  @Input({ required: true }) transactions: Transaction[] = [];
  @Input({ required: true }) viewerId = '';
  @Input() counterpartyId = '';
  @Input() emptyText = '尚無相關交易';
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
      impact: this.viewerId
        ? this.counterpartyId
          ? signedImpactOnPair(tx, this.viewerId, this.counterpartyId)
          : signedImpactOnMember(tx, this.viewerId)
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
