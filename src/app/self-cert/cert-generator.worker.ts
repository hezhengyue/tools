/// <reference lib="webworker" />

import * as forge from "node-forge";

interface GenerateRequest {
  requestId: string;

  commonName: string;

  sanEntries: {
    id: string;
    type: "DNS" | "IP";
    value: string;
  }[];

  keySize: 2048 | 4096;

  hash:
    | "sha256"
    | "sha384"
    | "sha512";

  days: number;

  organization?: string;

  country?: string;
}

interface SuccessResponse {
  requestId: string;

  privateKey: string;

  certificate: string;

  generatedAt: number;

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
function getDigest(
  hash:
    | "sha256"
    | "sha384"
    | "sha512"
) {
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
 * RFC 5280兼容
 * Go x509兼容
 * SFTPGo兼容
 */
function createSerialNumber(): string {
  const bytes =
    crypto.getRandomValues(
      new Uint8Array(20)
    );

  // 保证序列号始终为正整数
  bytes[0] &= 0x7f;

  return Array.from(bytes)
    .map((b) =>
      b.toString(16).padStart(2, "0")
    )
    .join("");
}

function createKeyPair(
  bits: 2048 | 4096
): Promise<forge.pki.rsa.KeyPair> {
  return new Promise(
    (resolve, reject) => {
      forge.pki.rsa.generateKeyPair(
        {
          bits,
          workers: 2,
        } as any,
        (err, keypair) => {
          if (err) {
            reject(err);
            return;
          }

          resolve(keypair);
        }
      );
    }
  );
}
self.onmessage = async (
  event: MessageEvent
) => {
  const { type, payload } =
    event.data;

  if (
    type !==
    "GENERATE_CERT"
  ) {
    return;
  }

  const request =
    payload as GenerateRequest;

  try {
    const keys =
      await createKeyPair(
        request.keySize
      );

    const cert =
      forge.pki.createCertificate();

    cert.publicKey =
      keys.publicKey;

    cert.serialNumber =
      createSerialNumber();

    /**
     * 提前5分钟生效
     * 防止客户端时间漂移
     */
    cert.validity.notBefore =
      new Date(
        Date.now() -
          5 * 60 * 1000
      );

    cert.validity.notAfter =
      new Date();

    cert.validity.notAfter.setDate(
      cert.validity.notAfter.getDate() +
        request.days
    );
        const attrs:
      forge.pki.CertificateField[] =
      [];

    if (
      request.country
    ) {
      attrs.push({
        name:
          "countryName",
        value:
          request.country,
      });
    }

    if (
      request.organization
    ) {
      attrs.push({
        name:
          "organizationName",
        value:
          request.organization,
      });
    }

    attrs.push({
      name:
        "commonName",
      value:
        request.commonName,
    });

    cert.setSubject(
      attrs
    );

    cert.setIssuer(
      attrs
    );
        const altNames =
      request.sanEntries.map(
        (item) => {
          if (
            item.type ===
            "DNS"
          ) {
            return {
              type: 2,
              value:
                item.value,
            };
          }

          return {
            type: 7,
            ip: item.value,
          };
        }
      );

    cert.setExtensions([
      {
        name:
          "basicConstraints",

        critical: true,

        cA: false,
      },

      {
        name:
          "keyUsage",

        critical: true,

        digitalSignature: true,

        keyEncipherment: true,

        dataEncipherment: true,

        keyAgreement: true,
      },

      {
        name:
          "extKeyUsage",

        serverAuth: true,

        clientAuth: true,
      },

      {
        name:
          "subjectAltName",

        altNames,
      },

      {
        name:
          "subjectKeyIdentifier",
      },

      {
        name:
          "authorityKeyIdentifier",

        keyIdentifier: true,
      },
    ]);
        cert.sign(
      keys.privateKey,
      getDigest(
        request.hash
      )
    );

    const privateKeyPem =
      forge.pki.privateKeyToPem(
        keys.privateKey
      );

    const certificatePem =
      forge.pki.certificateToPem(
        cert
      );
          const response: SuccessResponse =
      {
        requestId:
          request.requestId,

        privateKey:
          privateKeyPem,

        certificate:
          certificatePem,

        generatedAt:
          Date.now(),

        info: {
          subject:
            attrs
              .map(
                (x) =>
                  `${x.name}=${x.value}`
              )
              .join(", "),

          issuer:
            attrs
              .map(
                (x) =>
                  `${x.name}=${x.value}`
              )
              .join(", "),

          notBefore:
            cert.validity.notBefore.toISOString(),

          notAfter:
            cert.validity.notAfter.toISOString(),

          san:
            request.sanEntries.map(
              (s) =>
                `${s.type}:${s.value}`
            ),

          keySize:
            request.keySize,

          hash:
            request.hash.toUpperCase(),
        },
      };

    self.postMessage({
      type:
        "CERT_GENERATED",

      payload:
        response,
    });
      } catch (err: any) {
    self.postMessage({
      type:
        "CERT_ERROR",

      payload: {
        requestId:
          request.requestId,

        error:
          err?.message ??
          "证书生成失败",
      },
    });
  }
};