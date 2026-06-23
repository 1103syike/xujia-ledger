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
  templateUrl: './transfer-breakdown.component.html',

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
