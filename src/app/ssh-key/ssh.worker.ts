import * as forge from "node-forge";

/**
 * 转 SSH RSA 公钥（标准格式）
 */
function rsaToSsh(publicKey: forge.pki.rsa.PublicKey) {
  return forge.ssh.publicKeyToOpenSSH(publicKey, "");
}

/**
 * Ed25519 用 WebCrypto（浏览器安全方案）
 */
async function generateEd25519() {
  const key = await crypto.subtle.generateKey(
    {
      name: "Ed25519",
    },
    true,
    ["sign", "verify"]
  );

  const publicKey = await crypto.subtle.exportKey("spki", key.publicKey);
  const privateKey = await crypto.subtle.exportKey("pkcs8", key.privateKey);

  const publicB64 = btoa(String.fromCharCode(...new Uint8Array(publicKey)));
  const privateB64 = btoa(String.fromCharCode(...new Uint8Array(privateKey)));

  return {
    publicKey: `ssh-ed25519 ${publicB64}`,
    privateKey: `-----BEGIN PRIVATE KEY-----\n${privateB64}\n-----END PRIVATE KEY-----`,
  };
}

self.onmessage = async (e: MessageEvent) => {
  const { type, bits } = e.data;

  try {
    // =====================
    // RSA
    // =====================
    if (type === "rsa") {
      const kp = forge.pki.rsa.generateKeyPair({
        bits,
        workers: -1,
      });

      self.postMessage({
        publicKey: rsaToSsh(kp.publicKey),
        privateKey: forge.pki.privateKeyToPem(kp.privateKey),
        type,
        generatedAt: Date.now(),
      });

      return;
    }

    // =====================
    // Ed25519 (稳定版)
    // =====================
    const ed = await generateEd25519();

    self.postMessage({
      publicKey: ed.publicKey,
      privateKey: ed.privateKey,
      type,
      generatedAt: Date.now(),
    });
  } catch (err: any) {
    self.postMessage({
      error: err.message || "生成失败",
    });
  }
};