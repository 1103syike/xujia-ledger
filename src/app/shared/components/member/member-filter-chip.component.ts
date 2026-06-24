import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DisplayMember, Member } from '../../../core/models';
import { MemberAvatarComponent } from './member-avatar.component';

@Component({
  selector: 'app-member-filter-chip',
  standalone: true,
  imports: [CommonModule, RouterLink, MemberAvatarComponent],
  templateUrl: './member-filter-chip.component.html',
})
export class MemberFilterChipComponent {
  @Input({ required: true }) label!: string;
  @Input() selected = false;
  @Input() member?: Member | DisplayMember;
  @Input() accentColor = '';
  @Input() routerLink: string | string[] = '/transactions';
  @Input() queryParams: Record<string, string> | null = null;
  @Input() ariaLabel = '';
}
