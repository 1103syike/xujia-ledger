import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Member } from '../../../core/models';
import { AuthService } from '../../../core/services/auth.service';
import { memberColorBorder, normalizeMemberColor } from '../../../core/display/member-color';
import { MemberAvatarComponent } from '../member/member-avatar.component';

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
  templateUrl: './split-pie-chart.component.html',

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
    const sliceSum = positive.reduce((sum, s) => sum + s.amount, 0);

    this.assignedTotal =
      sliceSum > 0
        ? sliceSum
        : this.totalAmount > 0
          ? this.totalAmount
          : 0;

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
          color: normalizeMemberColor(member?.color ?? '#FFB5A7'),
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
