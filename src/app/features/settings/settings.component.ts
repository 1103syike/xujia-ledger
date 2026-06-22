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
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog.component';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, MemberAvatarComponent, ConfirmDialogComponent],
  template: `
    <div class="page" *ngIf="auth.currentMember as me">
      <div class="flex items-center gap-3">
        <app-member-avatar [member]="me" size="lg" />
        <div>
          <h2 class="page-title">{{ displayNameOf(me) }}</h2>
          <p class="helper-text">姓名：{{ me.name }}</p>
        </div>
      </div>

      <div class="card-stack">
        <p class="card-title">個人資料</p>

        <div>
          <label class="field-label">顯示暱稱</label>
          <input
            class="input"
            [(ngModel)]="nickname"
            placeholder="可與姓名不同"
          />
        </div>

        <div>
          <label class="field-label">表情符號</label>
          <input
            class="input text-2xl"
            [(ngModel)]="emoji"
            maxlength="4"
            placeholder="🌸"
          />
        </div>

        <div>
          <label class="field-label">頭像底色</label>
          <input type="color" class="h-12 w-full rounded-2xl" [(ngModel)]="color" />
        </div>
      </div>

      <div class="card-stack">
        <p class="card-title">主題配色</p>
        <p class="helper-text">選擇您偏好的風格，全站即時預覽</p>

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
            <p class="item-title">
              {{ preset.emoji }} {{ preset.name }}
            </p>
            <p class="caption-text">{{ preset.description }}</p>
          </div>
          <span
            *ngIf="themePresetId === preset.id"
            class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-peach text-xs text-white"
          >
            ✓
          </span>
        </button>
      </div>

      <div class="card-stack">
        <p class="card-title">登入密碼</p>
        <p class="helper-text">可自訂密碼，長度不拘</p>
        <input
          type="password"
          class="input"
          [(ngModel)]="currentPassword"
          placeholder="目前登入密碼"
        />
        <input
          type="password"
          class="input"
          [(ngModel)]="newPassword"
          placeholder="新登入密碼"
        />
      </div>

      <p
        *ngIf="message"
        class="body-text text-center"
        [class.text-coral]="isError"
        [class.text-mint]="!isError"
      >
        {{ message }}
      </p>

      <button
        type="button"
        class="btn-primary w-full"
        [disabled]="saving"
        (click)="openSaveDialog()"
      >
        {{ saving ? '儲存中…' : '儲存設定' }}
      </button>

      <app-confirm-dialog
        [open]="saveDialogOpen"
        title="儲存設定"
        [detail]="displayNameOf(me)"
        message="確定要儲存個人資料與主題設定嗎？"
        confirmLabel="確認儲存"
        cancelLabel="取消"
        [busy]="saving"
        (confirmed)="confirmSave()"
        (cancelled)="closeSaveDialog()"
      />

      <button
        type="button"
        class="btn-secondary w-full text-coral"
        (click)="logout()"
      >
        登出帳號
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
  saveDialogOpen = false;

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

  openSaveDialog(): void {
    if (this.saving) return;

    if (this.newPassword && !this.currentPassword) {
      this.message = '請輸入目前登入密碼';
      this.isError = true;
      return;
    }

    this.message = '';
    this.isError = false;
    this.saveDialogOpen = true;
  }

  closeSaveDialog(): void {
    if (this.saving) return;
    this.saveDialogOpen = false;
  }

  async confirmSave(): Promise<void> {
    await this.save();
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
        this.saveDialogOpen = false;
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
        this.saveDialogOpen = false;
        return;
      }
      patch['loginPassword'] = this.newPassword;
    }

    const err = await this.profiles.updateProfile(me.id, patch);
    this.saving = false;

    if (err) {
      this.message = err;
      this.isError = true;
      this.saveDialogOpen = false;
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
    this.message = '設定已成功儲存';
    this.isError = false;
    this.saveDialogOpen = false;
  }

  async logout(): Promise<void> {
    await this.auth.logout();
    this.router.navigateByUrl('/login');
  }
}
