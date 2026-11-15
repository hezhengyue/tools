import * as forge from "node-forge";
import { generateRsaKeyPair } from "../../lib/rsa-keypair";

/**
 * RSA -> OpenSSH 公钥
 */
function rsaToSsh(publicKey: forge.pki.rsa.PublicKey) {
  return forge.ssh.publicKeyToOpenSSH(publicKey, "");
}

self.onmessage = async (e: MessageEvent) => {
  const { bits, requestId } = e.data as { bits: 2048 | 4096; requestId: number };

  try {
    // WebCrypto 优先：4096 位也能在几秒内完成，且不会像 forge 的 workers 选项那样卡死
    const kp = await generateRsaKeyPair(bits);

    self.postMessage({
      type: "rsa",
      requestId,
      publicKey: rsaToSsh(kp.publicKey),
      privateKey: forge.pki.privateKeyToPem(kp.privateKey),
      generatedAt: Date.now(),
    });
  } catch (err: unknown) {
    self.postMessage({
      type: "rsa",
      requestId,
      error: err instanceof Error ? err.message : "生成失败",
    });
  }
};
