export const FIREBASE_INTERNAL_PASSWORD = '123456';

export interface ThemeColors {
  peach: string;
  cream: string;
  mint: string;
  lavender: string;
  coral: string;
}

export type ThemePresetId =
  | 'milk-powder'
  | 'milk-peach'
  | 'milk-orange'
  | 'milk-yellow'
  | 'milk-green'
  | 'milk-mint'
  | 'milk-blue'
  | 'milk-lavender'
  | 'milk-rose'
  | 'milk-apricot'
  | 'milk-coral'
  | 'milk-vanilla'
  | 'milk-oat'
  | 'milk-sakura'
  | 'milk-sky'
  | 'milk-lilac'
  | 'peach-soda'
  | 'mint-day'
  | 'lavender-moon';

export interface ThemePreset {
  id: ThemePresetId;
  name: string;
  colors: ThemeColors;
}

function preset(
  id: ThemePresetId,
  name: string,
  colors: ThemeColors
): ThemePreset {
  return { id, name, colors };
}

export const THEME_PRESETS: ThemePreset[] = [
  preset('milk-powder', '奶粉', {
    cream: '#FFF0F0',
    peach: '#FFD4D4',
    mint: '#E8F5E8',
    lavender: '#F0E0F0',
    coral: '#FF9EAA',
  }),
  preset('milk-peach', '奶桃', {
    cream: '#FFF8F0',
    peach: '#FFB5A7',
    mint: '#B8E8D1',
    lavender: '#D4C1EC',
    coral: '#FF8FAB',
  }),
  preset('milk-orange', '奶橘', {
    cream: '#FFF3E8',
    peach: '#FFC9A3',
    mint: '#C8E6C9',
    lavender: '#E8D5C4',
    coral: '#FF9F6B',
  }),
  preset('milk-yellow', '奶黃', {
    cream: '#FFFCF0',
    peach: '#FFE8A3',
    mint: '#D4EDDA',
    lavender: '#F5E6C8',
    coral: '#FFB84D',
  }),
  preset('milk-green', '奶綠', {
    cream: '#F4FAF5',
    peach: '#A8D5BA',
    mint: '#B8E8D1',
    lavender: '#C8E6C9',
    coral: '#6BBF8A',
  }),
  preset('milk-mint', '奶薄荷', {
    cream: '#F0FAF5',
    peach: '#6ECFAD',
    mint: '#B8E8D1',
    lavender: '#9DD9C5',
    coral: '#3DA882',
  }),
  preset('milk-blue', '奶藍', {
    cream: '#F3F8FF',
    peach: '#A0C4FF',
    mint: '#B8D4F0',
    lavender: '#C4D7F0',
    coral: '#6B9FFF',
  }),
  preset('milk-lavender', '奶紫', {
    cream: '#F7F5FF',
    peach: '#C4B5FD',
    mint: '#DDD6FE',
    lavender: '#A78BFA',
    coral: '#8B5CF6',
  }),
  preset('milk-rose', '奶玫', {
    cream: '#FFF5F8',
    peach: '#FFB7C5',
    mint: '#F0D4E0',
    lavender: '#E8C4D4',
    coral: '#FF6B8A',
  }),
  preset('milk-apricot', '杏奶', {
    cream: '#FFF9F2',
    peach: '#FFD4A8',
    mint: '#E0E8C8',
    lavender: '#F0E0D0',
    coral: '#FFAA5C',
  }),
  preset('milk-coral', '奶珊瑚', {
    cream: '#FFF5F2',
    peach: '#FFB8A8',
    mint: '#FFD4C8',
    lavender: '#F5D0C8',
    coral: '#FF7F6B',
  }),
  preset('milk-vanilla', '香草奶', {
    cream: '#FFFCF5',
    peach: '#F5E6D3',
    mint: '#E8F0E0',
    lavender: '#EDE4D4',
    coral: '#E8C4A0',
  }),
  preset('milk-oat', '燕麥奶', {
    cream: '#FAF7F2',
    peach: '#E8D8C4',
    mint: '#D8E4D0',
    lavender: '#E0D8E8',
    coral: '#C9A882',
  }),
  preset('milk-sakura', '櫻奶', {
    cream: '#FFF7F9',
    peach: '#FFD6E0',
    mint: '#F0E8F0',
    lavender: '#F5D0E0',
    coral: '#FF8FAB',
  }),
  preset('milk-sky', '晴空奶', {
    cream: '#F5FAFF',
    peach: '#B8D4F8',
    mint: '#D0E8F8',
    lavender: '#C8E0F8',
    coral: '#7EB8FF',
  }),
  preset('milk-lilac', '淡紫奶', {
    cream: '#FAF8FF',
    peach: '#D4C8F0',
    mint: '#E0D8F5',
    lavender: '#B8A8E8',
    coral: '#9B7FD4',
  }),
];

const LEGACY_PRESET_ALIASES: Record<string, ThemePresetId> = {
  'peach-soda': 'milk-peach',
  'mint-day': 'milk-mint',
  'lavender-moon': 'milk-lavender',
};

