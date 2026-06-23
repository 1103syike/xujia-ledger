export type KaomojiMood =
  | 'empty'
  | 'celebrate'
  | 'pending'
  | 'login'
  | 'rank'
  | 'audit'
  | 'expense';

export const KAOMOJI_POOLS: Record<KaomojiMood, string[]> = {
  empty: [
    '(´･ω･`)',
    '(˶ᵕ ᵕ˶)',
    '(｡•́︿•̀｡)',
    '(￣▽￣)ゞ',
    '(・_・;)',
    '(o´ω`o)',
    '(´-ω-`)',
    '(｡･∀･)ﾉﾞ',
  ],
  celebrate: [
    'ヽ(´▽`)/',
    '(ﾉ◕ヮ◕)ﾉ*:･ﾟ✧',
    '٩(ˊᗜˋ*)و',
    '(๑•̀ㅂ•́)و✧',
    '(づ｡◕‿‿◕｡)づ',
    '(*≧▽≦)',
    '(⌒▽⌒)☆',
    '＼(＾▽＾)／',
  ],
  pending: [
    '(´･_･`)',
    '(・・ )?',
    '(￣ヘ￣)',
    '(；￣Д￣)',
    '(⇀‸↼‶)',
    '(눈_눈)',
    '(￣ω￣;)',
    '(・∀・)ノ',
  ],
  login: [
    '(｡･ω･｡)ﾉ',
    '(◕‿◕✿)',
    '(ﾉ´ヮ`)ﾉ*: ･ﾟ',
    '(⌐■_■)',
    '(´∀｀)♡',
    '( ˘ ³˘)♥',
    'ヾ(≧▽≦*)o',
    '(✿◠‿◠)',
  ],
  rank: [
    '(╯°□°)╯',
    '(눈_눈)',
    '(¬_¬)',
    '(￣ー￣)',
    '(⇀‸↼‶)',
    '(；￣Д￣)',
    '(╬ಠ益ಠ)',
    '(￣ヘ￣)',
  ],
  audit: [
    '(・・ )?',
    '(￣▽￣)ノ',
    '(´･ω･`)',
    '(・∀・)',
    '(￣ω￣)',
    '(o´ω`o)',
    '(￣ー￣)ゞ',
    '(・_・ )',
  ],
  expense: [
    '(´･ω･`)',
    '(˶ᵕ ᵕ˶)',
    '(｡•̀ᴗ-)✧',
    '(￣▽￣)',
    '(o´∀`o)',
    '(・∀・)ノ',
    '(´∀｀)',
    '(ﾉ◕ヮ◕)ﾉ',
  ],
};

export function pickKaomoji(
  mood: KaomojiMood,
  seed = '',
  salt = 0
): string {
  const pool = KAOMOJI_POOLS[mood];
  if (!pool.length) return '(´･ω･`)';
  let hash = salt >>> 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return pool[hash % pool.length];
}
