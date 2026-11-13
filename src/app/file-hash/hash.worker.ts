// app/file-hash/hash.worker.ts
// 分块流式哈希：用 crypto-js 的增量 hasher，每 2MB 读一次，内存占用恒定，
// 因此校验几个 GB 的 ISO 也不会把整个文件读进内存。四种算法共用同一份字节。
/// <reference lib="webworker" />

import CryptoJSCore from "crypto-js/core";
import "crypto-js/md5";
import "crypto-js/sha1";
import "crypto-js/sha256";
import "crypto-js/sha512";
import {
  HASH_ALGOS,
  type HashAlgo,
  type HashRequest,
  type HashResponse,
  type Hashes,
} from "./constants";

type WordArray = CryptoJS.lib.WordArray;
// @types/crypto-js 未导出顶层 Hasher 接口，从 create() 的返回类型推导
type Hasher = ReturnType<typeof CryptoJSCore.algo.MD5.create>;

const CHUNK = 2 * 1024 * 1024;

/** ArrayBuffer → WordArray。块大小是 4 的倍数，末尾不足 4 字节时由 sigBytes 处理填充 */
function toWordArray(buffer: ArrayBuffer): WordArray {
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

self.onmessage = async (event: MessageEvent<HashRequest>) => {
  const { id, file } = event.data;
  const respond = (payload: HashResponse) => self.postMessage(payload);

  try {
    const hashers = {} as Record<HashAlgo, Hasher>;
    for (const algo of HASH_ALGOS) hashers[algo] = FACTORIES[algo]();

    let offset = 0;
    while (offset < file.size) {
      const buffer = await file.slice(offset, offset + CHUNK).arrayBuffer();
      const wordArray = toWordArray(buffer);
      for (const algo of HASH_ALGOS) hashers[algo].update(wordArray);
      offset += buffer.byteLength;
      respond({ type: "progress", id, loaded: offset, total: file.size });
    }

    const hashes = {} as Hashes;
    for (const algo of HASH_ALGOS) {
      hashes[algo] = hashers[algo].finalize().toString(CryptoJSCore.enc.Hex);
    }
    respond({ type: "done", id, hashes });
  } catch (error) {
    respond({ type: "error", id, message: error instanceof Error ? error.message : String(error) });
  }
};
