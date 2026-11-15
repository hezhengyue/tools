// src/app/self-cert/cert.ts
// 自签证书生成（含 node-forge，按需动态加载）。
// 在主线程执行：WebCrypto 生成密钥是异步的，不会卡界面；只有没有 WebCrypto 时才会
// 退回 forge 的同步实现，调用方需要先给出提示。

import * as forge from "node-forge";
import { generateRsaKeyPair } from "@/lib/rsa-keypair";

export type SanType = "DNS" | "IP";

export interface SanEntry {
  id: string;
  type: SanType;
  value: string;
}

export interface CertRequestPayload {
  commonName: string;
  sanEntries: { id?: string; type: SanType; value: string }[];
  keySize: 2048 | 4096;
  hash: "sha256" | "sha384" | "sha512";
  days: number;
  organization?: string;
  country?: string;
}

export interface CertResult {
  privateKey: string;
  certificate: string;
  generatedAt: number;
  source: "webcrypto" | "js";
  info: {
    subject: string;
    issuer: string;
    notBefore: string;
    notAfter: string;
    san: string[];
    keySize: number;
    hash: string;
  };
}

function getDigest(hash: CertRequestPayload["hash"]) {
  switch (hash) {
    case "sha384":
      return forge.md.sha384.create();
    case "sha512":
      return forge.md.sha512.create();
    default:
      return forge.md.sha256.create();
  }
}

/**
 * RFC 5280 兼容 / Go x509 兼容 / SFTPGo 兼容
 */
function createSerialNumber(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  // 保证序列号始终为正整数
  bytes[0] &= 0x7f;
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function createSelfSignedCert(request: CertRequestPayload): Promise<CertResult> {
  const keys = await generateRsaKeyPair(request.keySize);

  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = createSerialNumber();

  // 提前 5 分钟生效，防止客户端时间漂移
  cert.validity.notBefore = new Date(Date.now() - 5 * 60 * 1000);
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setDate(cert.validity.notAfter.getDate() + request.days);

  const attrs: forge.pki.CertificateField[] = [];
  if (request.country) attrs.push({ name: "countryName", value: request.country });
  if (request.organization) attrs.push({ name: "organizationName", value: request.organization });
  attrs.push({ name: "commonName", value: request.commonName });

  cert.setSubject(attrs);
  cert.setIssuer(attrs);

  const altNames = request.sanEntries.map((item) =>
    item.type === "DNS"
      ? { type: 2, value: item.value }
      : { type: 7, ip: item.value }
  );

  cert.setExtensions([
    { name: "basicConstraints", critical: true, cA: false },
    {
      name: "keyUsage",
      critical: true,
      digitalSignature: true,
      keyEncipherment: true,
      dataEncipherment: true,
      keyAgreement: true,
    },
    { name: "extKeyUsage", serverAuth: true, clientAuth: true },
    { name: "subjectAltName", altNames },
    { name: "subjectKeyIdentifier" },
    { name: "authorityKeyIdentifier", keyIdentifier: true },
  ]);

  cert.sign(keys.privateKey, getDigest(request.hash));

  return {
    privateKey: forge.pki.privateKeyToPem(keys.privateKey),
    certificate: forge.pki.certificateToPem(cert),
    generatedAt: Date.now(),
    source: keys.source,
    info: {
      subject: attrs.map((x) => `${x.name}=${x.value}`).join(", "),
      issuer: attrs.map((x) => `${x.name}=${x.value}`).join(", "),
      notBefore: cert.validity.notBefore.toISOString(),
      notAfter: cert.validity.notAfter.toISOString(),
      san: request.sanEntries.map((s) => `${s.type}:${s.value}`),
      keySize: request.keySize,
      hash: request.hash.toUpperCase(),
    },
  };
}
