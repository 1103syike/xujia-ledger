import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChibiId, defaultChibiForMember } from '../../core/models';

@Component({
  selector: 'app-member-chibi-head',
  standalone: true,
  imports: [CommonModule],
  template: `
    <svg
      class="member-chibi-head"
      [attr.width]="size"
      [attr.height]="size"
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      [attr.aria-label]="name"
    >
      <ng-container [ngSwitch]="resolvedChibiId">
        <g *ngSwitchCase="'chibi-1'">
          <ellipse cx="32" cy="38" rx="22" ry="20" fill="#FFB5A7" />
          <path d="M12 28c4-10 14-16 24-14 8 2 14 8 16 16-8-2-16-2-24 0-4-1-10-1-16-2z" fill="#5C4033" />
          <circle cx="24" cy="36" r="2.5" fill="#3D3D3D" />
          <circle cx="40" cy="36" r="2.5" fill="#3D3D3D" />
          <path d="M28 44c2 2 6 2 8 0" stroke="#3D3D3D" stroke-width="1.5" stroke-linecap="round" />
          <circle cx="20" cy="40" r="3" fill="#FF8FAB" opacity="0.45" />
          <circle cx="44" cy="40" r="3" fill="#FF8FAB" opacity="0.45" />
        </g>
        <g *ngSwitchCase="'chibi-2'">
          <ellipse cx="32" cy="38" rx="22" ry="20" fill="#B8E8D1" />
          <rect x="14" y="18" width="36" height="12" rx="6" fill="#4A90D9" />
          <rect x="18" y="22" width="10" height="4" rx="1" fill="#FFF8F0" opacity="0.8" />
          <circle cx="24" cy="36" r="2.5" fill="#3D3D3D" />
          <circle cx="40" cy="36" r="2.5" fill="#3D3D3D" />
          <path d="M28 44c2 2 6 2 8 0" stroke="#3D3D3D" stroke-width="1.5" stroke-linecap="round" />
          <circle cx="20" cy="40" r="3" fill="#FF8FAB" opacity="0.45" />
          <circle cx="44" cy="40" r="3" fill="#FF8FAB" opacity="0.45" />
        </g>
        <g *ngSwitchCase="'chibi-3'">
          <ellipse cx="32" cy="38" rx="22" ry="20" fill="#D4C1EC" />
          <ellipse cx="32" cy="24" rx="18" ry="10" fill="#4A3F55" />
          <rect x="16" y="33" width="32" height="8" rx="3" fill="none" stroke="#6B5B7A" stroke-width="2" />
          <circle cx="24" cy="36" r="2.5" fill="#3D3D3D" />
          <circle cx="40" cy="36" r="2.5" fill="#3D3D3D" />
          <path d="M28 44c2 2 6 2 8 0" stroke="#3D3D3D" stroke-width="1.5" stroke-linecap="round" />
          <circle cx="20" cy="40" r="3" fill="#FF8FAB" opacity="0.45" />
          <circle cx="44" cy="40" r="3" fill="#FF8FAB" opacity="0.45" />
        </g>
        <g *ngSwitchCase="'chibi-4'">
          <ellipse cx="32" cy="38" rx="22" ry="20" fill="#FFD6A5" />
          <path d="M16 26c6-8 18-10 28-4 4 2 6 6 6 10-10-4-20-2-28 2-2-4-4-6-6-8z" fill="#3D3D3D" />
          <circle cx="24" cy="36" r="2.5" fill="#3D3D3D" />
          <circle cx="40" cy="36" r="2.5" fill="#3D3D3D" />
          <path d="M26 44c3 3 9 3 12 0" stroke="#3D3D3D" stroke-width="1.5" stroke-linecap="round" />
          <circle cx="20" cy="40" r="3" fill="#FF8FAB" opacity="0.45" />
          <circle cx="44" cy="40" r="3" fill="#FF8FAB" opacity="0.45" />
        </g>
        <g *ngSwitchCase="'chibi-5'">
          <ellipse cx="32" cy="38" rx="22" ry="20" fill="#A0C4FF" />
          <path d="M14 28c2-8 12-14 22-12 6 1 10 5 12 10-8-2-16-2-24 0-4-2-8-2-10 2z" fill="#2F3F55" />
          <rect x="22" y="30" width="20" height="5" rx="2.5" fill="#2F3F55" opacity="0.35" />
          <circle cx="24" cy="36" r="2.5" fill="#3D3D3D" />
          <circle cx="40" cy="36" r="2.5" fill="#3D3D3D" />
          <path d="M28 44c2 2 6 2 8 0" stroke="#3D3D3D" stroke-width="1.5" stroke-linecap="round" />
          <circle cx="20" cy="40" r="3" fill="#FF8FAB" opacity="0.45" />
          <circle cx="44" cy="40" r="3" fill="#FF8FAB" opacity="0.45" />
        </g>
        <g *ngSwitchDefault>
          <ellipse cx="32" cy="38" rx="22" ry="20" fill="#FFE8A3" />
          <circle cx="20" cy="22" r="8" fill="#E8A87C" />
          <circle cx="44" cy="22" r="8" fill="#E8A87C" />
          <circle cx="20" cy="22" r="4" fill="#FFD6E0" />
          <circle cx="44" cy="22" r="4" fill="#FFD6E0" />
          <circle cx="24" cy="36" r="2.5" fill="#3D3D3D" />
          <circle cx="40" cy="36" r="2.5" fill="#3D3D3D" />
          <path d="M28 44c2 2 6 2 8 0" stroke="#3D3D3D" stroke-width="1.5" stroke-linecap="round" />
          <circle cx="20" cy="40" r="3" fill="#FF8FAB" opacity="0.45" />
          <circle cx="44" cy="40" r="3" fill="#FF8FAB" opacity="0.45" />
        </g>
      </ng-container>
    </svg>
  `,
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
