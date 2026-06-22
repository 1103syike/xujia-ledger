import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Member } from '../../core/models';
import { AuthService } from '../../core/services/auth.service';
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
  member?: Member;
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
            <span class="text-xs text-ink/45">總額</span>
            <span class="text-base font-bold text-ink">NT$ {{ total }}</span>
          </div>
        </div>
      </div>

      <ul class="mt-4 space-y-2">
        <li
          *ngFor="let s of segments"
          class="flex items-center gap-2 rounded-2xl bg-cream/80 px-3 py-2 text-sm"
        >
          <span
            class="h-3 w-3 shrink-0 rounded-full ring-1 ring-white"
            [style.background-color]="s.color"
          ></span>
          <app-member-avatar *ngIf="s.member" [member]="s.member" size="sm" />
          <span class="min-w-0 flex-1 truncate">{{ s.member?.name }}</span>
          <span class="shrink-0 font-bold text-coral">{{ s.percent }}%</span>
          <span class="shrink-0 text-xs text-ink/45">NT$ {{ s.amount }}</span>
        </li>
      </ul>
    </div>
  `,
})
export class SplitPieChartComponent implements OnChanges {
  @Input() slices: PieSliceInput[] = [];
  @Input() totalAmount = 0;

  segments: PieSegment[] = [];
  total = 0;
  conicGradient = '';
  chartLabel = '';

  constructor(private auth: AuthService) {}

  ngOnChanges(): void {
    this.rebuild();
  }

  private rebuild(): void {
    const positive = this.slices.filter((s) => s.amount > 0);
    this.total =
      this.totalAmount > 0
        ? this.totalAmount
        : positive.reduce((sum, s) => sum + s.amount, 0);

    if (this.total <= 0 || positive.length === 0) {
      this.segments = [];
      this.conicGradient = '';
      this.chartLabel = '';
      return;
    }

    this.segments = positive
      .map((slice) => {
        const member = this.auth.getMember(slice.memberId);
        return {
          memberId: slice.memberId,
          amount: slice.amount,
          percent: Math.round((slice.amount / this.total) * 1000) / 10,
          color: member?.color ?? '#FFB5A7',
          member,
        };
      })
      .sort((a, b) => b.amount - a.amount);

    let cursor = 0;
    const stops: string[] = [];
    for (const seg of this.segments) {
      const share = (seg.amount / this.total) * 100;
      const end = cursor + share;
      stops.push(`${seg.color} ${cursor}% ${end}%`);
      cursor = end;
    }
    this.conicGradient = `conic-gradient(from -90deg, ${stops.join(', ')})`;

    this.chartLabel = this.segments
      .map((s) => `${s.member?.name ?? s.memberId} ${s.percent}%`)
      .join('、');
  }
}
