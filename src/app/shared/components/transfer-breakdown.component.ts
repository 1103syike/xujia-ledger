import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import {
  ConsolidationPreview,
  memberRowsFromTransferEdges,
  transferLineLabel,
} from '../../core/utils/debt-consolidation';
import { MemberAvatarComponent } from './member-avatar.component';
import {
  formatOweAmount,
  formatOwedAmount,
} from '../../core/utils/settlement-display';
import { LineItem, Transaction, TransferEdge } from '../../core/models';

type MemberRow = {
  memberId: string;
  signedAmount: number;
  lineItems: LineItem[];
};

@Component({
  selector: 'app-transfer-breakdown',
  standalone: true,
  imports: [CommonModule, MemberAvatarComponent],
  template: `
    <div *ngIf="edges.length > 0" class="card-stack">
      <p class="card-title">轉帳清單（最少筆數）</p>
      <div class="stack-sm">
        <div
          *ngFor="let e of edges"
          class="inset-panel flex items-center justify-between gap-3"
        >
          <div class="flex min-w-0 items-center gap-2">
            <ng-container *ngIf="auth.getMember(e.fromId) as from">
              <app-member-avatar [member]="from" size="sm" />
              <span class="item-title">{{ from.name }}</span>
            </ng-container>
            <span class="caption-text">→</span>
            <ng-container *ngIf="auth.getMember(e.toId) as to">
              <app-member-avatar [member]="to" size="sm" />
              <span class="item-title">{{ to.name }}</span>
            </ng-container>
          </div>
          <span class="amount-highlight shrink-0 text-sm">NT$ {{ e.amount }}</span>
        </div>
      </div>
    </div>

    <div *ngIf="payers.length > 0 || receivers.length > 0" class="card-stack">
      <p class="card-title">結算明細</p>

      <div *ngIf="payers.length > 0" class="stack-sm">
        <p class="caption-text font-medium text-debt">應付</p>
        <div *ngFor="let row of payers" class="inset-panel">
          <div class="mb-2 flex items-center justify-between gap-2">
            <div class="flex min-w-0 items-center gap-2">
              <ng-container *ngIf="auth.getMember(row.memberId) as m">
                <app-member-avatar [member]="m" size="sm" />
                <span class="item-title truncate">{{ m.name }}</span>
              </ng-container>
            </div>
            <span class="shrink-0 text-sm font-bold tabular-nums text-debt">
              {{ formatOwe(-row.signedAmount) }}
            </span>
          </div>
          <div *ngIf="row.lineItems.length" class="stack-sm border-t border-peach/15 pt-2">
            <div
              *ngFor="let item of row.lineItems"
              class="flex items-center justify-between gap-2 body-text"
            >
              <span class="min-w-0 flex-1 truncate text-debt">{{ lineLabel(item) }}</span>
              <span class="shrink-0 text-debt">NT$ {{ item.amount }}</span>
            </div>
          </div>
        </div>
      </div>

      <div *ngIf="receivers.length > 0" class="stack-sm">
        <p class="caption-text font-medium text-positive">應收</p>
        <div *ngFor="let row of receivers" class="inset-panel">
          <div class="mb-2 flex items-center justify-between gap-2">
            <div class="flex min-w-0 items-center gap-2">
              <ng-container *ngIf="auth.getMember(row.memberId) as m">
                <app-member-avatar [member]="m" size="sm" />
                <span class="item-title truncate">{{ m.name }}</span>
              </ng-container>
            </div>
            <span class="shrink-0 text-sm font-bold tabular-nums text-positive">
              +{{ formatOwed(row.signedAmount) }}
            </span>
          </div>
          <div *ngIf="row.lineItems.length" class="stack-sm border-t border-peach/15 pt-2">
            <div
              *ngFor="let item of row.lineItems"
              class="flex items-center justify-between gap-2 body-text"
            >
              <span class="min-w-0 flex-1 truncate text-positive">{{ lineLabel(item) }}</span>
              <span class="shrink-0 text-positive">NT$ {{ item.amount }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class TransferBreakdownComponent {
  @Input() edges: TransferEdge[] = [];
  @Input() memberRows: MemberRow[] = [];

  formatOwe = formatOweAmount;
  formatOwed = formatOwedAmount;

  constructor(public auth: AuthService) {}

  get payers(): MemberRow[] {
    return this.memberRows
      .filter((r) => r.signedAmount < 0)
      .sort((a, b) => a.signedAmount - b.signedAmount);
  }

  get receivers(): MemberRow[] {
    return this.memberRows
      .filter((r) => r.signedAmount > 0)
      .sort((a, b) => b.signedAmount - a.signedAmount);
  }

  lineLabel(item: LineItem): string {
    return transferLineLabel(item, (id) => this.auth.getMember(id)?.name ?? id);
  }

  static fromPreview(preview: ConsolidationPreview): {
    edges: TransferEdge[];
    memberRows: MemberRow[];
  } {
    return {
      edges: preview.edges,
      memberRows: preview.members,
    };
  }

  static fromTransaction(tx: Transaction): {
    edges: TransferEdge[];
    memberRows: MemberRow[];
  } {
    const edges = tx.transferEdges ?? [];
    const fromParticipants = tx.participants.map((p) => ({
      memberId: p.memberId,
      signedAmount: p.signedAmount ?? 0,
      lineItems: p.lineItems ?? [],
    }));

    if (fromParticipants.length > 0) {
      return { edges, memberRows: fromParticipants };
    }

    if (edges.length > 0) {
      return { edges, memberRows: memberRowsFromTransferEdges(edges) };
    }

    return { edges, memberRows: [] };
  }
}
