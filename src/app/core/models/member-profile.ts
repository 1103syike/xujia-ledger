export const FIREBASE_INTERNAL_PASSWORD = '123456';

export interface ThemeColors {
  peach: string;
  cream: string;
  mint: string;
  lavender: string;
  coral: string;
}

export type ThemePresetId = 'peach-soda' | 'mint-day' | 'lavender-moon';

export interface ThemePreset {
  id: ThemePresetId;
  name: string;
  emoji: string;
  description: string;
  colors: ThemeColors;
}

/** 蜜桃汽水 — 溫暖可愛，預設風格 */
const PEACH_SODA: ThemePreset = {
  id: 'peach-soda',
  name: '蜜桃汽水',
  emoji: '🍑',
  description: '暖桃粉 × 奶油白，像碳酸飲料一樣甜',
  colors: {
    peach: '#FFB5A7',
    cream: '#FFF8F0',
    mint: '#B8E8D1',
    lavender: '#D4C1EC',
    coral: '#FF8FAB',
  },
};

/** 薄荷午後 — 清新涼爽 */
const MINT_DAY: ThemePreset = {
  id: 'mint-day',
  name: '薄荷午後',
  emoji: '🌿',
  description: '薄荷綠 × 冰涼白，清爽像夏天',
  colors: {
    peach: '#6ECFAD',
    cream: '#F2FBF7',
    mint: '#B8E8D1',
    lavender: '#9DD9C5',
    coral: '#3DA882',
  },
};

/** 薰衣草月夜 — 柔和夢幻 */
const LAVENDER_MOON: ThemePreset = {
  id: 'lavender-moon',
  name: '薰衣草月夜',
  emoji: '🌙',
  description: '淡紫 × 霧白，溫柔像傍晚天空',
  colors: {
    peach: '#C4B5FD',
    cream: '#F7F5FF',
    mint: '#DDD6FE',
    lavender: '#A78BFA',
    coral: '#8B5CF6',
  },
};

export const THEME_PRESETS: ThemePreset[] = [PEACH_SODA, MINT_DAY, LAVENDER_MOON];

export const DEFAULT_THEME_PRESET_ID: ThemePresetId = 'peach-soda';

export const DEFAULT_THEME: ThemeColors = PEACH_SODA.colors;

export function getThemePreset(id?: string | null): ThemePreset {
  return (
    THEME_PRESETS.find((p) => p.id === id) ??
    THEME_PRESETS.find((p) => p.id === DEFAULT_THEME_PRESET_ID)!
  );
}

export function resolveThemeColors(
  themePresetId?: string | null,
  legacyTheme?: Partial<ThemeColors> | null,
  storedPreset = false
): ThemeColors {
  const preset = getThemePreset(themePresetId);
  if (storedPreset) {
    return { ...preset.colors };
  }
  if (legacyTheme && Object.keys(legacyTheme).length > 0) {
    return { ...preset.colors, ...legacyTheme };
  }
  return { ...preset.colors };
}

export interface MemberProfile {
  memberId: string;
  name: string;
  nickname: string;
  emoji: string;
  color: string;
  loginPassword: string;
  themePresetId: ThemePresetId;
  theme?: ThemeColors;
}

export interface DisplayMember {
  id: string;
  name: string;
  nickname: string;
  emoji: string;
  color: string;
  loginEmail: string;
  themePresetId: ThemePresetId;
  theme: ThemeColors;
}

export function displayNameOf(member: Pick<DisplayMember, 'nickname' | 'name'>): string {
  return member.nickname.trim() || member.name;
}
