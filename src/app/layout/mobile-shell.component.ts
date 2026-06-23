import { Component, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { displayNameOf } from '../core/models';
import { MemberAvatarComponent } from '../shared/components/member-avatar.component';
import { AppLogoComponent } from '../shared/components/app-logo.component';
import { COPY_NAV } from '../copy';

@Component({
  selector: 'app-mobile-shell',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MemberAvatarComponent,
    AppLogoComponent,
  ],
  templateUrl: './mobile-shell.component.html',

})
export class MobileShellComponent {
  nav = COPY_NAV;
  displayNameOf = displayNameOf;
  headerCompact = false;

  /** 收起門檻（往下捲超過此值才收合） */
  private readonly collapseAt = 72;
  /** 展開門檻（往上捲回到此值以下才展開，與收起分開避免抖動） */
  private readonly expandAt = 12;

  constructor(public auth: AuthService) {}

  @HostListener('window:scroll')
  onScroll(): void {
    const y = window.scrollY;

    if (!this.headerCompact && y > this.collapseAt) {
      this.headerCompact = true;
    } else if (this.headerCompact && y < this.expandAt) {
      this.headerCompact = false;
    }
  }
}
