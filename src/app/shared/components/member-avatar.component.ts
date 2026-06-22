import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Member } from '../../core/models';

@Component({
  selector: 'app-member-avatar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span
      class="inline-flex h-9 w-9 items-center justify-center rounded-full text-lg"
      [style.background-color]="member.color + '55'"
    >
      {{ member.emoji }}
    </span>
  `,
})
export class MemberAvatarComponent {
  @Input({ required: true }) member!: Member;
}
