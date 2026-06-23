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
}
