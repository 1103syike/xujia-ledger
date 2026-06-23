import { Component, ElementRef, OnInit, AfterViewInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { DisplayMember, displayNameOf } from '../../core/models';
import {
  getLastMemberId,
  getSavedPassword,
  isRecentMember,
  loadLoginPrefs,
  recordSuccessfulLogin,
  sortMembersByRecency,
} from '../../core/utils/login-prefs';
import { MemberAvatarComponent } from '../../shared/components/member-avatar.component';
import { KaomojiLoadingComponent } from '../../shared/components/kaomoji-loading.component';
import { DecoIllustrationComponent } from '../../shared/components/deco-illustration.component';
import { AppLogoComponent } from '../../shared/components/app-logo.component';
import { KaomojiDecoComponent } from '../../shared/components/kaomoji-deco.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MemberAvatarComponent,
    KaomojiLoadingComponent,
    DecoIllustrationComponent,
    AppLogoComponent,
    KaomojiDecoComponent,
  ],
  template: `
    <app-kaomoji-loading *ngIf="loading" message="登入中，請稍候" />

    <div class="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-cream px-6 py-10">
      <div class="relative z-10 mb-6 text-center">
        <div class="logo-mark">
          <app-app-logo [size]="80" label="許家帳本" />
        </div>
        <h1 class="page-title mt-4 text-2xl">許家帳本</h1>
        <p class="helper-text mt-2">
          {{ selectedMember ? '請輸入登入密碼' : '請選擇您的帳號' }}
        </p>
        <app-kaomoji-deco
          *ngIf="!selectedMember"
          class="mt-2 block"
          mood="login"
          seed="login-title"
          [salt]="loginKaomojiSalt"
          size="sm"
        />
      </div>

      <ng-container *ngIf="!selectedMember; else passwordStep">
        <div class="deco-banner deco-banner--subtle relative z-10 mb-4 w-full max-w-sm">
          <app-deco-illustration kind="group" alt="許家五人" />
        </div>

        <button
          *ngIf="quickMember as member"
          type="button"
          class="card relative z-10 mb-4 w-full max-w-sm text-left transition active:scale-[0.99]"
          (click)="quickLogin(member)"
        >
          <p class="caption-text mb-2 text-center">快速登入</p>
          <div class="flex items-center gap-3">
            <app-member-avatar [member]="member" size="lg" />
            <div class="min-w-0 flex-1">
              <p class="item-title">{{ displayNameOf(member) }}</p>
              <p class="caption-text">{{ member.name }}</p>
            </div>
            <span class="chip bg-mint/40 text-xs">上次登入</span>
          </div>
        </button>

        <div
          *ngIf="quickMember"
          class="relative z-10 mb-3 w-full max-w-sm text-center"
        >
          <span class="caption-text">或選擇其他成員</span>
        </div>

        <div class="relative z-10 flex w-full max-w-sm flex-wrap justify-center gap-3">
          <button
            *ngFor="let member of otherMembers"
            type="button"
            class="login-member-card flex w-[calc(50%-0.375rem)] flex-col items-center gap-2 rounded-3xl bg-white p-4 shadow-sm transition active:scale-[0.97]"
            [class.login-member-card--recent]="isRecent(member.id)"
            (click)="selectMember(member)"
          >
            <app-member-avatar [member]="member" size="lg" />
            <p class="item-title text-center">{{ displayNameOf(member) }}</p>
            <p class="caption-text text-center">{{ member.name }}</p>
            <span *ngIf="isRecent(member.id)" class="chip bg-lavender/50 text-xs">
              最近
            </span>
          </button>
        </div>
      </ng-container>

      <ng-template #passwordStep>
        <div class="card-stack relative z-10 w-full max-w-sm">
          <div class="flex items-center gap-3 inset-panel">
            <app-member-avatar [member]="selectedMember!" size="lg" />
            <div class="min-w-0 flex-1">
              <p class="item-title">{{ displayNameOf(selectedMember!) }}</p>
              <p class="caption-text">{{ selectedMember!.name }}</p>
            </div>
            <button
              type="button"
              class="caption-text shrink-0"
              (click)="clearSelection()"
            >
              重新選擇
            </button>
          </div>

          <div>
            <label class="field-label">登入密碼</label>
            <input
              #passwordInput
              type="password"
              class="input input-amount"
              placeholder="請輸入登入密碼"
              [(ngModel)]="password"
              [disabled]="loading"
              (keydown.enter)="login()"
            />
            <p class="caption-text mt-1">
              <ng-container *ngIf="passwordRemembered">已帶入上次密碼，可直接登入</ng-container>
              <ng-container *ngIf="!passwordRemembered">密碼長度不拘，可於設定頁修改</ng-container>
            </p>
          </div>

          <p *ngIf="error" class="body-text text-center text-coral">{{ error }}</p>

          <button
            type="button"
            class="btn-primary w-full py-3"
            [disabled]="loading || !password"
            (click)="login()"
          >
            登入
          </button>
        </div>
      </ng-template>
    </div>
  `,
})
export class LoginComponent implements OnInit, AfterViewInit {
  @ViewChild('passwordInput') passwordInput?: ElementRef<HTMLInputElement>;

