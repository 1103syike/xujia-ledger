import { Injectable } from '@angular/core';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  User,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { BehaviorSubject, filter, firstValueFrom, take } from 'rxjs';
import { firebaseAuth, firestoreDb } from '../firebase';
import {
  DEFAULT_MEMBERS,
  DisplayMember,
  FIREBASE_INTERNAL_PASSWORD,
} from '../models';
import { MemberProfileService } from './member-profile.service';
import { ThemeService } from './theme.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly members = DEFAULT_MEMBERS;

  private readonly currentMemberSubject =
    new BehaviorSubject<DisplayMember | null>(null);
  private readonly authReadySubject = new BehaviorSubject(false);

  readonly currentMember$ = this.currentMemberSubject.asObservable();
  readonly authReady$ = this.authReadySubject.asObservable();

  constructor(
    private profiles: MemberProfileService,
    private theme: ThemeService
  ) {
    onAuthStateChanged(firebaseAuth, async (user) => {
      await this.handleAuthUser(user);
      this.authReadySubject.next(true);
    });

    this.profiles.profiles$.subscribe(() => {
      const current = this.currentMemberSubject.value;
      if (current) {
        const refreshed = this.profiles.getDisplayMember(current.id);
        if (refreshed) {
          this.currentMemberSubject.next(refreshed);
          this.theme.applyForMember(refreshed);
        }
      }
    });
  }

  get currentMember(): DisplayMember | null {
    return this.currentMemberSubject.value;
  }

  get isLoggedIn(): boolean {
    return this.currentMember !== null;
  }

  async waitUntilReady(): Promise<void> {
    if (this.authReadySubject.value) return;
    await firstValueFrom(
      this.authReady$.pipe(filter((ready) => ready), take(1))
    );
  }

  /** 驗證自訂登入密碼後，以內部 Firebase 密碼完成登入 */
  async login(memberId: string, loginPassword: string): Promise<string | null> {
    const base = this.members.find((m) => m.id === memberId);
    if (!base) return '找不到成員';

    const valid = await this.profiles.verifyLoginPassword(
      memberId,
      loginPassword
    );
    if (!valid) return '登入密碼不對';

    try {
      await this.profiles.ensureProfileExists(memberId);
      const credential = await signInWithEmailAndPassword(
        firebaseAuth,
        base.loginEmail,
        FIREBASE_INTERNAL_PASSWORD
      );
      await setDoc(
        doc(firestoreDb, 'users', credential.user.uid),
        { memberId: base.id },
        { merge: true }
      );
      const display = this.profiles.getDisplayMember(memberId);
      if (display) {
        this.currentMemberSubject.next(display);
        this.theme.applyForMember(display);
      }
      return null;
    } catch {
      return 'Firebase 登入失敗，請確認 Auth 已建立帳號且密碼為 123456';
    }
  }

  async logout(): Promise<void> {
    await signOut(firebaseAuth);
    this.currentMemberSubject.next(null);
    this.theme.applyForMember(null);
  }

  getMember(id: string): DisplayMember | undefined {
    return this.profiles.getDisplayMember(id);
  }

  getAllMembers(): DisplayMember[] {
    return this.profiles.getAllDisplayMembers();
  }

  private async handleAuthUser(user: User | null): Promise<void> {
    if (!user) {
      this.currentMemberSubject.next(null);
      this.theme.applyForMember(null);
      return;
    }
    const memberId = await this.resolveMemberId(user.uid);
    if (!memberId) {
      this.currentMemberSubject.next(null);
      return;
    }
    const display = this.profiles.getDisplayMember(memberId);
    this.currentMemberSubject.next(display ?? null);
    this.theme.applyForMember(display ?? null);
  }

  private async resolveMemberId(uid: string): Promise<string | null> {
    const snap = await getDoc(doc(firestoreDb, 'users', uid));
    return (snap.data()?.['memberId'] as string | undefined) ?? null;
  }
}
