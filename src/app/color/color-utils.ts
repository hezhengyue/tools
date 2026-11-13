// app/color/color-utils.ts
// 颜色换算全部是纯函数，便于单独校验；不依赖任何第三方库。

export interface RGB { r: number; g: number; b: number }
export interface HSL { h: number; s: number; l: number }
export interface CMYK { c: number; m: number; y: number; k: number }
export type HarmonyKind = "complementary" | "analogous" | "triadic" | "split" | "monochromatic";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function channel(hex: string) {
  return parseInt(hex, 16);
}

/** 支持 #abc / abc / #aabbcc / aabbcc / rgb(1,2,3) */
export function parseColor(input: string): RGB | null {
  const value = input.trim().toLowerCase();
  const hex = value.replace(/^#/, "");
  if (/^[0-9a-f]{3}$/.test(hex)) {
    return {
      r: channel(hex[0] + hex[0]),
      g: channel(hex[1] + hex[1]),
      b: channel(hex[2] + hex[2]),
    };
  }
  if (/^[0-9a-f]{6}$/.test(hex)) {
    return {
      r: channel(hex.slice(0, 2)),
      g: channel(hex.slice(2, 4)),
      b: channel(hex.slice(4, 6)),
    };
  }
  const rgbMatch = value.match(/^rgba?\(\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})/);
  if (rgbMatch) {
    const [r, g, b] = rgbMatch.slice(1).map(Number);
    if ([r, g, b].every((n) => n >= 0 && n <= 255)) return { r, g, b };
  }
  return null;
}

export function toHex(rgb: RGB): string {
  return `#${[rgb.r, rgb.g, rgb.b].map((n) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

export function rgbToHsl(rgb: RGB): HSL {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r: h = ((g - b) / delta) % 6; break;
      case g: h = (b - r) / delta + 2; break;
      default: h = (r - g) / delta + 4;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s, l };
}

export function hslToRgb(hsl: HSL): RGB {
  const h = ((hsl.h % 360) + 360) % 360;
  const s = clamp(hsl.s, 0, 1);
  const l = clamp(hsl.l, 0, 1);
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let parts: [number, number, number];
  if (h < 60) parts = [c, x, 0];
  else if (h < 120) parts = [x, c, 0];
  else if (h < 180) parts = [0, c, x];
  else if (h < 240) parts = [0, x, c];
  else if (h < 300) parts = [x, 0, c];
  else parts = [c, 0, x];
  return {
    r: Math.round((parts[0] + m) * 255),
    g: Math.round((parts[1] + m) * 255),
    b: Math.round((parts[2] + m) * 255),
  };
}

export function rgbToCmyk(rgb: RGB): CMYK {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const k = 1 - Math.max(r, g, b);
  if (k >= 1) return { c: 0, m: 0, y: 0, k: 100 };
  return {
    c: ((1 - r - k) / (1 - k)) * 100,
    m: ((1 - g - k) / (1 - k)) * 100,
    y: ((1 - b - k) / (1 - k)) * 100,
    k: k * 100,
  };
}

/** WCAG 2.1 相对亮度 */
export function relativeLuminance(rgb: RGB): number {
  const linear = (channel: number) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * linear(rgb.r) + 0.7152 * linear(rgb.g) + 0.0722 * linear(rgb.b);
}

export function contrastRatio(a: RGB, b: RGB): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** 在该底色上应当用深色还是浅色文字 */
export function readableText(rgb: RGB): string {
  return contrastRatio(rgb, { r: 255, g: 255, b: 255 }) >= contrastRatio(rgb, { r: 15, g: 23, b: 42 })
    ? "#FFFFFF"
    : "#0F172A";
}

const HARMONY_OFFSETS: Record<HarmonyKind, number[]> = {
  complementary: [0, 180],
  analogous: [-30, 0, 30],
  triadic: [0, 120, 240],
  split: [0, 150, 210],
  monochromatic: [0],
};

export function harmony(base: RGB, kind: HarmonyKind): RGB[] {
  const hsl = rgbToHsl(base);
  if (kind === "monochromatic") {
    return [0.55, 0.75, 1, 1.2, 1.4]
      .map((factor) => hslToRgb({ ...hsl, l: clamp(hsl.l * factor + (factor < 1 ? 0 : 0.02), 0.06, 0.94) }));
  }
  return HARMONY_OFFSETS[kind].map((offset) => hslToRgb({ ...hsl, h: hsl.h + offset }));
}

/** 4bit/通道直方图量化，取出现次数最多且彼此不太接近的若干代表色 */
export function extractPalette(pixels: Uint8ClampedArray, count: number): RGB[] {
  const buckets = new Map<number, { r: number; g: number; b: number; n: number }>();
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] < 128) continue;
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
      bucket.n += 1;
    } else {
      buckets.set(key, { r, g, b, n: 1 });
    }
  }
  const sorted = Array.from(buckets.values())
    .sort((a, b) => b.n - a.n)
    .map((bucket) => ({
      r: Math.round(bucket.r / bucket.n),
      g: Math.round(bucket.g / bucket.n),
      b: Math.round(bucket.b / bucket.n),
    }));
  const picked: RGB[] = [];
  for (const candidate of sorted) {
    if (picked.length >= count) break;
    const tooClose = picked.some((color) =>
      Math.hypot(color.r - candidate.r, color.g - candidate.g, color.b - candidate.b) < 38
    );
    if (!tooClose) picked.push(candidate);
  }
  return picked;
}