  members: DisplayMember[] = [];
  recentMemberIds: string[] = [];
  quickMember: DisplayMember | null = null;
  selectedMember: DisplayMember | null = null;
  password = '';
  passwordRemembered = false;
  error = '';
  loading = false;
  loginKaomojiSalt = 0;
  displayNameOf = displayNameOf;
  isRecent = (id: string) => isRecentMember(id, this.recentMemberIds);

  get otherMembers(): DisplayMember[] {
    if (!this.quickMember) return this.members;
    return this.members.filter((m) => m.id !== this.quickMember!.id);
  }

  constructor(
    private auth: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    const prefs = loadLoginPrefs();
    this.recentMemberIds = prefs.recentMemberIds;
    const all = this.auth.getAllMembers();
    this.members = sortMembersByRecency(all, prefs.recentMemberIds);

    const lastId = getLastMemberId();
    const lastMember = lastId ? all.find((m) => m.id === lastId) : undefined;
    const savedPwd = lastId ? getSavedPassword(lastId) : null;

    if (lastMember && savedPwd) {
      this.quickMember = lastMember;
    } else if (lastMember) {
      this.selectMember(lastMember, false);
    }
  }

  ngAfterViewInit(): void {
    if (this.selectedMember) {
      this.focusPasswordField();
    }
  }

  quickLogin(member: DisplayMember): void {
    const saved = getSavedPassword(member.id);
    if (saved) {
      this.selectedMember = member;
      this.password = saved;
      this.passwordRemembered = true;
      this.error = '';
      void this.login();
      return;
    }
    this.selectMember(member);
  }

  selectMember(member: DisplayMember, focusPassword = true): void {
    this.selectedMember = member;
    this.error = '';
    const saved = getSavedPassword(member.id);
    this.password = saved ?? '';
    this.passwordRemembered = !!saved;

    if (focusPassword) {
      setTimeout(() => this.focusPasswordField(), 0);
    }
  }

  private focusPasswordField(): void {
    const el = this.passwordInput?.nativeElement;
    if (!el) return;
    el.focus();
    if (this.password) {
      el.select();
    }
  }

  clearSelection(): void {
    this.selectedMember = null;
    this.password = '';
    this.passwordRemembered = false;
    this.error = '';
    this.loginKaomojiSalt++;
  }

  async login(): Promise<void> {
    if (!this.selectedMember || !this.password || this.loading) return;
    this.loading = true;
    this.error = '';
    const memberId = this.selectedMember.id;
    const pwd = this.password;
    const err = await this.auth.login(memberId, pwd);
    this.loading = false;
    if (err) {
      this.error = err;
      return;
    }
    recordSuccessfulLogin(memberId, pwd);
    this.router.navigateByUrl('/');
  }
}
