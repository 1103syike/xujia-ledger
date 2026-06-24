import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Member } from '../../../core/models';
import { memberColorSolid } from '../../../core/display/member-color';
import { MemberFilterChipComponent } from './member-filter-chip.component';

@Component({
  selector: 'app-member-filter-bar',
  standalone: true,
  imports: [CommonModule, MemberFilterChipComponent],
  templateUrl: './member-filter-bar.component.html',
})
export class MemberFilterBarComponent {
  @Input() members: Member[] = [];
  @Input() selectedMemberId: string | null = null;
  @Input() selectMode = false;
  @Input() selectedIds: string[] = [];

  memberColorSolid = memberColorSolid;

  queryParamsFor(withMemberId?: string): Record<string, string> | null {
    if (this.selectMode) {
      const params: Record<string, string> = { consolidate: '1' };
      if (withMemberId) params['with'] = withMemberId;
      if (this.selectedIds.length > 0) params['ids'] = this.selectedIds.join(',');
      return params;
    }
    return withMemberId ? { with: withMemberId } : null;
  }
}
