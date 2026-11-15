// src/lib/rsa-keypair.ts
// RSA 密钥对的统一生成入口（主线程执行，不依赖 Web Worker）。
//
// 两条路径：
// 1. WebCrypto（crypto.subtle）：原生实现、异步不阻塞，2048 通常 <1s、4096 数秒内。
// 2. node-forge 同步实现：仅在浏览器没有 WebCrypto 时兜底（需 HTTPS 或 localhost 才有
//    crypto.subtle，部分手机浏览器/内置 WebView 也不提供）。此路径会阻塞主线程，
//    4096 位可能要几十秒，调用方必须先给出明确提示。
//
// 历史坑：forge 的 generateKeyPair 一旦传 `workers`，就会去 new Worker('forge/prime.worker.js')，
// 该脚本不在构建产物里，拿不到脚本时 forge 只挂了 message 监听 → 回调永不触发，
// 页面一直「生成中」。`workers: 0` 也救不了（内部 `options.workers || 2` 会把 0 变回 2）。
// 所以这里坚决不传任何选项。

import * as forge from "node-forge";

export type RsaKeyPair = {
  privateKey: forge.pki.rsa.PrivateKey;
  publicKey: forge.pki.rsa.PublicKey;
  source: "webcrypto" | "js";
};

/** 当前环境能否用原生加密接口（非 HTTPS、部分内置 WebView 会返回 false） */
export function hasWebCrypto(): boolean {
  try {
    return typeof globalThis.crypto?.subtle?.generateKey === "function";
  } catch {
    return false;
  }
}

/** 二进制字符串转 Uint8Array 的反向操作，forge 的 ASN.1 解析器只吃字节串 */
function toBinaryString(bytes: Uint8Array): string {
  const CHUNK = 0x8000;
  let out = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    out += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return out;
}

async function generateWithWebCrypto(bits: 2048 | 4096): Promise<RsaKeyPair> {
  const subtle = globalThis.crypto.subtle;

  const pair = (await subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: bits,
      publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"]
  )) as CryptoKeyPair;

  const pkcs8 = new Uint8Array(await subtle.exportKey("pkcs8", pair.privateKey));
  const privateKey = forge.pki.privateKeyFromAsn1(
    forge.asn1.fromDer(toBinaryString(pkcs8))
  ) as forge.pki.rsa.PrivateKey;

  if (!privateKey?.n) throw new Error("私钥解析失败");

  // 公钥直接从私钥的 n/e 还原，省掉一次 SPKI 解析
  return {
    privateKey,
    publicKey: forge.pki.rsa.setPublicKey(privateKey.n, privateKey.e),
    source: "webcrypto",
  };
}

/** forge 的纯 JS 同步实现：会阻塞调用线程，只在没有 WebCrypto 时用 */
function generateWithJs(bits: 2048 | 4096): RsaKeyPair {
  const pair = forge.pki.rsa.generateKeyPair(bits);
  if (!pair?.privateKey?.n) throw new Error("密钥生成失败");
  return { privateKey: pair.privateKey, publicKey: pair.publicKey, source: "js" };
}

export async function generateRsaKeyPair(bits: 2048 | 4096): Promise<RsaKeyPair> {
  if (hasWebCrypto()) {
    try {
      return await generateWithWebCrypto(bits);
    } catch {
      // 原生接口报错（个别浏览器禁用了某些曲线/长度）时再退回 JS 实现
    }
  }
  return generateWithJs(bits);
}
