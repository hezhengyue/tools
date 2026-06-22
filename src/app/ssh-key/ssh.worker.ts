import * as forge from "node-forge";

/**
 * RSA -> OpenSSH 公钥
 */
function rsaToSsh(publicKey: forge.pki.rsa.PublicKey) {
  return forge.ssh.publicKeyToOpenSSH(publicKey, "");
}

self.onmessage = (e: MessageEvent) => {
  const { bits } = e.data;

  try {
    const kp = forge.pki.rsa.generateKeyPair({
      bits,
      workers: -1,
    });

    self.postMessage({
      type: "rsa",
      publicKey: rsaToSsh(kp.publicKey),
      privateKey: forge.pki.privateKeyToPem(kp.privateKey),
      generatedAt: Date.now(),
    });
  } catch (err: any) {
    self.postMessage({
      type: "rsa",
      error: err?.message || "生成失败",
    });
  }
};