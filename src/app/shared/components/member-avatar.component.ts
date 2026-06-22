import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DisplayMember, Member } from '../../core/models';
import { MemberChibiHeadComponent } from './member-chibi-head.component';

@Component({
  selector: 'app-member-avatar',
  standalone: true,
  imports: [CommonModule, MemberChibiHeadComponent],
  template: `
    <app-member-chibi-head
      [memberId]="member.id"
      [name]="member.name"
      [size]="pixelSize"
    />
  `,
})
export class MemberAvatarComponent {
  @Input({ required: true }) member!: Member | DisplayMember;
  @Input() size: 'xs' | 'sm' | 'md' | 'lg' = 'md';

  get pixelSize(): number {
    switch (this.size) {
      case 'xs':
        return 24;
      case 'sm':
        return 32;
      case 'lg':
        return 44;
      default:
        return 36;
    }
  }
}
