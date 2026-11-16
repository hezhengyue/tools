// src/lib/image-io.ts
// 图片类工具的通用底层能力：上传校验、ObjectURL 生命周期、canvas 编码与下载。
// 各图片工具页共用，避免每页重复实现剪贴板/Blob/尺寸守卫。

import { checkImageFile } from "@/lib/image-guard";

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
  // 解码前先读文件头尺寸：几百 KB 的高压缩 PNG 也能解码成上亿像素
  const guardError = await checkImageFile(file);
  if (guardError) throw new Error(guardError);
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
