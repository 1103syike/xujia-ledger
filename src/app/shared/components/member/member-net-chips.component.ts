import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { MemberNetRow } from '../../../core/transactions/transaction-member-nets';
import {
  formatOweAmount,
  formatOwedAmount,
} from '../../../core/ledger/settlement-display';
import {
  memberColorBorder,
  memberColorSoftBg,
} from '../../../core/display/member-color';
import { MemberAvatarComponent } from './member-avatar.component';
import { COPY_TERMS } from '../../../copy';

export type MemberNetChipsLayout = 'grid' | 'stack';

@Component({
  selector: 'app-member-net-chips',
  standalone: true,
  imports: [CommonModule, MemberAvatarComponent],
  templateUrl: './member-net-chips.component.html',

})
export class MemberNetChipsComponent {
  @Input() rows: MemberNetRow[] = [];
  @Input() showName = false;
  @Input() compact = false;
  /** 每列欄數（預設 5，對應家族成員數） */
  @Input() columns = 5;
  @Input() layout: MemberNetChipsLayout = 'grid';
  /** 實際付款人 memberId（顯示金主 Badge，不影響金額） */
  @Input() payerIds: string[] = [];

  readonly payerBadge = COPY_TERMS.payerBadge;
  readonly debtorBadge = COPY_TERMS.debtorBadge;

  formatOwe = formatOweAmount;
  formatOwed = formatOwedAmount;
  memberColorSoftBg = memberColorSoftBg;
  memberColorBorder = memberColorBorder;

  constructor(public auth: AuthService) {}

  get columnCount(): number {
    return Math.max(1, this.columns);
  }

  memberName(id: string): string {
    return this.auth.getMember(id)?.name ?? id;
  }

  rowAmount(row: MemberNetRow): number {
    return row.displayNet ?? row.net;
  }

  isPayer(memberId: string): boolean {
    return this.payerIds.includes(memberId);
  }

  rowStackBadgeKind(row: MemberNetRow): 'payer' | 'debtor' | null {
    if (this.isPayer(row.memberId)) {
      return 'payer';
    }
    if (this.rowAmount(row) < 0) {
      return 'debtor';
    }
    return null;
  }
}
