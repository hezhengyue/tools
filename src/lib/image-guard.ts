// 上传图片的「解码炸弹」防护：只读文件头拿到原始尺寸，在解码之前拒绝超大图。
// 文件大小上限挡不住纯色高压缩 PNG（几百 KB 可解码成上亿像素 / 1GB RGBA）。
export const MAX_IMAGE_SIDE = 10_000;
export const MAX_IMAGE_PIXELS = 40_000_000;

function u16be(d: Uint8Array, o: number): number {
  return ((d[o] << 8) | d[o + 1]) >>> 0;
}
function u32be(d: Uint8Array, o: number): number {
  return (d[o] * 0x1000000 + (d[o + 1] << 16) + (d[o + 2] << 8) + d[o + 3]) >>> 0;
}
function u16le(d: Uint8Array, o: number): number {
  return (d[o] | (d[o + 1] << 8)) >>> 0;
}
function u32le(d: Uint8Array, o: number): number {
  return (d[o] | (d[o + 1] << 8) | (d[o + 2] << 16) | (d[o + 3] << 24)) >>> 0;
}

const JPEG_SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

function readDimensions(d: Uint8Array): { width: number; height: number } | null {
  if (d.length < 10) return null;

  // PNG: 8 字节签名 + IHDR(长度 4 + 类型 4) 后是宽高
  if (d.length >= 24 && d[0] === 0x89 && d[1] === 0x50 && d[2] === 0x4e && d[3] === 0x47) {
    return { width: u32be(d, 16), height: u32be(d, 20) };
  }
  // GIF
  if (d[0] === 0x47 && d[1] === 0x49 && d[2] === 0x46) {
    return { width: u16le(d, 6), height: u16le(d, 8) };
  }
  // BMP
  if (d.length >= 26 && d[0] === 0x42 && d[1] === 0x4d) {
    return { width: Math.abs(u32le(d, 18) | 0), height: Math.abs(u32le(d, 22) | 0) };
  }
  // WebP: RIFF....WEBP + chunk fourcc
  if (d.length >= 30 && d[0] === 0x52 && d[1] === 0x49 && d[2] === 0x46 && d[3] === 0x46
    && d[8] === 0x57 && d[9] === 0x45 && d[10] === 0x42 && d[11] === 0x50) {
    const chunk = String.fromCharCode(d[12], d[13], d[14], d[15]);
    if (chunk === "VP8X") {
      const w = 1 + (d[24] | (d[25] << 8) | (d[26] << 16));
      const h = 1 + (d[27] | (d[28] << 8) | (d[29] << 16));
      return { width: w, height: h };
    }
    if (chunk === "VP8 " && d.length >= 30) {
      return { width: u16le(d, 26) & 0x3fff, height: u16le(d, 28) & 0x3fff };
    }
    if (chunk === "VP8L" && d.length >= 25) {
      const bits = d[21] | (d[22] << 8) | (d[23] << 16) | (d[24] << 24);
      return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
    }
  }
  // JPEG: 遍历 marker 找 SOF
  if (d[0] === 0xff && d[1] === 0xd8) {
    let o = 2;
    while (o + 9 < d.length) {
      if (d[o] !== 0xff) { o += 1; continue; }
      const marker = d[o + 1];
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        o += 2;
        continue;
      }
      const len = u16be(d, o + 2);
      if (len < 2) break;
      if (JPEG_SOF.has(marker)) {
        return { height: u16be(d, o + 5), width: u16be(d, o + 7) };
      }
      o += 2 + len;
    }
  }
  return null;
}

/** 返回可读的错误文案；null 表示尺寸可接受或格式无法识别（交给浏览器解码） */
export async function checkImageFile(file: File): Promise<string | null> {
  try {
    const head = new Uint8Array(await file.slice(0, Math.min(file.size, 65_536)).arrayBuffer());
    const dim = readDimensions(head);
    if (!dim || !Number.isFinite(dim.width) || !Number.isFinite(dim.height)
      || dim.width <= 0 || dim.height <= 0) return null;
    if (dim.width > MAX_IMAGE_SIDE || dim.height > MAX_IMAGE_SIDE
      || dim.width * dim.height > MAX_IMAGE_PIXELS) {
      return `图片尺寸 ${dim.width}×${dim.height} 过大（单边上限 ${MAX_IMAGE_SIDE}px、总像素上限 ${MAX_IMAGE_PIXELS / 1_000_000} 百万），请先缩小后上传`;
    }
  } catch {
    // 读文件头失败不阻断，后续解码会给出正常错误
  }
  return null;
}
