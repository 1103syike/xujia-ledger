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
import { AuthService } from '../../core/services/auth.service';
import {
  formatOweAmount,
  formatOwedAmount,
} from '../../core/utils/settlement-display';
import { Transaction } from '../../core/models';
import { transactionsBetweenMembers } from '../../core/utils/ledger-calculator';
import { MemberAvatarComponent } from './member-avatar.component';
import { InterestEstimateComponent } from './interest-estimate.component';
import { ViewSwitchComponent } from './view-switch.component';
import { InlineTransactionListComponent } from './inline-transaction-list.component';

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
  template: `
    <div
      *ngIf="open"
      class="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      [attr.aria-label]="title"
    >
      <button
        type="button"
        class="absolute inset-0 bg-ink/25 backdrop-blur-[2px]"
        aria-label="關閉"
        (click)="close()"
      ></button>

      <div
        class="sheet-panel absolute bottom-0 left-0 right-0 mx-auto max-w-md rounded-t-3xl bg-white shadow-2xl"
        (click)="$event.stopPropagation()"
      >
        <div class="flex justify-center pt-3">
          <span class="h-1 w-10 rounded-full bg-peach/40"></span>
        </div>

        <div class="px-5 pb-3 pt-2">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0 flex-1">
              <h3 class="sheet-title">{{ title }}</h3>
              <p *ngIf="subtitle" class="helper-text mt-1">{{ subtitle }}</p>
            </div>
            <button
              type="button"
              class="caption-text shrink-0 rounded-full px-3 py-1 active:bg-cream"
              (click)="close()"
            >
              關閉
            </button>
          </div>

          <div
            *ngIf="mode === 'debt-breakdown' && subjectMemberId"
            class="mt-3 flex items-center gap-3 rounded-2xl bg-cream/80 px-4 py-3"
          >
            <ng-container *ngIf="auth.getMember(subjectMemberId) as subject">
              <app-member-avatar [member]="subject" size="md" />
              <div class="min-w-0 flex-1">
                <p class="item-title">{{ subject.name }}</p>
                <p class="caption-text">淨待結算合計</p>
              </div>
            </ng-container>
            <span
              class="amount-highlight shrink-0"
              [class.text-debt]="settlementNetTotal < 0"
              [class.text-positive]="settlementNetTotal > 0"
            >
              <ng-container *ngIf="settlementNetTotal < 0">{{
                formatOweAmount(-settlementNetTotal)
              }}</ng-container>
              <ng-container *ngIf="settlementNetTotal > 0">+{{
                formatOwedAmount(settlementNetTotal)
              }}</ng-container>
              <ng-container *ngIf="settlementNetTotal === 0">已結清</ng-container>
            </span>
          </div>

          <div
            *ngIf="mode === 'pair' && pair as p"
            class="mt-3 flex items-center gap-3 rounded-2xl bg-cream/80 px-4 py-3"
          >
            <ng-container *ngIf="auth.getMember(p.otherId) as other">
              <app-member-avatar [member]="other" size="md" />
              <div class="min-w-0 flex-1">
                <p class="item-title">{{ other.name }}</p>
                <p class="caption-text">
                  {{ p.direction === 'owe' ? '你尚欠' : '尚欠你' }}
                </p>
              </div>
            </ng-container>
            <span
              class="amount-highlight shrink-0"
              [class.text-debt]="p.direction === 'owe'"
              [class.text-positive]="p.direction === 'owed'"
            >
              {{
                p.direction === 'owe'
                  ? formatOweAmount(p.amount)
                  : formatOwedAmount(p.amount)
              }}
            </span>
          </div>
        </div>

        <div class="px-5 pb-2">
          <app-view-switch
            [options]="viewOptions"
            [value]="contentView"
            (valueChange)="setContentView($event)"
          />
        </div>

        <div class="max-h-[55vh] overflow-y-auto px-3 pb-2">
          <div *ngIf="mode === 'debt-breakdown' && contentView === 'detail'" class="stack-sm">
            <section
              *ngFor="let row of settlementRows"
              class="settlement-creditor-group"
            >
              <div class="settlement-creditor-group__head">
                <ng-container *ngIf="auth.getMember(row.otherId) as other">
                  <app-member-avatar [member]="other" size="sm" />
                  <div class="min-w-0 flex-1">
                    <p class="item-title">
                      <ng-container *ngIf="row.direction === 'owe'">
                        欠 {{ other.name }}
                        <span class="amount-highlight text-sm text-debt">{{
                          formatOweAmount(row.amount)
                        }}</span>
                      </ng-container>
                      <ng-container *ngIf="row.direction === 'owed'">
                        {{ other.name }} 欠我
                        <span class="amount-highlight text-sm text-positive">+{{
                          formatOwedAmount(row.amount)
                        }}</span>
                      </ng-container>
                    </p>
                    <p class="caption-text">淨待結算 · 以下為相關交易</p>
                  </div>
                </ng-container>
              </div>
              <app-inline-transaction-list
                [compact]="true"
                [transactions]="settlementTxByOther.get(row.otherId) || emptyTx"
                [viewerId]="subjectMemberId ?? ''"
                [counterpartyId]="row.otherId"
                emptyText="尚無相關交易"
                (navigated)="close()"
              />
            </section>
            <p
              *ngIf="settlementRows.length === 0"
              class="helper-text px-2 py-4 text-center"
            >
              目前沒有待結算款項
            </p>
          </div>

          <div *ngIf="mode === 'debt-breakdown' && contentView === 'interest'" class="stack-sm">
            <app-interest-estimate
              *ngIf="settlementNetDebt > 0"
              [principal]="settlementNetDebt"
            />
            <p
              *ngIf="settlementNetDebt === 0"
              class="helper-text px-2 py-4 text-center"
            >
              目前沒有待結算欠款，無需試算利息
            </p>
          </div>

          <ng-container *ngIf="mode === 'pair' && pair as p">
            <div *ngIf="contentView === 'detail'" class="stack-sm">
              <p class="caption-text px-1">以下為組成這筆待結算的交易</p>
              <app-inline-transaction-list
                [compact]="true"
                [transactions]="pairTxList"
                [viewerId]="p.viewerId"
                [counterpartyId]="p.otherId"
                emptyText="與對方尚無相關交易"
                (navigated)="close()"
              />
              <a
                *ngIf="p.direction === 'owe'"
                [routerLink]="['/transactions/new']"
                [queryParams]="{ type: 'repayment', to: p.otherId }"
                class="btn-primary block text-center"
                (click)="close()"
              >
                新增還款
              </a>
            </div>

            <div *ngIf="contentView === 'interest'">
              <app-interest-estimate
                *ngIf="p.direction === 'owe'"
                [principal]="p.amount"
              />
              <p
                *ngIf="p.direction === 'owed'"
                class="helper-text px-2 py-4 text-center"
              >
                對方欠你款項，無需試算利息
              </p>
            </div>
          </ng-container>
        </div>
      </div>
    </div>
  `,
})
export class SettlementSheetComponent implements OnChanges {
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
