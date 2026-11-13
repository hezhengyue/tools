// app/image-tools/image-utils.ts
// 图片处理的底层能力：加载、canvas 绘制、编码、下载、ICO 封装、SVG 光栅化。

export const MAX_FILE_SIZE = 20 * 1024 * 1024;
export const MAX_PIXELS = 16_000_000;

export interface ImageSource {
  url: string;
  img: HTMLImageElement;
  name: string;
  size: number;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

/** 加载本地图片并保留 ObjectURL（调用方负责在替换/卸载时 revoke） */
export async function loadImageFile(file: File): Promise<ImageSource> {
  if (!file.type.startsWith("image/")) throw new Error("请选择图片文件（PNG / JPG / WebP / SVG 等）");
  if (file.size > MAX_FILE_SIZE) throw new Error("文件超过 20 MB，请先压缩后再处理");
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("图片解析失败，文件可能已损坏或格式不受支持"));
      img.src = url;
    });
    const width = img.naturalWidth || 512;
    const height = img.naturalHeight || 512;
    if (width * height > MAX_PIXELS) throw new Error("图片像素超过 1600 万，请先缩小尺寸");
    return { url, img, name: file.name, size: file.size };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

export function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = "image/png", quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("图片编码失败，请尝试缩小尺寸"))),
      type,
      quality,
    );
  });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function baseName(name: string): string {
  return name.replace(/\.[^.]+$/, "").replace(/[^\w\u4e00-\u9fff-]/g, "_") || "image";
}

/* ---------------- 文字水印 ---------------- */

export type WatermarkPosition =
  "tl" | "tc" | "tr" | "ml" | "mc" | "mr" | "bl" | "bc" | "br";

export interface WatermarkOptions {
  text: string;
  color: string;
  opacity: number;
  /** 字号占图片宽度的百分比 */
  scale: number;
  position: WatermarkPosition;
  tiled: boolean;
  rotation: number;
}

const ALIGN_X: Record<string, CanvasTextAlign> = { l: "left", c: "center", r: "right" };
const ALIGN_Y: Record<string, CanvasTextBaseline> = { t: "top", m: "middle", b: "bottom" };

export function drawWatermark(img: HTMLImageElement, options: WatermarkOptions): HTMLCanvasElement {
  const width = img.naturalWidth;
  const height = img.naturalHeight;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("当前浏览器不支持 Canvas 2D");
  ctx.drawImage(img, 0, 0, width, height);

  const fontSize = Math.max(12, Math.round(width * options.scale / 100));
  ctx.font = `600 ${fontSize}px -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif`;
  ctx.fillStyle = options.color;
  ctx.globalAlpha = options.opacity;

  if (options.tiled) {
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.rotate(options.rotation * Math.PI / 180);
    ctx.translate(-width / 2, -height / 2);
    const stepX = Math.max(fontSize * 4, ctx.measureText(options.text).width + fontSize * 3);
    const stepY = fontSize * 4;
    const reach = Math.hypot(width, height);
    for (let y = -reach; y < height + reach; y += stepY) {
      for (let x = -reach; x < width + reach; x += stepX) {
        ctx.fillText(options.text, x, y);
      }
    }
    ctx.restore();
  } else {
    const pad = Math.round(fontSize * 0.8);
    const horizontal = options.position[1];
    const vertical = options.position[0];
    const x = horizontal === "l" ? pad : horizontal === "c" ? width / 2 : width - pad;
    const y = vertical === "t" ? pad : vertical === "m" ? height / 2 : height - pad;
    ctx.textAlign = ALIGN_X[horizontal];
    ctx.textBaseline = ALIGN_Y[vertical];
    if (options.rotation) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(options.rotation * Math.PI / 180);
      ctx.fillText(options.text, 0, 0);
      ctx.restore();
    } else {
      ctx.fillText(options.text, x, y);
    }
  }
  ctx.globalAlpha = 1;
  return canvas;
}

/* ---------------- 圆角裁剪 ---------------- */

