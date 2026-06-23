const HEX_RE = /^#?([0-9a-f]{6})$/i;

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const m = hex.trim().match(HEX_RE);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function toHex(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'))
    .join('')}`;
}

export function normalizeMemberColor(hex: string, fallback = '#FFB5A7'): string {
  const c = parseHex(hex);
  if (!c) return fallback;
  return toHex(c.r, c.g, c.b);
}

/** WCAG 相對亮度（0–1） */
export function memberColorLuminance(hex: string): number {
  const c = parseHex(hex);
  if (!c) return 0;
  const [r, g, b] = [c.r, c.g, c.b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * 代表色過淺時略為加深，確保標籤、圖例、排行榜色條在奶色系背景上仍清楚。
 */
export function memberColorSolid(hex: string): string {
  const base = normalizeMemberColor(hex);
  const c = parseHex(base)!;
  const lum = memberColorLuminance(base);
  if (lum <= 0.52) return base;

  const factor = lum > 0.72 ? 0.62 : 0.78;
  return toHex(c.r * factor, c.g * factor, c.b * factor);
}

/** 分攤標籤等柔和底色（使用使用者選擇的原色） */
export function memberColorSoftBg(hex: string): string {
  const base = normalizeMemberColor(hex);
  const c = parseHex(base)!;
  return `rgba(${c.r}, ${c.g}, ${c.b}, 0.42)`;
}

/** 標籤描邊（使用使用者選擇的原色） */
export function memberColorBorder(hex: string): string {
  const base = normalizeMemberColor(hex);
  const c = parseHex(base)!;
  return `rgba(${c.r}, ${c.g}, ${c.b}, 0.58)`;
}
