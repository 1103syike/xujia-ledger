export const ILLUSTRATIONS = {
  logo: 'assets/illustrations/xujia-app-icon.svg',
  group: 'assets/illustrations/xujia-characters-group.png',
  empty: 'assets/illustrations/xujia-deco-empty-state.png',
  celebrate: 'assets/illustrations/xujia-deco-celebrate.png',
  stickers: 'assets/illustrations/xujia-deco-stickers.png',
} as const;

export type IllustrationKind = keyof typeof ILLUSTRATIONS;
