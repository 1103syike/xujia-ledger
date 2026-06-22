import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { displayNameOf } from '../core/models';
import { MemberAvatarComponent } from '../shared/components/member-avatar.component';

@Component({
  selector: 'app-mobile-shell',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MemberAvatarComponent,
  ],
  template: `
    <div class="mx-auto flex min-h-full max-w-md flex-col bg-cream pb-20">
      <header class="sticky top-0 z-10 px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))]">
        <div class="card flex items-center gap-3 py-3">
          <ng-container *ngIf="auth.currentMember as member">
            <a routerLink="/settings" class="flex min-w-0 flex-1 items-center gap-3">
              <app-member-avatar [member]="member" size="lg" />
              <div class="min-w-0">
                <p class="truncate text-base font-bold text-ink">
                  {{ displayNameOf(member) }}
                </p>
                <p class="text-xs text-ink/45">點我進設定</p>
              </div>
            </a>
            <a
              routerLink="/settings"
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-cream text-lg"
              aria-label="設定"
            >
              ⚙️
            </a>
          </ng-container>
        </div>
      </header>

      <main class="flex-1 px-4">
        <router-outlet />
      </main>

      <nav
        class="fixed bottom-0 left-0 right-0 mx-auto max-w-md border-t border-peach/20 bg-white/95 backdrop-blur"
        style="padding-bottom: max(0.5rem, env(safe-area-inset-bottom))"
      >
        <div class="grid grid-cols-4 gap-1 px-2 py-2">
          <a
            routerLink="/"
            routerLinkActive="text-coral"
            [routerLinkActiveOptions]="{ exact: true }"
            class="flex flex-col items-center rounded-2xl py-2 text-xs text-ink/70"
          >
            <span class="text-xl">🏠</span>
            首頁
          </a>
          <a
            routerLink="/expenses"
            routerLinkActive="text-coral"
            class="flex flex-col items-center rounded-2xl py-2 text-xs text-ink/70"
          >
            <span class="text-xl">📝</span>
            帳款
          </a>
          <a
            routerLink="/pending"
            routerLinkActive="text-coral"
            class="flex flex-col items-center rounded-2xl py-2 text-xs text-ink/70"
          >
            <span class="text-xl">✨</span>
            待確認
          </a>
          <a
            routerLink="/audit"
            routerLinkActive="text-coral"
            class="flex flex-col items-center rounded-2xl py-2 text-xs text-ink/70"
          >
            <span class="text-xl">📋</span>
            紀錄
          </a>
        </div>
      </nav>
    </div>
  `,
})
export class MobileShellComponent {
  displayNameOf = displayNameOf;

  constructor(public auth: AuthService) {}
}