function roundRectPath(
  ctx: CanvasRenderingContext2D, x: number, y: number,
  width: number, height: number, radius: number,
) {
  const r = Math.max(0, Math.min(radius, Math.min(width, height) / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export function drawRounded(
  img: HTMLImageElement, radiusPercent: number, whiteBackground: boolean, squareCrop: boolean,
): HTMLCanvasElement {
  const sourceWidth = img.naturalWidth;
  const sourceHeight = img.naturalHeight;
  const side = Math.min(sourceWidth, sourceHeight);
  const width = squareCrop ? side : sourceWidth;
  const height = squareCrop ? side : sourceHeight;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("当前浏览器不支持 Canvas 2D");
  if (whiteBackground) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
  }
  const radius = Math.min(width, height) * radiusPercent / 100;
  roundRectPath(ctx, 0, 0, width, height, radius);
  ctx.clip();
  const sx = squareCrop ? (sourceWidth - side) / 2 : 0;
  const sy = squareCrop ? (sourceHeight - side) / 2 : 0;
  ctx.drawImage(img, sx, sy, width, height, 0, 0, width, height);
  return canvas;
}

/* ---------------- 九宫格切图 ---------------- */

export function sliceGrid(img: HTMLImageElement, rows: number, cols: number): HTMLCanvasElement[] {
  const width = img.naturalWidth;
  const height = img.naturalHeight;
  const cellWidth = Math.floor(width / cols);
  const cellHeight = Math.floor(height / rows);
  if (cellWidth < 1 || cellHeight < 1) throw new Error("图片尺寸太小，无法按当前行列数切分");
  const result: HTMLCanvasElement[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const sx = col * cellWidth;
      const sy = row * cellHeight;
      const sw = col === cols - 1 ? width - sx : cellWidth;
      const sh = row === rows - 1 ? height - sy : cellHeight;
      const canvas = createCanvas(sw, sh);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("当前浏览器不支持 Canvas 2D");
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      result.push(canvas);
    }
  }
  return result;
}

/* ---------------- ICO 封装（PNG 压缩方式，Vista+ / 现代浏览器支持） ---------------- */

export async function buildIco(img: HTMLImageElement, sizes: number[]): Promise<Blob> {
  const entries: { size: number; data: Uint8Array }[] = [];
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  for (const size of sizes) {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("当前浏览器不支持 Canvas 2D");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(
      img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side,
      0, 0, size, size,
    );
    const blob = await canvasToBlob(canvas);
    entries.push({ size, data: new Uint8Array(await blob.arrayBuffer()) });
  }

  const headerSize = 6;
  const directorySize = entries.length * 16;
  const dataSize = entries.reduce((sum, entry) => sum + entry.data.length, 0);
  const buffer = new ArrayBuffer(headerSize + directorySize + dataSize);
  const view = new DataView(buffer);
  view.setUint16(0, 0, true);              // reserved
  view.setUint16(2, 1, true);              // type = icon
  view.setUint16(4, entries.length, true); // count
  let offset = headerSize + directorySize;
  entries.forEach((entry, index) => {
    const position = headerSize + index * 16;
    view.setUint8(position, entry.size >= 256 ? 0 : entry.size);      // width, 0 = 256
    view.setUint8(position + 1, entry.size >= 256 ? 0 : entry.size);  // height
    view.setUint8(position + 2, 0);   // palette
    view.setUint8(position + 3, 0);   // reserved
    view.setUint16(position + 4, 1, true);   // color planes
    view.setUint16(position + 6, 32, true);  // bits per pixel
    view.setUint32(position + 8, entry.data.length, true);
    view.setUint32(position + 12, offset, true);
    new Uint8Array(buffer, offset, entry.data.length).set(entry.data);
    offset += entry.data.length;
  });
  return new Blob([buffer], { type: "image/x-icon" });
}

/** 单个尺寸的方形 PNG，用于生成 favicon 套件 */
export async function renderSquare(img: HTMLImageElement, size: number): Promise<Blob> {
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("当前浏览器不支持 Canvas 2D");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side,
    0, 0, size, size,
  );
  return canvasToBlob(canvas);
}

/* ---------------- SVG 光栅化 ---------------- */

function parseSvgSize(svg: string): { width: number; height: number } {
  const viewBox = svg.match(/viewBox\s*=\s*["']\s*[-\d.]+\s+[-\d.]+\s+([\d.]+)\s+([\d.]+)/i);
  const width = svg.match(/<svg[^>]*\bwidth\s*=\s*["']\s*([\d.]+)/i);
  const height = svg.match(/<svg[^>]*\bheight\s*=\s*["']\s*([\d.]+)/i);
  return {
    width: Number(width?.[1] ?? viewBox?.[1] ?? 512) || 512,
    height: Number(height?.[1] ?? viewBox?.[2] ?? 512) || 512,
  };
}

export async function svgToPng(svg: string, targetWidth: number): Promise<Blob> {
  const text = svg.trim();
  if (!/<svg[\s>]/i.test(text)) throw new Error("请输入以 <svg> 开头的 SVG 源码");
  if (text.length > 2 * 1024 * 1024) throw new Error("SVG 源码超过 2 MB");
  const source = parseSvgSize(text);
  const height = Math.max(1, Math.round(targetWidth * source.height / source.width));
  if (targetWidth * height > MAX_PIXELS) throw new Error("输出尺寸超过 1600 万像素，请调小宽度");

  const url = URL.createObjectURL(new Blob([text], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("SVG 解析失败，请检查标签是否闭合、属性是否合法"));
      img.src = url;
    });
    const canvas = createCanvas(targetWidth, height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("当前浏览器不支持 Canvas 2D");
    ctx.drawImage(img, 0, 0, targetWidth, height);
    return await canvasToBlob(canvas);
  } finally {
    URL.revokeObjectURL(url);
  }
}
