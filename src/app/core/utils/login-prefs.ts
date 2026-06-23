const RECENT_MEMBERS_KEY = 'xujia-ledger.recentMembers';
const PASSWORDS_KEY = 'xujia-ledger.loginPasswords';
const MAX_RECENT = 5;

export interface LoginPrefs {
  recentMemberIds: string[];
  passwordsByMember: Record<string, string>;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or private mode */
  }
}

export function loadLoginPrefs(): LoginPrefs {
  return {
    recentMemberIds: readJson<string[]>(RECENT_MEMBERS_KEY, []),
    passwordsByMember: readJson<Record<string, string>>(PASSWORDS_KEY, {}),
  };
}

export function getSavedPassword(memberId: string): string | null {
  const pwd = loadLoginPrefs().passwordsByMember[memberId];
  return pwd || null;
}

export function getLastMemberId(): string | null {
  const ids = loadLoginPrefs().recentMemberIds;
  return ids[0] ?? null;
}

/** 成功登入後記住成員與密碼 */
export function recordSuccessfulLogin(
  memberId: string,
  password: string
): void {
  const prefs = loadLoginPrefs();
  const recent = [
    memberId,
    ...prefs.recentMemberIds.filter((id) => id !== memberId),
  ].slice(0, MAX_RECENT);

  writeJson(RECENT_MEMBERS_KEY, recent);
  writeJson(PASSWORDS_KEY, {
    ...prefs.passwordsByMember,
    [memberId]: password,
  });
}

/** 近期成員排前，其餘維持原順序 */
export function sortMembersByRecency<T extends { id: string }>(
  members: T[],
  recentIds: string[]
): T[] {
  const rank = new Map(recentIds.map((id, i) => [id, i]));
  return [...members].sort((a, b) => {
    const ra = rank.get(a.id);
    const rb = rank.get(b.id);
    if (ra != null && rb != null) return ra - rb;
    if (ra != null) return -1;
    if (rb != null) return 1;
    return 0;
  });
}

export function isRecentMember(memberId: string, recentIds: string[]): boolean {
  return recentIds.includes(memberId);
}
