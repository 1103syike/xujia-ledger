import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { MemberProfileService } from '../../core/services/member-profile.service';
import { ThemeService } from '../../core/services/theme.service';
import {
  THEME_PRESETS,
  ThemePresetId,
  displayNameOf,
  getThemePreset,
} from '../../core/models';
import { MemberAvatarComponent } from '../../shared/components/member-avatar.component';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, MemberAvatarComponent],
  template: `
    <div class="space-y-4 pb-8" *ngIf="auth.currentMember as me">
      <div class="flex items-center gap-3">
        <app-member-avatar [member]="me" size="lg" />
        <div>
          <h2 class="text-lg font-bold">{{ displayNameOf(me) }}</h2>
          <p class="text-sm text-ink/50">姓名：{{ me.name }}</p>
        </div>
      </div>

      <div class="card space-y-4">
        <p class="font-medium">個人</p>

        <div>
          <label class="mb-1 block text-sm text-ink/70">暱稱（顯示用）</label>
          <input
            class="w-full rounded-2xl border border-peach/30 bg-cream px-4 py-3"
            [(ngModel)]="nickname"
            placeholder="跟姓名不同也可以"
          />
        </div>

        <div>
          <label class="mb-1 block text-sm text-ink/70">表情符號</label>
          <input
            class="w-full rounded-2xl border border-peach/30 bg-cream px-4 py-3 text-2xl"
            [(ngModel)]="emoji"
            maxlength="4"
            placeholder="🌸"
          />
        </div>

        <div>
          <label class="mb-1 block text-sm text-ink/70">頭像底色</label>
          <input type="color" class="h-12 w-full rounded-2xl" [(ngModel)]="color" />
        </div>
      </div>

      <div class="card space-y-3">
        <p class="font-medium">主題配色</p>
        <p class="text-xs text-ink/45">選一個你喜歡的風格，全站立即預覽</p>

        <button
          *ngFor="let preset of themePresets"
          type="button"
          class="flex w-full items-center gap-3 rounded-2xl p-3 text-left transition active:scale-[0.99]"
          [class.ring-2]="themePresetId === preset.id"
          [class.ring-peach-40]="themePresetId === preset.id"
          [class.bg-peach-15]="themePresetId === preset.id"
          [class.bg-cream]="themePresetId !== preset.id"
          (click)="selectTheme(preset.id)"
        >
          <div
            class="flex h-12 w-12 shrink-0 overflow-hidden rounded-2xl shadow-sm"
            [style.background]="themePreviewGradient(preset.id)"
          ></div>
          <div class="min-w-0 flex-1">
            <p class="font-medium">
              {{ preset.emoji }} {{ preset.name }}
            </p>
            <p class="text-xs text-ink/50">{{ preset.description }}</p>
          </div>
          <span
            *ngIf="themePresetId === preset.id"
            class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-peach text-xs text-white"
          >
            ✓
          </span>
        </button>
      </div>

      <div class="card space-y-3">
        <p class="font-medium">登入密碼</p>
        <p class="text-xs text-ink/45">自訂密碼，可任意長度（與 Firebase 內部密碼無關）</p>
        <input
          type="password"
          class="w-full rounded-2xl border border-peach/30 bg-cream px-4 py-3"
          [(ngModel)]="currentPassword"
          placeholder="目前登入密碼"
        />
        <input
          type="password"
          class="w-full rounded-2xl border border-peach/30 bg-cream px-4 py-3"
          [(ngModel)]="newPassword"
          placeholder="新登入密碼"
        />
      </div>

      <p
        *ngIf="message"
        class="text-center text-sm"
        [class.text-coral]="isError"
        [class.text-mint]="!isError"
      >
        {{ message }}
      </p>

      <button
        type="button"
        class="btn-primary w-full"
        [disabled]="saving"
        (click)="save()"
      >
        {{ saving ? '儲存中…' : '儲存設定' }}
      </button>

      <button
        type="button"
        class="btn-secondary w-full text-coral"
        (click)="logout()"
      >
        登出
      </button>
    </div>
  `,
})
export class SettingsComponent {
  themePresets = THEME_PRESETS;
  displayNameOf = displayNameOf;

  nickname = '';
  emoji = '';
  color = '';
  themePresetId: ThemePresetId = 'peach-soda';
  currentPassword = '';
  newPassword = '';
  message = '';
  isError = false;
  saving = false;

  constructor(
    public auth: AuthService,
    private profiles: MemberProfileService,
    private themeService: ThemeService,
    private router: Router
  ) {
    this.loadFromCurrent();
    this.auth.currentMember$.subscribe((m) => {
      if (m) this.loadFromCurrent();
    });
  }

  themePreviewGradient(id: ThemePresetId): string {
    const c = getThemePreset(id).colors;
    return `conic-gradient(from -45deg, ${c.peach}, ${c.mint}, ${c.lavender}, ${c.coral}, ${c.peach})`;
  }

  selectTheme(id: ThemePresetId): void {
    this.themePresetId = id;
    this.themeService.applyTheme(getThemePreset(id).colors);
  }

  private loadFromCurrent(): void {
    const me = this.auth.currentMember;
    if (!me) return;
    this.nickname = me.nickname;
    this.emoji = me.emoji;
    this.color = me.color;
    this.themePresetId = me.themePresetId;
  }

  async save(): Promise<void> {
    const me = this.auth.currentMember;
    if (!me) return;

    this.saving = true;
    this.message = '';
    this.isError = false;

    const patch: Record<string, unknown> = {
      nickname: this.nickname.trim(),
      emoji: this.emoji.trim() || me.emoji,
      color: this.color,
      themePresetId: this.themePresetId,
    };

    if (this.newPassword) {
      if (!this.currentPassword) {
        this.message = '請輸入目前登入密碼';
        this.isError = true;
        this.saving = false;
        return;
      }
      const valid = await this.profiles.verifyLoginPassword(
        me.id,
        this.currentPassword
      );
      if (!valid) {
        this.message = '目前登入密碼不正確';
        this.isError = true;
        this.saving = false;
        return;
      }
      patch['loginPassword'] = this.newPassword;
    }

    const err = await this.profiles.updateProfile(me.id, patch);
    this.saving = false;

    if (err) {
      this.message = err;
      this.isError = true;
      return;
    }

    const refreshed = this.auth.getMember(me.id);
    if (refreshed) {
      this.themeService.applyForMember(refreshed);
    } else {
      this.themeService.applyTheme(getThemePreset(this.themePresetId).colors);
    }

    this.currentPassword = '';
    this.newPassword = '';
    this.message = '已儲存 ✓';
    this.isError = false;
  }

  async logout(): Promise<void> {
    await this.auth.logout();
    this.router.navigateByUrl('/login');
  }
}
