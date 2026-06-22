import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/services/auth.service';

@Component({
  selector: 'app-mobile-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="mx-auto flex min-h-full max-w-md flex-col bg-cream pb-20">
      <header class="sticky top-0 z-10 bg-cream/95 px-4 pb-2 pt-4 backdrop-blur">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-xs text-ink/60">許家帳本</p>
            <h1 class="text-lg font-bold text-ink">
              {{ greeting }}，{{ auth.currentMember?.name }}
            </h1>
          </div>
          <span class="text-2xl">{{ auth.currentMember?.emoji }}</span>
        </div>
      </header>

      <main class="flex-1 px-4">
        <router-outlet />
      </main>

      <nav
        class="fixed bottom-0 left-0 right-0 mx-auto max-w-md border-t border-peach/20 bg-white/95 backdrop-blur"
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
  constructor(public auth: AuthService) {}

  get greeting(): string {
    const h = new Date().getHours();
    if (h < 12) return '早安';
    if (h < 18) return '午安';
    return '晚安';
  }
}
