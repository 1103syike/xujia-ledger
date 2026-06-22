import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { MemberAvatarComponent } from '../../shared/components/member-avatar.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, MemberAvatarComponent],
  template: `
    <div class="flex min-h-screen flex-col items-center justify-center bg-cream px-6">
      <div class="mb-8 text-center">
        <p class="text-4xl">🧾</p>
        <h1 class="mt-3 text-2xl font-bold text-ink">許家帳本</h1>
        <p class="mt-2 text-sm text-ink/60">出遊分帳小本本，可愛又清楚～</p>
      </div>

      <div class="card w-full max-w-sm space-y-3">
        <p class="text-sm font-medium text-ink/70">選擇你是誰</p>
        <button
          *ngFor="let member of auth.members"
          type="button"
          class="flex w-full items-center gap-3 rounded-2xl p-3 text-left transition hover:bg-peach/10 active:scale-[0.98]"
          (click)="select(member.id)"
        >
          <app-member-avatar [member]="member" />
          <span class="font-medium">{{ member.name }}</span>
        </button>
      </div>

      <p class="mt-8 text-center text-xs text-ink/40">
        五人私用 ·
        <a
          href="https://github.com/1103syike/xujia-ledger"
          target="_blank"
          rel="noopener"
          class="underline"
        >
          GitHub
        </a>
      </p>
    </div>
  `,
})
export class LoginComponent {
  constructor(
    public auth: AuthService,
    private router: Router
  ) {}

  select(memberId: string): void {
    this.auth.login(memberId);
    this.router.navigateByUrl('/');
  }
}
