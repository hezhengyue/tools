// src/app/ssh-key/keygen.ts
// SSH 密钥生成与格式化（含 node-forge，按需动态加载，不进首屏包）。

import * as forge from "node-forge";
import { generateRsaKeyPair } from "@/lib/rsa-keypair";

export interface SshKeyPair {
  publicKey: string;
  privateKey: string;
  generatedAt: number;
  /** 实际使用的生成途径，用于界面提示 */
  source: "webcrypto" | "js";
}

export async function createSshKeyPair(bits: 2048 | 4096): Promise<SshKeyPair> {
  const pair = await generateRsaKeyPair(bits);

  return {
    // OpenSSH 格式公钥（ssh-rsa AAAA...），私钥用 PKCS#1 PEM，OpenSSH / Xshell 都能直接读
    publicKey: forge.ssh.publicKeyToOpenSSH(pair.publicKey, ""),
    privateKey: forge.pki.privateKeyToPem(pair.privateKey),
    generatedAt: Date.now(),
    source: pair.source,
  };
}
