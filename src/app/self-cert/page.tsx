"use client";

import { useMemo, useState } from "react";

import {
  Shield,
  Plus,
  Trash2,
  Download,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Laptop,
} from "lucide-react";

import ToolShell from "@/components/ToolShell";

import {
  useCertGenerator,
  type SanEntry,
} from "./useCertGenerator";

export default function SelfCertPage() {
  const {
    result,
    error,
    isGenerating,
    generateCert,
  } = useCertGenerator();

  const [commonName, setCommonName] =
    useState("");

  const [showAdvanced, setShowAdvanced] =
    useState(false);

  const [copied, setCopied] =
    useState<
      "key" | "cert" | null
    >(null);

  const [organization, setOrganization] =
    useState("");

  const [country, setCountry] =
    useState("");

  const [days, setDays] =
    useState(3650);

  const [keySize, setKeySize] =
    useState<2048 | 4096>(2048);

  const [hash, setHash] =
    useState<
      "sha256" |
      "sha384" |
      "sha512"
    >("sha256");

  const [sanEntries, setSanEntries] =
    useState<SanEntry[]>([]);

  const addSan = () => {
    setSanEntries((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        type: "DNS",
        value: "",
      },
    ]);
  };

  const removeSan = (
    id: string
  ) => {
    setSanEntries((prev) =>
      prev.filter(
        (x) => x.id !== id
      )
    );
  };

  const updateSan = (
    id: string,
    value: string
  ) => {
    setSanEntries((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              value,
            }
          : item
      )
    );
  };
    const autoSan =
    useMemo(() => {
      const value =
        commonName.trim();

      if (!value) {
        return null;
      }

      const isIPv4 =
        /^(\d{1,3}\.){3}\d{1,3}$/.test(
          value
        );

      const isIPv6 =
        value.includes(":");

      const isIP =
        isIPv4 || isIPv6;

      return {
        id: "auto-cn",

        type: isIP
          ? "IP"
          : "DNS",

        value,
      } as SanEntry;
    }, [commonName]);

  const finalSan =
    useMemo(() => {
      const map =
        new Map<
          string,
          SanEntry
        >();

      if (autoSan) {
        map.set(
          `${autoSan.type}:${autoSan.value}`.toLowerCase(),
          autoSan
        );
      }

      sanEntries.forEach(
        (item) => {
          const key =
            `${item.type}:${item.value}`
              .trim()
              .toLowerCase();

          if (
            item.value.trim() &&
            !map.has(key)
          ) {
            map.set(
              key,
              item
            );
          }
        }
      );

      return Array.from(
        map.values()
      );
    }, [
      autoSan,
      sanEntries,
    ]);
      const generate = () => {
    const cn =
      commonName.trim();

    if (!cn) {
      alert(
        "请输入证书名称"
      );

      return;
    }

    if (
      country &&
      !/^[A-Za-z]{2}$/.test(
        country
      )
    ) {
      alert(
        "国家代码必须为2位字母，例如 CN、US、KR"
      );

      return;
    }

    generateCert({
      commonName: cn,

      sanEntries: finalSan,

      keySize,

      hash,

      days,

      organization:
        organization ||
        undefined,

      country:
        country
          .trim()
          .toUpperCase() ||
        undefined,
    });
  };

  const generateLocalhost =
    () => {
      generateCert({
        commonName:
          "localhost",

        sanEntries: [
          {
            id: "1",
            type: "DNS",
            value:
              "localhost",
          },
          {
            id: "2",
            type: "IP",
            value:
              "127.0.0.1",
          },
          {
            id: "3",
            type: "IP",
            value: "::1",
          },
        ],

        keySize,

        hash,

        days,

        organization:
          organization ||
          undefined,

        country:
          country
            .trim()
            .toUpperCase() ||
          undefined,
      });
    };

  const copyText = async (
    text: string,
    type:
      | "key"
      | "cert"
  ) => {
    await navigator.clipboard.writeText(
      text
    );

    setCopied(type);

    setTimeout(() => {
      setCopied(null);
    }, 1500);
  };

  const downloadFile = (
    content: string,
    filename: string
  ) => {
    const blob =
      new Blob(
        [content],
        {
          type:
            "application/x-pem-file;charset=utf-8",
        }
      );

    const url =
      URL.createObjectURL(
        blob
      );

    const link =
      document.createElement(
        "a"
      );

    link.href = url;

    link.download =
      filename;

    link.click();

    URL.revokeObjectURL(
      url
    );
  };

  return (
    <ToolShell>
      <div className="max-w-5xl mx-auto space-y-6">

        <div>
          <h1 className="text-3xl font-bold">
            自签名证书生成器
          </h1>

          <p className="text-slate-500 mt-2">
            自动识别域名/IP，
            自动生成 SAN 扩展
          </p>
        </div>

        <div className="bg-white rounded-2xl border p-6 space-y-5">

          <div>
            <label className="font-medium">
              证书名称(CN)
            </label>

            <input
              value={
                commonName
              }
              onChange={(
                e
              ) =>
                setCommonName(
                  e.target
                    .value
                )
              }
              placeholder="example.com、*.example.com、192.168.1.100"
              className="w-full mt-2 border rounded-xl p-3"
            />
          </div>

          <div>

            <div className="flex justify-between items-center">

              <label className="font-medium">
                SAN 扩展
              </label>

              <button
                onClick={
                  addSan
                }
                className="flex items-center gap-1 text-indigo-600"
              >
                <Plus
                  size={16}
                />
                添加
              </button>

            </div>

            <div className="space-y-2 mt-3">

              {autoSan && (
                <div className="flex gap-2">

                  <span className="w-20 rounded-lg bg-green-100 text-green-700 flex items-center justify-center">
                    AUTO
                  </span>

                  <input
                    readOnly
                    value={`${autoSan.type}: ${autoSan.value}`}
                    className="flex-1 border rounded-lg p-2 bg-slate-50"
                  />

                </div>
              )}

              {sanEntries.map(
                (item) => (
                  <div
                    key={
                      item.id
                    }
                    className="flex gap-2"
                  >

                    <input
                      value={
                        item.value
                      }
                      onChange={(
                        e
                      ) =>
                        updateSan(
                          item.id,
                          e.target
                            .value
                        )
                      }
                      placeholder="额外SAN"
                      className="flex-1 border rounded-lg p-2"
                    />

                    <button
                      onClick={() =>
                        removeSan(
                          item.id
                        )
                      }
                      className="text-red-500"
                    >
                      <Trash2
                        size={
                          16
                        }
                      />
                    </button>

                  </div>
                )
              )}

            </div>

          </div>
                    <div className="border-t pt-4">

            <button
              onClick={() =>
                setShowAdvanced(
                  !showAdvanced
                )
              }
              className="flex items-center gap-2"
            >
              高级选项

              {showAdvanced ? (
                <ChevronUp size={16} />
              ) : (
                <ChevronDown size={16} />
              )}
            </button>

            {showAdvanced && (
              <div className="grid md:grid-cols-2 gap-4 mt-4">

                <input
                  placeholder="组织(O)"
                  value={organization}
                  onChange={(e) =>
                    setOrganization(
                      e.target.value
                    )
                  }
                  className="border rounded-xl p-3"
                />

                <input
                  placeholder="国家(C)"
                  maxLength={2}
                  value={country}
                  onChange={(e) =>
                    setCountry(
                      e.target.value
                    )
                  }
                  className="border rounded-xl p-3"
                />

                <input
                  type="number"
                  min={1}
                  max={3650}
                  value={days}
                  onChange={(e) =>
                    setDays(
                      Math.min(
                        3650,
                        Math.max(
                          1,
                          Number(
                            e.target.value
                          )
                        )
                      )
                    )
                  }
                  className="border rounded-xl p-3"
                />

                <select
                  value={keySize}
                  onChange={(e) =>
                    setKeySize(
                      Number(
                        e.target.value
                      ) as 2048 | 4096
                    )
                  }
                  className="border rounded-xl p-3"
                >
                  <option value={2048}>
                    RSA 2048
                  </option>

                  <option value={4096}>
                    RSA 4096
                  </option>
                </select>

                <select
                  value={hash}
                  onChange={(e) =>
                    setHash(
                      e.target.value as
                        | "sha256"
                        | "sha384"
                        | "sha512"
                    )
                  }
                  className="border rounded-xl p-3"
                >
                  <option value="sha256">
                    SHA256
                  </option>

                  <option value="sha384">
                    SHA384
                  </option>

                  <option value="sha512">
                    SHA512
                  </option>
                </select>

              </div>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-4">

            <button
              disabled={isGenerating}
              onClick={generate}
              className="bg-indigo-600 text-white py-3 rounded-xl flex items-center justify-center gap-2"
            >
              <Shield size={18} />

              {isGenerating
                ? "生成中..."
                : "生成证书"}
            </button>

            <button
              disabled={isGenerating}
              onClick={generateLocalhost}
              className="bg-emerald-600 text-white py-3 rounded-xl flex items-center justify-center gap-2"
            >
              <Laptop size={18} />

              localhost开发证书
            </button>

          </div>

          {error && (
            <div className="p-4 rounded-xl bg-red-50 text-red-600 border border-red-200">
              {error}
            </div>
          )}

        </div>

        {result && (
          <div className="space-y-6">

            <div className="bg-green-50 border border-green-200 rounded-2xl p-6">

              <h2 className="text-lg font-semibold text-green-700">
                证书生成成功
              </h2>

              <div className="grid md:grid-cols-2 gap-4 mt-4">

                <div>
                  <div className="text-slate-500 text-sm">
                    算法
                  </div>

                  <div>
                    RSA {result.info.keySize}
                  </div>
                </div>

                <div>
                  <div className="text-slate-500 text-sm">
                    签名算法
                  </div>

                  <div>
                    {result.info.hash}
                  </div>
                </div>

                <div>
                  <div className="text-slate-500 text-sm">
                    生效时间
                  </div>

                  <div>
                    {new Date(
                      result.info.notBefore
                    ).toLocaleString()}
                  </div>
                </div>

                <div>
                  <div className="text-slate-500 text-sm">
                    过期时间
                  </div>

                  <div>
                    {new Date(
                      result.info.notAfter
                    ).toLocaleString()}
                  </div>
                </div>

              </div>

              <div className="mt-4">
                <div className="text-slate-500 text-sm mb-2">
                  SAN扩展
                </div>

                <div className="flex flex-wrap gap-2">
                  {result.info.san.map(
                    (item, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 rounded-lg border bg-white text-xs"
                      >
                        {item}
                      </span>
                    )
                  )}
                </div>
              </div>

            </div>

            <div className="grid md:grid-cols-2 gap-4">

              <button
                onClick={() =>
                  downloadFile(
                    result.privateKey,
                    "private-key.pem"
                  )
                }
                className="bg-indigo-600 text-white py-3 rounded-xl flex items-center justify-center gap-2"
              >
                <Download size={16} />
                下载 private-key.pem
              </button>

              <button
                onClick={() =>
                  downloadFile(
                    result.certificate,
                    "certificate.pem"
                  )
                }
                className="bg-emerald-600 text-white py-3 rounded-xl flex items-center justify-center gap-2"
              >
                <Download size={16} />
                下载 certificate.pem
              </button>

            </div>

            <div className="grid md:grid-cols-2 gap-4">

              <button
                onClick={() =>
                  copyText(
                    result.privateKey,
                    "key"
                  )
                }
                className="border rounded-xl py-3 flex items-center justify-center gap-2"
              >
                {copied === "key"
                  ? <Check size={16} />
                  : <Copy size={16} />}

                复制私钥
              </button>

              <button
                onClick={() =>
                  copyText(
                    result.certificate,
                    "cert"
                  )
                }
                className="border rounded-xl py-3 flex items-center justify-center gap-2"
              >
                {copied === "cert"
                  ? <Check size={16} />
                  : <Copy size={16} />}

                复制证书
              </button>

            </div>

            <details className="bg-white border rounded-2xl p-4">

              <summary className="cursor-pointer font-medium">
                查看 private-key.pem
              </summary>

              <textarea
                readOnly
                value={result.privateKey}
                className="w-full mt-4 min-h-[250px] border rounded-xl p-4 font-mono text-xs"
              />

            </details>

            <details className="bg-white border rounded-2xl p-4">

              <summary className="cursor-pointer font-medium">
                查看 certificate.pem
              </summary>

              <textarea
                readOnly
                value={result.certificate}
                className="w-full mt-4 min-h-[250px] border rounded-xl p-4 font-mono text-xs"
              />

            </details>

          </div>
        )}

      </div>
    </ToolShell>
  );
}