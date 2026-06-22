import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { DEFAULT_MEMBERS, Member } from '../models';

const MEMBER_KEY = 'xujia-current-member';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly currentMemberSubject = new BehaviorSubject<Member | null>(
    this.loadStoredMember()
  );

  readonly currentMember$ = this.currentMemberSubject.asObservable();
  readonly members = DEFAULT_MEMBERS;

  get currentMember(): Member | null {
    return this.currentMemberSubject.value;
  }

  get isLoggedIn(): boolean {
    return this.currentMember !== null;
  }

  login(memberId: string): void {
    const member = this.members.find((m) => m.id === memberId);
    if (!member) return;
    localStorage.setItem(MEMBER_KEY, member.id);
    this.currentMemberSubject.next(member);
  }

  logout(): void {
    localStorage.removeItem(MEMBER_KEY);
    this.currentMemberSubject.next(null);
  }

  getMember(id: string): Member | undefined {
    return this.members.find((m) => m.id === id);
  }

  private loadStoredMember(): Member | null {
    const id = localStorage.getItem(MEMBER_KEY);
    if (!id) return null;
    return this.members.find((m) => m.id === id) ?? null;
  }
}
