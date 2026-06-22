import { Component, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { displayNameOf } from '../core/models';
import { MemberAvatarComponent } from '../shared/components/member-avatar.component';
import { AppLogoComponent } from '../shared/components/app-logo.component';

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
  template: `
    <div class="mx-auto flex min-h-full max-w-md flex-col bg-cream pb-20">
      <header
        class="sticky top-0 z-10 transition-[background-color,box-shadow,border-color] duration-200"
        [ngClass]="
          headerCompact
            ? 'border-b border-peach/20 bg-white/95 shadow-sm'
            : 'bg-cream/90 backdrop-blur-md'
        "
      >
        <div
          class="px-4 transition-[padding] duration-200"
          [class.pt-[max(0.5rem,env(safe-area-inset-top))]]="headerCompact"
          [class.pt-[max(1rem,env(safe-area-inset-top))]]="!headerCompact"
          [class.pb-3]="!headerCompact"
        >
          <div
            class="flex w-full items-center gap-2 transition-[padding,background-color,border-radius,box-shadow] duration-200"
            [class.min-h-10]="headerCompact"
            [class.card]="!headerCompact"
            [class.gap-3]="!headerCompact"
            [class.py-3]="!headerCompact"
          >
            <ng-container *ngIf="auth.currentMember as member">
              <app-member-avatar
                class="shrink-0"
                [member]="member"
                [size]="headerCompact ? 'sm' : 'lg'"
              />
              <div
                class="min-w-0 flex-1"
                [class.flex]="headerCompact"
                [class.items-center]="headerCompact"
              >
                <p
                  class="truncate font-bold leading-none text-ink transition-[font-size] duration-200"
                  [class.text-sm]="headerCompact"
                  [class.text-base]="!headerCompact"
                >
                  {{ displayNameOf(member) }}
                </p>
                <p
                  *ngIf="!headerCompact"
                  class="mt-1 flex items-center gap-1.5 text-xs leading-none text-ink/45"
                >
                  <app-app-logo [size]="18" />
                  許家帳本
                </p>
              </div>
              <a
                routerLink="/settings"
                class="inline-flex shrink-0 items-center justify-center leading-none transition-[width,height,font-size,background-color,border-radius] duration-200 active:scale-95"
                [class.h-8]="headerCompact"
                [class.w-8]="headerCompact"
                [class.text-base]="headerCompact"
                [class.h-10]="!headerCompact"
                [class.w-10]="!headerCompact"
                [class.rounded-2xl]="!headerCompact"
                [class.bg-cream]="!headerCompact"
                [class.text-lg]="!headerCompact"
                aria-label="設定"
              >
                ⚙️
              </a>
            </ng-container>
          </div>
        </div>
      </header>

      <main class="flex-1 px-4 pt-3">
        <router-outlet />
      </main>

      <nav
        class="fixed bottom-0 left-0 right-0 mx-auto max-w-md border-t border-peach/20 bg-white/95 backdrop-blur"
        style="padding-bottom: max(0.5rem, env(safe-area-inset-bottom))"
      >
        <div class="bottom-nav grid gap-1 px-2 py-2">
          <a
            routerLink="/"
            routerLinkActive="bottom-nav__link--active"
            [routerLinkActiveOptions]="{ exact: true }"
            class="bottom-nav__link"
          >
            <span class="bottom-nav__icon" aria-hidden="true">🏠</span>
            <span class="bottom-nav__label">首頁</span>
          </a>
          <a
            routerLink="/expenses"
            routerLinkActive="bottom-nav__link--active"
            class="bottom-nav__link"
          >
            <span class="bottom-nav__icon" aria-hidden="true">📝</span>
            <span class="bottom-nav__label">帳款</span>
          </a>
          <a
            routerLink="/pending"
            routerLinkActive="bottom-nav__link--active"
            class="bottom-nav__link"
          >
            <span class="bottom-nav__icon" aria-hidden="true">✨</span>
            <span class="bottom-nav__label">待確認</span>
          </a>
          <a
            routerLink="/audit"
            routerLinkActive="bottom-nav__link--active"
            class="bottom-nav__link"
          >
            <span class="bottom-nav__icon" aria-hidden="true">📋</span>
            <span class="bottom-nav__label">紀錄</span>
          </a>
        </div>
      </nav>
    </div>
  `,
})
export class MobileShellComponent {
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
