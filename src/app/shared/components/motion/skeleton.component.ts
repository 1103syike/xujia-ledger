import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type SkeletonPreset =
  | 'block'
  | 'tx-list'
  | 'dashboard'
  | 'detail'
  | 'tx-card';

@Component({
  selector: 'app-skeleton',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './skeleton.component.html',
})
export class SkeletonComponent {
  @Input() preset: SkeletonPreset = 'block';
  /** tx-list 時顯示幾張卡片 */
  @Input() count = 3;

  repeat(n: number): number[] {
    return Array.from({ length: Math.max(0, n) }, (_, i) => i);
  }
}
