import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Member } from '../../core/models';
import { AuthService } from '../../core/services/auth.service';
import { memberColorSolid, memberColorBorder } from '../../core/utils/member-color';
import { MemberAvatarComponent } from './member-avatar.component';

export interface PieSliceInput {
  memberId: string;
  amount: number;
}

interface PieSegment {
  memberId: string;
  amount: number;
  percent: number;
  color: string;
  label: string;
  member?: Member;
  isUnassigned?: boolean;
}

@Component({
  selector: 'app-split-pie-chart',
  standalone: true,
  imports: [CommonModule, MemberAvatarComponent],
  template: `
    <div *ngIf="segments.length > 0" class="py-2">
      <div class="flex flex-col items-center">
        <div
          class="relative h-40 w-40 rounded-full"
          [style.background]="conicGradient"
          role="img"
          [attr.aria-label]="chartLabel"
        >
          <div
            class="absolute inset-6 flex flex-col items-center justify-center rounded-full bg-white text-center shadow-sm"
          >
            <span class="caption-text">帳單總額</span>
            <span class="amount-md">NT$ {{ chartTotal }}</span>
            <span *ngIf="unassignedAmount > 0" class="caption-text mt-0.5">
              已分攤 NT$ {{ assignedTotal }}
            </span>
          </div>
        </div>
      </div>

      <ul class="mt-4 stack-sm">
        <li
          *ngFor="let s of segments"
          class="flex items-center gap-2 rounded-2xl bg-cream/80 px-3 py-2 body-text"
        >
          <span
            class="h-3 w-3 shrink-0 rounded-full ring-1"
            [style.background-color]="s.color"
            [style.--tw-ring-color]="memberColorBorder(s.color)"
          ></span>
          <app-member-avatar *ngIf="s.member && !s.isUnassigned" [member]="s.member" size="sm" />
          <span *ngIf="s.isUnassigned" class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink/10 caption-text">
            ？
          </span>
          <span class="min-w-0 flex-1 truncate">{{ s.label }}</span>
          <span class="amount-highlight shrink-0 text-sm">{{ s.percent }}%</span>
          <span class="caption-text shrink-0">NT$ {{ s.amount }}</span>
        </li>
      </ul>
    </div>
  `,
})
export class SplitPieChartComponent implements OnChanges {
  memberColorBorder = memberColorBorder;
  @Input() slices: PieSliceInput[] = [];
  /** 已分攤總額 */
  @Input() totalAmount = 0;
  /** 帳單總額（可大於已分攤，多出部分顯示無主帳） */
  @Input() billTotal: number | null = null;

  segments: PieSegment[] = [];
  chartTotal = 0;
  assignedTotal = 0;
  unassignedAmount = 0;
  conicGradient = '';
  chartLabel = '';

  private static readonly UNASSIGNED_COLOR = '#C9CDD3';

  constructor(private auth: AuthService) {}

  ngOnChanges(): void {
    this.rebuild();
  }

  private rebuild(): void {
    const positive = this.slices.filter((s) => s.amount > 0);
    this.assignedTotal =
      this.totalAmount > 0
        ? this.totalAmount
        : positive.reduce((sum, s) => sum + s.amount, 0);

    const bill =
      this.billTotal != null && this.billTotal > this.assignedTotal
        ? this.billTotal
        : this.assignedTotal;

    this.chartTotal = bill;
    this.unassignedAmount = Math.max(0, bill - this.assignedTotal);

    if (this.chartTotal <= 0 || (positive.length === 0 && this.unassignedAmount === 0)) {
      this.segments = [];
      this.conicGradient = '';
      this.chartLabel = '';
      return;
    }

    const memberSegments: PieSegment[] = positive
      .map((slice) => {
        const member = this.auth.getMember(slice.memberId);
        return {
          memberId: slice.memberId,
          amount: slice.amount,
          percent: Math.round((slice.amount / this.chartTotal) * 1000) / 10,
          color: memberColorSolid(member?.color ?? '#FFB5A7'),
          label: member?.name ?? slice.memberId,
          member,
        };
      })
      .sort((a, b) => b.amount - a.amount);

    if (this.unassignedAmount > 0) {
      memberSegments.push({
        memberId: '__unassigned__',
        amount: this.unassignedAmount,
        percent: Math.round((this.unassignedAmount / this.chartTotal) * 1000) / 10,
        color: SplitPieChartComponent.UNASSIGNED_COLOR,
        label: '未分配餘額',
        isUnassigned: true,
      });
    }

    this.segments = memberSegments.sort((a, b) => b.amount - a.amount);

    let cursor = 0;
    const stops: string[] = [];
    for (const seg of this.segments) {
      const share = (seg.amount / this.chartTotal) * 100;
      const end = cursor + share;
      stops.push(`${seg.color} ${cursor}% ${end}%`);
      cursor = end;
    }
    this.conicGradient = `conic-gradient(from -90deg, ${stops.join(', ')})`;

    this.chartLabel = this.segments
      .map((s) => `${s.label} ${s.percent}%`)
      .join('、');
  }
}
