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
} from '../../core/infra/login-prefs';
import { MemberAvatarComponent } from '../../shared/components/member/member-avatar.component';
import { KaomojiLoadingComponent } from '../../shared/components/branding/kaomoji-loading.component';
import { DecoIllustrationComponent } from '../../shared/components/branding/deco-illustration.component';
import { AppLogoComponent } from '../../shared/components/branding/app-logo.component';
import { KaomojiDecoComponent } from '../../shared/components/branding/kaomoji-deco.component';

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
  templateUrl: './login.component.html',

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
