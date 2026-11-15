// src/app/file-hash/hash-core.ts
// 分块流式哈希核心：Worker 与主线程兜底共用同一份实现。
// 每块读一次，内存占用恒定，几个 GB 的镜像也不会把整个文件读进内存。
// 四种算法共用同一份字节，所以一次读取能算出四个值。

import CryptoJSCore from "crypto-js/core";
import "crypto-js/md5";
import "crypto-js/sha1";
import "crypto-js/sha256";
import "crypto-js/sha512";
import { HASH_ALGOS, type HashAlgo, type Hashes } from "./constants";

type WordArray = CryptoJS.lib.WordArray;
// @types/crypto-js 未导出顶层 Hasher 接口，从 create() 的返回类型推导
type Hasher = ReturnType<typeof CryptoJSCore.algo.MD5.create>;

export interface HashProgress {
  loaded: number;
  total: number;
}

/** ArrayBuffer → WordArray。块大小是 4 的倍数，末尾不足 4 字节时由 sigBytes 处理填充 */
export function toWordArray(buffer: ArrayBuffer): WordArray {
  const bytes = new Uint8Array(buffer);
  const words = new Array<number>(Math.ceil(bytes.length / 4));
  for (let i = 0, j = 0; i < bytes.length; i += 4, j += 1) {
    words[j] = ((bytes[i] << 24) | (bytes[i + 1] << 16) | (bytes[i + 2] << 8) | (bytes[i + 3] ?? 0)) >>> 0;
  }
  return CryptoJSCore.lib.WordArray.create(words, bytes.length);
}

const FACTORIES: Record<HashAlgo, () => Hasher> = {
  MD5: () => CryptoJSCore.algo.MD5.create(),
  SHA1: () => CryptoJSCore.algo.SHA1.create(),
  SHA256: () => CryptoJSCore.algo.SHA256.create(),
  SHA512: () => CryptoJSCore.algo.SHA512.create(),
};

export interface HashFileOptions {
  /** 每块大小，默认 1MB：块太大单次阻塞久，太小进度回调太频繁 */
  chunkSize?: number;
  /** 返回 true 时中止计算（用户点了停止） */
  shouldStop?: () => boolean;
  onProgress?: (progress: HashProgress) => void;
}

export async function hashFile(file: File, options: HashFileOptions = {}): Promise<Hashes> {
  const { chunkSize = 1024 * 1024, shouldStop, onProgress } = options;

  const hashers = {} as Record<HashAlgo, Hasher>;
  for (const algo of HASH_ALGOS) hashers[algo] = FACTORIES[algo]();

  let offset = 0;
  while (offset < file.size) {
    if (shouldStop?.()) throw new Error("__STOPPED__");

    const buffer = await file.slice(offset, offset + chunkSize).arrayBuffer();
    // 文件在计算过程中被外部截断时 slice 可能返回 0 字节，不防护会死循环刷进度
    if (buffer.byteLength === 0) throw new Error("文件读取中断，请重新选择文件");

    const wordArray = toWordArray(buffer);
    for (const algo of HASH_ALGOS) hashers[algo].update(wordArray);
    offset += buffer.byteLength;

    onProgress?.({ loaded: Math.min(offset, file.size), total: file.size });

    // 每块之间让出主线程：crypto-js 是纯 JS，连续算几 MB 会让页面掉帧
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  const hashes = {} as Hashes;
  for (const algo of HASH_ALGOS) {
    hashes[algo] = hashers[algo].finalize().toString(CryptoJSCore.enc.Hex);
  }
  return hashes;
}
