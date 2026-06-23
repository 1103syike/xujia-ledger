import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { MemberNetRow } from '../../core/utils/transaction-member-nets';
import {
  formatOweAmount,
  formatOwedAmount,
} from '../../core/utils/settlement-display';
import {
  memberColorBorder,
  memberColorSoftBg,
} from '../../core/utils/member-color';
import { MemberAvatarComponent } from './member-avatar.component';

@Component({
  selector: 'app-member-net-chips',
  standalone: true,
  imports: [CommonModule, MemberAvatarComponent],
  template: `
    <div
      *ngIf="rows.length > 0"
      class="member-net-chips"
      [class.mt-3]="!compact"
      [style.--member-net-cols]="columnCount"
    >
      <div
        *ngFor="let row of rows"
        class="member-net-chip"
        [class.text-debt]="row.net < 0"
        [class.text-positive]="row.net > 0"
        [style.background-color]="
          memberColorSoftBg(auth.getMember(row.memberId)?.color || '')
        "
        [style.box-shadow]="
          'inset 0 0 0 1px ' +
          memberColorBorder(auth.getMember(row.memberId)?.color || '')
        "
      >
        <app-member-avatar
          *ngIf="auth.getMember(row.memberId) as member"
          [member]="member"
          size="xs"
        />
        <span *ngIf="showName" class="member-net-chip__name">{{
          memberName(row.memberId)
        }}</span>
        <span class="member-net-chip__amount">
          <ng-container *ngIf="row.net < 0">{{ formatOwe(-row.net) }}</ng-container>
          <ng-container *ngIf="row.net > 0">{{ formatOwed(row.net) }}</ng-container>
        </span>
      </div>
    </div>
  `,
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
}
