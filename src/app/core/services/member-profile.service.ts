import { Injectable, OnDestroy } from '@angular/core';
import {
  collection,
  deleteField,
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  updateDoc,
  UpdateData,
} from 'firebase/firestore';
import { BehaviorSubject } from 'rxjs';
import { firestoreDb } from '../config/firebase';
import {
  DEFAULT_MEMBERS,
  DEFAULT_THEME_PRESET_ID,
  AvatarChoice,
  AvatarSlotId,
  DisplayMember,
  MemberProfile,
  resolveAvatarChoice,
  resolveThemeColors,
  ThemePresetId,
} from '../models';

function buildDefaultProfile(base: (typeof DEFAULT_MEMBERS)[0]): MemberProfile {
  return {
    memberId: base.id,
    name: base.name,
    nickname: base.name,
    emoji: base.emoji,
    color: base.color,
    loginPassword: '1234',
    themePresetId: DEFAULT_THEME_PRESET_ID,
  };
}

@Injectable({ providedIn: 'root' })
export class MemberProfileService implements OnDestroy {
  private readonly profilesSubject = new BehaviorSubject<
    Record<string, MemberProfile>
  >(this.buildDefaultMap());
  /** Firestore 文件內有明確儲存 themePresetId 的成員 */
  private readonly storedPresetIds = new Set<string>();
  private unsub?: () => void;

  readonly profiles$ = this.profilesSubject.asObservable();

  constructor() {
    this.attachListener();
  }

  ngOnDestroy(): void {
    this.unsub?.();
  }

  get profiles(): Record<string, MemberProfile> {
    return this.profilesSubject.value;
  }

  getDisplayMember(memberId: string): DisplayMember | undefined {
    const base = DEFAULT_MEMBERS.find((m) => m.id === memberId);
    const profile = this.profiles[memberId];
    if (!base || !profile) return undefined;
    return this.toDisplayMember(base, profile);
  }

  getAllDisplayMembers(): DisplayMember[] {
    return DEFAULT_MEMBERS.map((base) =>
      this.toDisplayMember(base, this.profiles[base.id] ?? buildDefaultProfile(base))
    );
  }

  async verifyLoginPassword(
    memberId: string,
    password: string
  ): Promise<boolean> {
    const snap = await getDoc(doc(firestoreDb, 'memberProfiles', memberId));
    const stored = snap.exists()
      ? (snap.data() as MemberProfile).loginPassword
      : buildDefaultProfile(DEFAULT_MEMBERS.find((m) => m.id === memberId)!).loginPassword;
    return stored === password;
  }

  async ensureProfileExists(memberId: string): Promise<void> {
    const ref = doc(firestoreDb, 'memberProfiles', memberId);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      const base = DEFAULT_MEMBERS.find((m) => m.id === memberId);
      if (base) {
        await setDoc(ref, buildDefaultProfile(base));
      }
    }
  }

  async updateProfile(
    memberId: string,
    patch: Partial<
      Pick<
        MemberProfile,
        | 'nickname'
        | 'emoji'
        | 'color'
        | 'loginPassword'
        | 'themePresetId'
        | 'avatarChoice'
      >
    >
  ): Promise<string | null> {
    try {
      const payload: UpdateData<MemberProfile> = { ...patch };
      if (patch.themePresetId != null) {
        payload.theme = deleteField();
      }
      await updateDoc(doc(firestoreDb, 'memberProfiles', memberId), payload);
      return null;
    } catch {
      return '儲存失敗，請稍後再試';
    }
  }

  async updateAvatarSlot(
    memberId: string,
    slot: AvatarSlotId,
    timestamp: string | null
  ): Promise<string | null> {
    try {
      const key = String(slot) as '1' | '2' | '3';
      const payload: UpdateData<MemberProfile> =
        timestamp != null
          ? { [`avatarSlots.${key}`]: timestamp }
          : { [`avatarSlots.${key}`]: deleteField() };
      await updateDoc(doc(firestoreDb, 'memberProfiles', memberId), payload);
      return null;
    } catch {
      return '更新頭像槽位失敗';
    }
  }

  private attachListener(): void {
    this.unsub = onSnapshot(collection(firestoreDb, 'memberProfiles'), (snap) => {
      const map = this.buildDefaultMap();
      const stored = new Set<string>();
      snap.docs.forEach((d) => {
        const data = d.data() as MemberProfile;
        const hasStoredPreset = 'themePresetId' in data && data.themePresetId != null;
        if (hasStoredPreset) {
          stored.add(d.id);
        }
        map[d.id] = {
          ...map[d.id],
          ...data,
          memberId: d.id,
          themePresetId: (data.themePresetId as ThemePresetId) ?? map[d.id].themePresetId,
        };
      });
      this.storedPresetIds.clear();
      stored.forEach((id) => this.storedPresetIds.add(id));
      this.profilesSubject.next(map);
    });
  }

  private buildDefaultMap(): Record<string, MemberProfile> {
    const map: Record<string, MemberProfile> = {};
    DEFAULT_MEMBERS.forEach((m) => {
      map[m.id] = buildDefaultProfile(m);
    });
    return map;
  }

  private toDisplayMember(
    base: (typeof DEFAULT_MEMBERS)[0],
    profile: MemberProfile
  ): DisplayMember {
    const theme = resolveThemeColors(
      profile.themePresetId,
      profile.theme,
      this.storedPresetIds.has(base.id)
    );
    return {
      id: base.id,
      name: profile.name || base.name,
      nickname: profile.nickname,
      emoji: profile.emoji || base.emoji,
      color: profile.color || base.color,
      loginEmail: base.loginEmail,
      themePresetId: profile.themePresetId ?? DEFAULT_THEME_PRESET_ID,
      theme,
      avatarChoice: resolveAvatarChoice(base.id, profile.avatarChoice),
      avatarSlots: { ...(profile.avatarSlots ?? {}) },
    };
  }
}