export const DEFAULT_THEME_PRESET_ID: ThemePresetId = 'milk-peach';

export const DEFAULT_THEME: ThemeColors = THEME_PRESETS[1].colors;

export function normalizeThemePresetId(id?: string | null): ThemePresetId {
  const aliased = LEGACY_PRESET_ALIASES[id ?? ''];
  if (aliased) return aliased;
  if (THEME_PRESETS.some((p) => p.id === id)) {
    return id as ThemePresetId;
  }
  return DEFAULT_THEME_PRESET_ID;
}

export function getThemePreset(id?: string | null): ThemePreset {
  const resolved = normalizeThemePresetId(id);
  return (
    THEME_PRESETS.find((p) => p.id === resolved) ??
    THEME_PRESETS.find((p) => p.id === DEFAULT_THEME_PRESET_ID)!
  );
}

export function resolveThemeColors(
  themePresetId?: string | null,
  legacyTheme?: Partial<ThemeColors> | null,
  storedPreset = false
): ThemeColors {
  const presetColors = getThemePreset(themePresetId).colors;
  if (storedPreset) {
    return { ...presetColors };
  }
  if (legacyTheme && Object.keys(legacyTheme).length > 0) {
    return { ...presetColors, ...legacyTheme };
  }
  return { ...presetColors };
}

export type AvatarSlotId = 1 | 2 | 3;
export type ChibiId =
  | 'chibi-1'
  | 'chibi-2'
  | 'chibi-3'
  | 'chibi-4'
  | 'chibi-5'
  | 'chibi-6';

export type AvatarChoice =
  | { type: 'slot'; slot: AvatarSlotId }
  | { type: 'svg'; svgId: ChibiId };

export type AvatarSlotTimestamps = Partial<Record<'1' | '2' | '3', string>>;

export const CHIBI_IDS: ChibiId[] = [
  'chibi-1',
  'chibi-2',
  'chibi-3',
  'chibi-4',
  'chibi-5',
  'chibi-6',
];

export const AVATAR_SLOT_IDS: AvatarSlotId[] = [1, 2, 3];

const DEFAULT_CHIBI_BY_MEMBER: Record<string, ChibiId> = {
  m1: 'chibi-1',
  m2: 'chibi-2',
  m3: 'chibi-3',
  m4: 'chibi-4',
  m5: 'chibi-5',
};

export function defaultChibiForMember(memberId: string): ChibiId {
  return DEFAULT_CHIBI_BY_MEMBER[memberId] ?? 'chibi-1';
}

export function defaultAvatarChoice(memberId: string): AvatarChoice {
  return { type: 'svg', svgId: defaultChibiForMember(memberId) };
}

export function resolveAvatarChoice(
  memberId: string,
  choice?: AvatarChoice | null
): AvatarChoice {
  if (!choice) return defaultAvatarChoice(memberId);
  if (choice.type === 'svg' && CHIBI_IDS.includes(choice.svgId)) return choice;
  if (choice.type === 'slot' && AVATAR_SLOT_IDS.includes(choice.slot)) return choice;
  return defaultAvatarChoice(memberId);
}

export function effectiveChibiId(
  memberId: string,
  choice: AvatarChoice
): ChibiId {
  if (choice.type === 'svg') return choice.svgId;
  return defaultChibiForMember(memberId);
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
  avatarChoice?: AvatarChoice;
  avatarSlots?: AvatarSlotTimestamps;
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
  avatarChoice: AvatarChoice;
  avatarSlots: AvatarSlotTimestamps;
}

export function displayNameOf(member: Pick<DisplayMember, 'nickname' | 'name'>): string {
  return member.nickname.trim() || member.name;
}

export interface MemberColorOption {
  name: string;
  value: string;
}

/** 代表色預設：奶奶系柔和色（用於標籤與分攤） */
export const MEMBER_COLOR_OPTIONS: MemberColorOption[] = [
  { name: '奶桃', value: '#FFB5A7' },
  { name: '奶粉', value: '#FFD4D4' },
  { name: '奶橘', value: '#FFC9A3' },
  { name: '奶黃', value: '#FFE8A3' },
  { name: '奶綠', value: '#B8E8D1' },
  { name: '薄荷奶', value: '#6ECFAD' },
  { name: '奶藍', value: '#A0C4FF' },
  { name: '奶紫', value: '#D4C1EC' },
  { name: '奶玫', value: '#FFB7C5' },
  { name: '杏奶', value: '#FFD6A5' },
  { name: '奶珊瑚', value: '#FFB8A8' },
  { name: '香草奶', value: '#F5E6D3' },
  { name: '燕麥奶', value: '#E8D8C4' },
  { name: '櫻奶', value: '#FFD6E0' },
  { name: '晴空奶', value: '#B8D4F8' },
  { name: '淡紫奶', value: '#C4B5FD' },
];

export function memberColorLabel(color: string): string | null {
  const hit = MEMBER_COLOR_OPTIONS.find(
    (o) => o.value.toUpperCase() === color.toUpperCase()
  );
  return hit?.name ?? null;
}
