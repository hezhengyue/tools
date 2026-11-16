// app/image-transparent/transparent.ts
// 把纯色背景（logo、图标、白底截图）换成透明：从四边泛洪，只删与边缘连通的背景色，
// 主体内部的同色区域（如字母 O 的内圈）不会被误删。边界像素按颜色距离给半透明，
// 让抗锯齿边缘过渡自然，不出现锯齿或白边。

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface RemoveOptions {
  /** 0~100，越大删得越狠 */
  tolerance: number;
  /** 0~3，边界柔化档位 */
  feather: number;
  /** 背景色，null 表示按四角自动取色 */
  color: Rgb | null;
  /** 是否连图内不与边缘连通、但与背景同色的像素一起删除 */
  alsoInside: boolean;
}

export interface RemoveResult {
  background: Rgb;
  /** 被设为透明的像素占比 0~1 */
  removedRatio: number;
  /** 处理耗时（毫秒） */
  elapsed: number;
}

/** 感知加权的颜色距离，最大值约 255；比纯欧氏距离更接近肉眼判断 */
function distance(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return Math.sqrt(0.299 * dr * dr + 0.587 * dg * dg + 0.114 * db * db);
}

/** 四角各取一块求平均，跳过全透明像素；四角不一致时（照片）也能给出一个折中色 */
export function detectBackground(data: Uint8ClampedArray, width: number, height: number): Rgb {
  const block = Math.max(2, Math.min(8, Math.floor(Math.min(width, height) / 20)));
  const corners: [number, number][] = [
    [0, 0],
    [width - block, 0],
    [0, height - block],
    [width - block, height - block],
  ];
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;
  for (const [startX, startY] of corners) {
    for (let y = startY; y < startY + block && y < height; y += 1) {
      for (let x = startX; x < startX + block && x < width; x += 1) {
        const offset = (y * width + x) * 4;
        if (data[offset + 3] < 32) continue;
        r += data[offset];
        g += data[offset + 1];
        b += data[offset + 2];
        count += 1;
      }
    }
  }
  if (!count) return { r: 255, g: 255, b: 255 };
  return {
    r: Math.round(r / count),
    g: Math.round(g / count),
    b: Math.round(b / count),
  };
}

/** 在给定画布上就地执行抠背景，返回统计信息 */
export function removeBackground(canvas: HTMLCanvasElement, options: RemoveOptions): RemoveResult {
  const startedAt = performance.now();
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("当前浏览器不支持 Canvas 2D");

  const width = canvas.width;
  const height = canvas.height;
  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;
  const background = options.color ?? detectBackground(data, width, height);
  const { r: bgR, g: bgG, b: bgB } = background;

  // 容差 0~100 映射到 0~255 的感知距离；默认档位下白底 JPEG 的噪点也能覆盖
  const limit = Math.max(1, options.tolerance) * 2.55;
  const softLimit = limit * (1 + options.feather * 0.55);

  const total = width * height;
  const removed = new Uint8Array(total);
  // 只存边界前沿，内存随周长而不是面积增长；纯色底的 logo 通常只有几百个元素
  const stack: number[] = [];

  /** 边缘像素入栈：只有与画布四边连通、且颜色接近背景的像素才可能是底色 */
  const pushIfBackground = (x: number, y: number) => {
    const index = y * width + x;
    if (removed[index]) return;
    const offset = index * 4;
    if (data[offset + 3] === 0) {
      removed[index] = 1;
      stack.push(index);
      return;
    }
    if (distance(data[offset], data[offset + 1], data[offset + 2], bgR, bgG, bgB) <= limit) {
      removed[index] = 1;
      stack.push(index);
    }
  };

  for (let x = 0; x < width; x += 1) {
    pushIfBackground(x, 0);
    pushIfBackground(x, height - 1);
  }
  for (let y = 1; y < height - 1; y += 1) {
    pushIfBackground(0, y);
    pushIfBackground(width - 1, y);
  }

  // 泛洪：4 邻域，避免斜向穿过主体边缘漏进内部
  while (stack.length > 0) {
    const index = stack.pop()!;
    const x = index % width;
    const y = (index - x) / width;
    if (x > 0) pushIfBackground(x - 1, y);
    if (x + 1 < width) pushIfBackground(x + 1, y);
    if (y > 0) pushIfBackground(x, y - 1);
    if (y + 1 < height) pushIfBackground(x, y + 1);
  }

  if (options.alsoInside) {
    for (let index = 0; index < total; index += 1) {
      if (removed[index]) continue;
      const offset = index * 4;
      if (data[offset + 3] === 0) continue;
      if (distance(data[offset], data[offset + 1], data[offset + 2], bgR, bgG, bgB) <= limit) {
        removed[index] = 1;
      }
    }
  }

  let removedCount = 0;
  for (let index = 0; index < total; index += 1) {
    const offset = index * 4;
    if (removed[index]) {
      data[offset + 3] = 0;
      removedCount += 1;
      continue;
    }
    // 边界柔化：只处理紧邻透明区的像素，按颜色距离给 0~1 的 alpha
    const x = index % width;
    const y = (index - x) / width;
    const nearRemoved =
      (x > 0 && removed[index - 1]) ||
      (x + 1 < width && removed[index + 1]) ||
      (y > 0 && removed[index - width]) ||
      (y + 1 < height && removed[index + width]);
    if (!nearRemoved) continue;
    const d = distance(data[offset], data[offset + 1], data[offset + 2], bgR, bgG, bgB);
    const alpha = d >= softLimit ? 1 : Math.max(0, (d - limit) / (softLimit - limit));
    data[offset + 3] = Math.round(data[offset + 3] * Math.min(1, alpha));
  }

  ctx.putImageData(image, 0, 0);
  return {
    background,
    removedRatio: removedCount / total,
    elapsed: Math.round(performance.now() - startedAt),
  };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

export function hexToRgb(hex: string): Rgb | null {
  const match = /^#?([\da-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const value = Number.parseInt(match[1], 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}
