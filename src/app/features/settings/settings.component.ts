import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { MemberProfileService } from '../../core/services/member-profile.service';
import { ThemeService } from '../../core/services/theme.service';
import {
  AvatarChoice,
  DisplayMember,
  MEMBER_COLOR_OPTIONS,
  THEME_PRESETS,
  ThemePresetId,
  displayNameOf,
  getThemePreset,
  memberColorLabel,
  normalizeThemePresetId,
  resolveAvatarChoice,
} from '../../core/models';
import { MemberAvatarComponent } from '../../shared/components/member/member-avatar.component';
import { MemberChibiHeadComponent } from '../../shared/components/member/member-chibi-head.component';
import { AvatarPickerComponent } from '../../shared/components/branding/avatar-picker.component';
import { ConfirmDialogComponent } from '../../shared/components/form/confirm-dialog.component';
import { VersionHistorySheetComponent } from '../../shared/components/release/version-history-sheet.component';
import {
  CURRENT_APP_VERSION,
} from '../../core/release/release-history';
import {
  memberColorBorder,
  memberColorSoftBg,
} from '../../core/display/member-color';
import { COPY_TERMS } from '../../copy';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MemberAvatarComponent,
    MemberChibiHeadComponent,
    AvatarPickerComponent,
    ConfirmDialogComponent,
    VersionHistorySheetComponent,
  ],
  templateUrl: './settings.component.html',

})
export class SettingsComponent implements OnDestroy {
  themePresets = THEME_PRESETS;
  memberColorOptions = MEMBER_COLOR_OPTIONS;
  displayNameOf = displayNameOf;
  memberColorSoftBg = memberColorSoftBg;
  memberColorBorder = memberColorBorder;
  readonly payerBadge = COPY_TERMS.payerBadge;
  readonly debtorBadge = COPY_TERMS.debtorBadge;
  readonly appVersion = CURRENT_APP_VERSION;

  nickname = '';
  emoji = '';
  color = '';
  themePresetId: ThemePresetId = 'milk-peach';
  currentPassword = '';
  newPassword = '';
  message = '';
  isError = false;
  saving = false;
  loggingOut = false;
  saveDialogOpen = false;
  logoutDialogOpen = false;
  versionHistoryOpen = false;
  avatarChoice: AvatarChoice = { type: 'svg', svgId: 'chibi-1' };
  previewMember: DisplayMember | null = null;
  accountOpen = false;
  avatarOpen = false;
  memberColorOpen = false;
  themeOpen = false;
  private loadedMemberId: string | null = null;

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

  get selectedThemeCream(): string {
    return getThemePreset(this.themePresetId).colors.cream;
  }

  get selectedColorName(): string | null {
    return memberColorLabel(this.color);
  }

  get accountDisplayName(): string {
    const me = this.auth.currentMember;
    if (!me) return '';
    return this.nickname.trim() || me.name;
  }

  isColorSelected(value: string): boolean {
    return this.color.toUpperCase() === value.toUpperCase();
  }

  selectColor(value: string): void {
    this.color = value;
  }

  selectTheme(id: ThemePresetId): void {
    this.themePresetId = id;
    this.themeService.applyTheme(getThemePreset(id).colors);
  }

  toggleMemberColor(): void {
    this.memberColorOpen = !this.memberColorOpen;
  }

  toggleAccount(): void {
    this.accountOpen = !this.accountOpen;
  }

  toggleAvatar(): void {
    this.avatarOpen = !this.avatarOpen;
  }

  toggleTheme(): void {
    this.themeOpen = !this.themeOpen;
  }

  onAvatarChoiceChange(choice: AvatarChoice): void {
    this.avatarChoice = choice;
    this.syncPreviewMember();
  }

  ngOnDestroy(): void {
    this.themeService.applyForMember(this.auth.currentMember);
  }

  private loadFromCurrent(): void {
    const me = this.auth.currentMember;
    if (!me) return;

    const memberChanged = this.loadedMemberId !== me.id;
    if (memberChanged) {
      this.loadedMemberId = me.id;
      this.avatarChoice = { ...resolveAvatarChoice(me.id, me.avatarChoice) };
    }

    this.nickname = me.nickname;
    this.emoji = me.emoji;
    this.color = me.color;
    this.themePresetId = normalizeThemePresetId(me.themePresetId);
    this.themeService.applyForMember(me);
    this.syncPreviewMember();
  }

  private syncPreviewMember(): void {
    const me = this.auth.currentMember;
    if (!me) {
      this.previewMember = null;
      return;
    }

    this.previewMember = {
      ...me,
      avatarChoice: { ...this.avatarChoice },
    };
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
      avatarChoice: this.sanitizeAvatarChoice(me),
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

    const saved = this.auth.getMember(me.id);
    if (saved) {
      this.avatarChoice = { ...resolveAvatarChoice(saved.id, saved.avatarChoice) };
      this.syncPreviewMember();
    }
  }

  async confirmLogout(): Promise<void> {
    this.loggingOut = true;
    await this.auth.logout();
    this.loggingOut = false;
    this.logoutDialogOpen = false;
    this.router.navigateByUrl('/login');
  }

  openLogoutDialog(): void {
    if (this.loggingOut) return;
    this.logoutDialogOpen = true;
  }

  closeLogoutDialog(): void {
    if (this.loggingOut) return;
    this.logoutDialogOpen = false;
  }

  openVersionHistory(): void {
    this.versionHistoryOpen = true;
  }

  closeVersionHistory(): void {
    this.versionHistoryOpen = false;
  }

  private sanitizeAvatarChoice(me: NonNullable<typeof this.auth.currentMember>) {
    const choice = resolveAvatarChoice(me.id, this.avatarChoice);
    if (choice.type === 'slot') {
      const key = String(choice.slot) as '1' | '2' | '3';
      if (!me.avatarSlots[key]) {
        return resolveAvatarChoice(me.id, me.avatarChoice);
      }
    }
    return choice;
  }
}
