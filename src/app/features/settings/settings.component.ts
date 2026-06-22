import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { MemberProfileService } from '../../core/services/member-profile.service';
import { ThemeService } from '../../core/services/theme.service';
import {
  MEMBER_COLOR_OPTIONS,
  THEME_PRESETS,
  ThemePresetId,
  displayNameOf,
  getThemePreset,
  memberColorLabel,
  normalizeThemePresetId,
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
          <label class="field-label">代表色</label>
          <p class="helper-text mb-2">用於標籤與分攤顯示，頭像為固定 Q 版造型</p>

          <div class="theme-swatch-grid">
            <button
              *ngFor="let option of memberColorOptions"
              type="button"
              class="theme-swatch"
              [class.theme-swatch--selected]="isColorSelected(option.value)"
              [style.background-color]="option.value"
              [attr.aria-label]="option.name"
              [attr.aria-pressed]="isColorSelected(option.value)"
              (click)="selectColor(option.value)"
            >
              <span
                *ngIf="isColorSelected(option.value)"
                class="theme-swatch__check"
                aria-hidden="true"
              >
                ✓
              </span>
            </button>
          </div>

          <p class="caption-text mt-2 text-center" *ngIf="selectedColorName">
            已選：{{ selectedColorName }}
          </p>
        </div>
      </div>

      <div class="card-stack">
        <p class="card-title">背景色</p>
        <p class="helper-text">選擇後請按「儲存設定」才會套用至全站</p>

        <div class="theme-swatch-grid">
          <button
            *ngFor="let preset of themePresets"
            type="button"
            class="theme-swatch"
            [class.theme-swatch--selected]="themePresetId === preset.id"
            [style.background-color]="preset.colors.cream"
            [attr.aria-label]="preset.name"
            [attr.aria-pressed]="themePresetId === preset.id"
            (click)="selectTheme(preset.id)"
          >
            <span
              *ngIf="themePresetId === preset.id"
              class="theme-swatch__check"
              aria-hidden="true"
            >
              ✓
            </span>
          </button>
        </div>

        <p class="caption-text text-center" *ngIf="selectedThemeName">
          已選：{{ selectedThemeName }}
        </p>
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
export class SettingsComponent implements OnDestroy {
  themePresets = THEME_PRESETS;
  memberColorOptions = MEMBER_COLOR_OPTIONS;
  displayNameOf = displayNameOf;

  nickname = '';
  emoji = '';
  color = '';
  themePresetId: ThemePresetId = 'milk-peach';
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

  get selectedThemeName(): string {
    return getThemePreset(this.themePresetId).name;
  }

  get selectedColorName(): string | null {
    return memberColorLabel(this.color);
  }

  isColorSelected(value: string): boolean {
    return this.color.toUpperCase() === value.toUpperCase();
  }

  selectColor(value: string): void {
    this.color = value;
  }

  selectTheme(id: ThemePresetId): void {
    this.themePresetId = id;
  }

  ngOnDestroy(): void {
    this.themeService.applyForMember(this.auth.currentMember);
  }

  private loadFromCurrent(): void {
    const me = this.auth.currentMember;
    if (!me) return;
    this.nickname = me.nickname;
    this.emoji = me.emoji;
    this.color = me.color;
    this.themePresetId = normalizeThemePresetId(me.themePresetId);
    this.themeService.applyForMember(me);
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
