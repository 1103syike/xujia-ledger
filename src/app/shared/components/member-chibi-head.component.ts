import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChibiId, defaultChibiForMember } from '../../core/models';

@Component({
  selector: 'app-member-chibi-head',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './member-chibi-head.component.html',

})
export class MemberChibiHeadComponent {
  @Input() chibiId?: ChibiId;
  @Input() memberId?: string;
  @Input() name = '';
  @Input() size = 28;

  get resolvedChibiId(): ChibiId {
    if (this.chibiId) return this.chibiId;
    if (this.memberId) return defaultChibiForMember(this.memberId);
    return 'chibi-1';
  }
}
