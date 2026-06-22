import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DisplayMember, Member } from '../../core/models';

@Component({
  selector: 'app-member-avatar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span
      class="inline-flex shrink-0 items-center justify-center rounded-full"
      [class]="sizeClass"
      [style.background-color]="member.color + '55'"
    >
      <span [class]="emojiClass">{{ member.emoji }}</span>
    </span>
  `,
})
export class MemberAvatarComponent {
  @Input({ required: true }) member!: Member | DisplayMember;
  @Input() size: 'sm' | 'md' | 'lg' = 'md';

  get sizeClass(): string {
    switch (this.size) {
      case 'sm':
        return 'h-8 w-8';
      case 'lg':
        return 'h-11 w-11';
      default:
        return 'h-9 w-9';
    }
  }

  get emojiClass(): string {
    switch (this.size) {
      case 'sm':
        return 'text-base leading-none';
      case 'lg':
        return 'text-xl leading-none';
      default:
        return 'text-lg leading-none';
    }
  }
}
