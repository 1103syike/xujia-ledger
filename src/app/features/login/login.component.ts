import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { DisplayMember, displayNameOf } from '../../core/models';
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

        <div class="relative z-10 grid w-full max-w-sm grid-cols-2 gap-3">
          <button
            *ngFor="let member of members; let last = last"
            type="button"
            class="flex flex-col items-center gap-2 rounded-3xl bg-white p-4 shadow-sm transition active:scale-[0.97]"
            [class.col-span-2]="last && members.length % 2 === 1"
            (click)="selectMember(member)"
          >
            <app-member-avatar [member]="member" size="lg" />
            <p class="item-title text-center">{{ displayNameOf(member) }}</p>
            <p class="caption-text text-center">{{ member.name }}</p>
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
              type="password"
              class="input input-amount"
              placeholder="請輸入登入密碼"
              [(ngModel)]="password"
              [disabled]="loading"
              (keydown.enter)="login()"
            />
            <p class="caption-text mt-1">密碼長度不拘，可於設定頁修改</p>
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
export class LoginComponent implements OnInit {
  members: DisplayMember[] = [];
  selectedMember: DisplayMember | null = null;
  password = '';
  error = '';
  loading = false;
  loginKaomojiSalt = 0;
  displayNameOf = displayNameOf;

  constructor(
    private auth: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.members = this.auth.getAllMembers();
  }

  selectMember(member: DisplayMember): void {
    this.selectedMember = member;
    this.error = '';
    this.password = '';
  }

  clearSelection(): void {
    this.selectedMember = null;
    this.password = '';
    this.error = '';
    this.loginKaomojiSalt++;
  }

  async login(): Promise<void> {
    if (!this.selectedMember || !this.password || this.loading) return;
    this.loading = true;
    this.error = '';
    const err = await this.auth.login(this.selectedMember.id, this.password);
    this.loading = false;
    if (err) {
      this.error = err;
      return;
    }
    this.router.navigateByUrl('/');
  }
}
