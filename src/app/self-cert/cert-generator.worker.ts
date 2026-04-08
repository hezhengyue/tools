// app/self-cert/cert-generator.worker.ts
/// <reference lib="webworker" />

import * as forge from "node-forge";

// 确保 Worker 环境有 crypto
if (typeof self !== "undefined" && !self.crypto) {
  // @ts-ignore
  self.crypto = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
}

self.onmessage = function (e: MessageEvent) {
  const { type, payload } = e.data;

  if (type !== "GENERATE_CERT") return;

  const {
    requestId,
    commonName,
    sanEntries,
    keySize,
    hash,
    days,
    organization,
    country,
  } = payload;

  console.log(`[Worker] 🟢 开始处理: ${requestId} | ${keySize} 位 | ${hash}`);

  try {
    // 1. 生成密钥对
    console.log("[Worker] 🔄 生成 RSA 密钥对...");
    const keys = forge.pki.rsa.generateKeyPair(keySize);
    console.log("[Worker] ✅ 密钥对完成");

    // 2. 创建证书
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = Math.floor(Math.random() * 1000000000).toString(16).padStart(16, "0");
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setDate(cert.validity.notBefore.getDate() + days);

    // 3. 设置 Subject & Issuer
    const attrs: forge.pki.CertificateField[] = [];
    if (country) attrs.push({ name: "countryName", value: country });
    if (organization) attrs.push({ name: "organizationName", value: organization });
    attrs.push({ name: "commonName", value: commonName });

    cert.setSubject(attrs);
    cert.setIssuer(attrs);

    // 4. 设置扩展
    cert.setExtensions([
      { name: "basicConstraints", critical: true, cA: false },
      { name: "keyUsage", critical: true, digitalSignature: true, keyEncipherment: true },
      { name: "extKeyUsage", serverAuth: true, clientAuth: true },
      {
        name: "subjectAltName",
        altNames: sanEntries.map((entry: any) => {
          if (entry.type === "DNS") return { type: 2, value: entry.value };
          if (entry.type === "IP") return { type: 7, ip: entry.value };
          if (entry.type === "Email") return { type: 1, value: entry.value };
          if (entry.type === "URI") return { type: 6, value: entry.value };
          throw new Error(`不支持的 SAN 类型: ${entry.type}`);
        }),
      },
      { name: "subjectKeyIdentifier" },
      { name: "authorityKeyIdentifier" },
    ]);

    // 5. 签名证书 ✅ switch 语句修复 TS 索引问题
    let mdFactory: () => forge.md.MessageDigest;
    switch (hash) {
      case "sha384":
        // @ts-ignore - sha384 是 sha512 的变体
        mdFactory = () => forge.md.sha512.create("SHA-384");
        break;
      case "sha512":
        mdFactory = () => forge.md.sha512.create();
        break;
      case "sha256":
      default:
        mdFactory = () => forge.md.sha256.create();
        break;
    }
    cert.sign(keys.privateKey, mdFactory());
    console.log(`[Worker] ✍️ 签名完成 (${hash})`);

    // 6. 导出 PEM
    const privateKeyPem = forge.pki.privateKeyToPem(keys.privateKey);
    const certificatePem = forge.pki.certificateToPem(cert);

    // 7. 发送结果
    self.postMessage({
      type: "CERT_GENERATED",
      payload: {
        requestId,
        privateKey: privateKeyPem,
        certificate: certificatePem,
        generatedAt: Date.now(),
        info: {
          subject: `CN=${commonName}`,
          issuer: `CN=${commonName}`,
          notBefore: cert.validity.notBefore.toISOString(),
          notAfter: cert.validity.notAfter.toISOString(),
          san: sanEntries.map((e: any) => `${e.type}:${e.value}`),
        },
      },
    });
    console.log(`[Worker] 🟢 结果已发送: ${requestId}`);

  } catch (err: any) {
    console.error(`[Worker] 🔴 失败 [${requestId}]:`, err);
    self.postMessage({
      type: "CERT_ERROR",
      payload: {
        requestId,
        error: err.message || "Worker 内部错误",
        stack: err.stack,
      },
    });
  }
};