import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { displayNameOf } from '../../core/models';
import { MemberAvatarComponent } from '../../shared/components/member-avatar.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, MemberAvatarComponent],
  template: `
    <div class="flex min-h-screen flex-col items-center justify-center bg-cream px-6">
      <div class="mb-8 text-center">
        <p class="text-4xl">🧾</p>
        <h1 class="mt-3 text-2xl font-bold text-ink">許家帳本</h1>
        <p class="mt-2 text-sm text-ink/60">輸入你的登入密碼，再點名字</p>
      </div>

      <div class="card w-full max-w-sm space-y-4">
        <div>
          <label class="mb-1 block text-sm font-medium text-ink/70">登入密碼</label>
          <input
            type="password"
            class="w-full rounded-2xl border border-peach/30 bg-cream px-4 py-3 outline-none focus:border-peach"
            placeholder="自訂密碼（預設 123456）"
            [(ngModel)]="password"
            [disabled]="loading"
          />
          <p class="mt-1 text-xs text-ink/40">可設任意長度，在設定裡可修改</p>
        </div>

        <p *ngIf="error" class="text-center text-sm text-coral">{{ error }}</p>

        <div class="space-y-2">
          <button
            *ngFor="let member of members"
            type="button"
            class="flex w-full items-center gap-3 rounded-2xl p-3 text-left transition hover:bg-peach/10 active:scale-[0.98] disabled:opacity-50"
            [disabled]="loading || !password"
            (click)="login(member.id)"
          >
            <app-member-avatar [member]="member" />
            <div>
              <p class="font-medium">{{ displayNameOf(member) }}</p>
              <p class="text-xs text-ink/45">{{ member.name }}</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  `,
})
export class LoginComponent {
  password = '';
  error = '';
  loading = false;
  displayNameOf = displayNameOf;

  constructor(
    public auth: AuthService,
    private router: Router
  ) {}

  get members() {
    return this.auth.getAllMembers();
  }

  async login(memberId: string): Promise<void> {
    if (!this.password || this.loading) return;
    this.loading = true;
    this.error = '';
    const err = await this.auth.login(memberId, this.password);
    this.loading = false;
    if (err) {
      this.error = err;
      return;
    }
    this.router.navigateByUrl('/');
  }
}
