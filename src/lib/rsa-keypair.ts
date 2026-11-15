// src/lib/rsa-keypair.ts
// RSA 密钥对的统一生成入口。
//
// 背景：node-forge 的 generateKeyPair 传 `workers` 时会去 new Worker('forge/prime.worker.js')，
// 这个脚本并不存在于我们的构建产物里，浏览器拿不到脚本 → forge 的 message 回调永不触发，
// 表现为「一直生成中」，4096 位尤其明显（自签证书 60s 超时、SSH 120s 超时都是这个原因）。
//
// 因此优先用 WebCrypto（native、几秒内完成、还自带多线程），只在没有 subtle 的
// 非安全上下文里退回 forge 的同步实现（workers: 0 会回落到 2，必须完全不带 workers 选项）。

import * as forge from "node-forge";

export type RsaKeyPair = {
  privateKey: forge.pki.rsa.PrivateKey;
  publicKey: forge.pki.rsa.PublicKey;
  source: "webcrypto" | "js";
};

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
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error("当前环境没有 WebCrypto");

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

/** forge 的纯 JS 同步实现，只在 WebCrypto 不可用时兜底（会很慢，但不会卡死） */
function generateWithJs(bits: 2048 | 4096): RsaKeyPair {
  const pair = forge.pki.rsa.generateKeyPair(bits, 0x10001);
  return { privateKey: pair.privateKey, publicKey: pair.publicKey, source: "js" };
}

export async function generateRsaKeyPair(bits: 2048 | 4096): Promise<RsaKeyPair> {
  try {
    return await generateWithWebCrypto(bits);
  } catch {
    return generateWithJs(bits);
  }
}
