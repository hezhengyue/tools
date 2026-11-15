"use client";

import { useMemo, useState } from "react";

import {
  Shield,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Laptop,
  CheckCircle2,
} from "lucide-react";

import ToolShell from "@/components/ToolShell";
import {
  Notice,
  OutputBlock,
  Button,
  IconButton,
  Badge,
  Panel,
  KeyRow,
} from "@/components/ui/ToolUI";

import {
  useCertGenerator,
  type SanEntry,
  type SanType,
} from "./useCertGenerator";
import { randomId } from "@/lib/random";

/** 严格 IPv4：四段、无前导零、每段 ≤255（forge.bytesFromIP 对非法值不抛错，必须自己挡住） */
function isIPv4Literal(value: string): boolean {
  const parts = value.split(".");
  return parts.length === 4
    && parts.every((part) => /^(0|[1-9]\d{0,2})$/.test(part) && Number(part) <= 255);
}

/** 严格 IPv6：允许一次 :: 压缩与末尾 IPv4，禁止 zone id 与随意的 hex 串 */
function isIPv6Literal(value: string): boolean {
  if (!value.includes(":") || value.includes("%")) return false;
  const halves = value.split("::");
  if (halves.length > 2) return false;
  let groups = 0;
  for (const half of halves) {
    if (!half) continue;
    for (const part of half.split(":")) {
      if (!part) return false;
      if (part.includes(".")) {
        if (!isIPv4Literal(part)) return false;
        groups += 2;
      } else {
        if (!/^[0-9a-fA-F]{1,4}$/.test(part)) return false;
        groups += 1;
      }
    }
  }
  return halves.length === 2 ? groups <= 7 : groups === 8;
}

function validSan(entry: SanEntry): boolean {
  const value = entry.value.trim();
  if (!value) return false;
  if (entry.type === "IP") return isIPv4Literal(value) || isIPv6Literal(value);
  return /^(\*\.)?[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/i.test(value);
}

export default function SelfCertPage() {
  const {
    result,
    error,
    isGenerating,
    generateCert,
  } = useCertGenerator();

  const [commonName, setCommonName] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [organization, setOrganization] = useState("");
  const [country, setCountry] = useState("");
  const [days, setDays] = useState(3650);
  const [keySize, setKeySize] = useState<2048 | 4096>(2048);
  const [hash, setHash] = useState<"sha256" | "sha384" | "sha512">("sha256");
  const [sanEntries, setSanEntries] = useState<SanEntry[]>([]);
  const [formError, setFormError] = useState("");

  const addSan = () => {
    setSanEntries((prev) => [
      ...prev,
      {
        id: randomId("san_"),
        type: "DNS",
        value: "",
      },
    ]);
  };

  const updateSanType = (id: string, type: SanType) => {
    setSanEntries((prev) =>
      prev.map((item) => (item.id === id ? { ...item, type } : item))
    );
  };

  const removeSan = (id: string) => {
    setSanEntries((prev) => prev.filter((x) => x.id !== id));
  };

  const updateSan = (id: string, value: string) => {
    setSanEntries((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, value } : item
      )
    );
  };

  const autoSan = useMemo(() => {
    const value = commonName.trim();

    if (!value) {
      return null;
    }

    // 旧判断把任意含冒号的 hex 串（dead:beef、a:b）当成 IPv6，
    // node-forge 会静默写入垃圾字节，生成出浏览器无法校验的证书
    const isIP = isIPv4Literal(value) || isIPv6Literal(value);

    return {
      id: "auto-cn",
      type: isIP ? "IP" : "DNS",
      value,
    } as SanEntry;
  }, [commonName]);

  const finalSan = useMemo(() => {
    const map = new Map<string, SanEntry>();

    if (autoSan) {
      map.set(`${autoSan.type}:${autoSan.value}`.toLowerCase(), autoSan);
    }

    sanEntries.forEach((item) => {
      const key = `${item.type}:${item.value}`.trim().toLowerCase();

      if (item.value.trim() && !map.has(key)) {
        map.set(key, item);
      }
    });

    return Array.from(map.values());
  }, [autoSan, sanEntries]);

  /** 两个生成入口共用同一套校验，避免「localhost 开发证书」跳过国家代码检查 */
  const validate = (cn: string): string | null => {
    if (!cn.trim()) return "请输入证书名称";
    if (country.trim() && !/^[A-Za-z]{2}$/.test(country.trim())) {
      return "国家代码必须为 2 位字母，例如 CN、US、KR";
    }
    const invalid = finalSan.find((entry) => !validSan(entry));
    if (invalid) return `SAN「${invalid.type}: ${invalid.value}」不是合法的域名或 IP 地址`;
    return null;
  };

  const commonPayload = () => ({
    keySize,
    hash,
    days,
    organization: organization || undefined,
    country: country.trim().toUpperCase() || undefined,
  });

  const generate = () => {
    const cn = commonName.trim();
    const message = validate(cn);
    if (message) {
      setFormError(message);
      return;
    }
    setFormError("");

    generateCert({
      ...commonPayload(),
      commonName: cn,
      sanEntries: finalSan,
    });
  };

  const generateLocalhost = () => {
    const message = validate("localhost");
    if (message) {
      setFormError(message);
      return;
    }
    setFormError("");

    generateCert({
      ...commonPayload(),
      commonName: "localhost",
      sanEntries: [
        { id: "1", type: "DNS", value: "localhost" },
        { id: "2", type: "IP", value: "127.0.0.1" },
        { id: "3", type: "IP", value: "::1" },
      ],
    });
  };

  return (
    <ToolShell>
      <div className="space-y-6">
        {/* 页面标题与描述由 ToolShell 统一渲染，这里不再重复 */}
        <div className="ui-panel-muted space-y-5">
          <div>
            <label htmlFor="cert-cn" className="ui-label text-sm">证书名称 (CN)</label>
            <input
              id="cert-cn"
              value={commonName}
              onChange={(e) => setCommonName(e.target.value)}
              placeholder="example.com、*.example.com、192.168.1.100"
              className="ui-input mt-2"
            />
          </div>

          <div>
            <div className="flex items-center justify-between gap-3 mb-3">
              <span className="ui-label text-sm">SAN 扩展</span>
              <Button variant="ghost" size="sm" icon={Plus} onClick={addSan}>
                添加
              </Button>
            </div>

            <div className="space-y-2">
              {autoSan && (
                <div className="flex gap-2">
                  <Badge className="ui-badge-success w-20 shrink-0 justify-center">
                    AUTO
                  </Badge>
                  <input
                    readOnly
                    value={`${autoSan.type}: ${autoSan.value}`}
                    className="ui-input ui-input-sm bg-slate-50"
                  />
                </div>
              )}

              {sanEntries.map((item) => (
                <div key={item.id} className="flex gap-2">
                  <select
                    value={item.type}
                    onChange={(e) => updateSanType(item.id, e.target.value as SanType)}
                    aria-label="SAN 类型"
                    className="ui-select ui-input-sm w-24 shrink-0"
                  >
                    <option value="DNS">DNS</option>
                    <option value="IP">IP</option>
                  </select>
                  <input
                    value={item.value}
                    onChange={(e) => updateSan(item.id, e.target.value)}
                    placeholder={item.type === "IP" ? "如 10.0.0.1 或 ::1" : "如 api.example.com"}
                    aria-label="SAN 值"
                    className="ui-input ui-input-sm"
                  />
                  <IconButton
                    label="删除该 SAN"
                    onClick={() => removeSan(item.id)}
                    className="text-red-600 hover:bg-red-50"
                  >
                    <Trash2 size={16} />
                  </IconButton>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-200 pt-4">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="ui-btn ui-btn-ghost ui-btn-sm"
            >
              高级选项
              {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {showAdvanced && (
              <div className="ui-form-grid mt-4">
                <input
                  placeholder="组织(O)"
                  aria-label="组织 (O)"
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  className="ui-input"
                />

                <input
                  placeholder="国家(C)"
                  aria-label="国家代码 (C)，2 位字母"
                  maxLength={2}
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="ui-input"
                />

                <input
                  type="number"
                  aria-label="有效期（天）"
                  min={1}
                  max={3650}
                  value={days}
                  onChange={(e) =>
                    setDays(
                      Math.min(3650, Math.max(1, Number(e.target.value)))
                    )
                  }
                  className="ui-input"
                />

                <select
                  aria-label="密钥长度"
                  value={keySize}
                  onChange={(e) =>
                    setKeySize(Number(e.target.value) as 2048 | 4096)
                  }
                  className="ui-select"
                >
                  <option value={2048}>RSA 2048</option>
                  <option value={4096}>RSA 4096</option>
                </select>

                <select
                  aria-label="签名算法"
                  value={hash}
                  onChange={(e) =>
                    setHash(
                      e.target.value as "sha256" | "sha384" | "sha512"
                    )
                  }
                  className="ui-select"
                >
                  <option value="sha256">SHA256</option>
                  <option value="sha384">SHA384</option>
                  <option value="sha512">SHA512</option>
                </select>
              </div>
            )}
          </div>

          {formError && <Notice tone="error">{formError}</Notice>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button
              icon={Shield}
              disabled={isGenerating}
              onClick={generate}
              className="w-full py-3"
            >
              {isGenerating ? "生成中..." : "生成证书"}
            </Button>

            <Button
              variant="secondary"
              icon={Laptop}
              disabled={isGenerating}
              onClick={generateLocalhost}
              className="w-full py-3"
            >
              localhost 开发证书
            </Button>
          </div>

          {error && <Notice tone="error">{error}</Notice>}

          <p className="ui-prose text-xs text-slate-500 leading-relaxed">
            自签证书不会被系统和浏览器信任，仅适合内网服务、本地开发与测试；对外站点请使用权威 CA 签发的证书。
          </p>
        </div>

        {result && (
          <div className="space-y-5">
            <Panel icon={CheckCircle2} title="证书生成成功">
              <div className="ui-kv-list">
                <KeyRow label="算法" value={`RSA ${result.info.keySize}`} />
                <KeyRow label="签名算法" value={result.info.hash} mono />
                <KeyRow
                  label="生效时间"
                  value={new Date(result.info.notBefore).toLocaleString()}
                />
                <KeyRow
                  label="过期时间"
                  value={new Date(result.info.notAfter).toLocaleString()}
                />
              </div>

              <div className="mt-4">
                <div className="text-slate-500 text-sm mb-2">SAN 扩展</div>
                <div className="flex flex-wrap gap-2">
                  {result.info.san.map((item, index) => (
                    <Badge
                      key={index}
                      className="border border-slate-200 bg-white text-slate-600"
                    >
                      {item}
                    </Badge>
                  ))}
                </div>
              </div>
            </Panel>

            <OutputBlock
              label="private-key.pem"
              hint="请妥善保管，遗失不可恢复"
              tone="warning"
              value={result.privateKey}
              copyLabel="复制私钥"
              filename="private-key.pem"
              mimeType="application/x-pem-file;charset=utf-8"
              textareaClassName="text-xs"
            />

            <OutputBlock
              label="certificate.pem"
              value={result.certificate}
              copyLabel="复制证书"
              filename="certificate.pem"
              mimeType="application/x-pem-file;charset=utf-8"
              textareaClassName="text-xs"
            />
          </div>
        )}
      </div>
    </ToolShell>
  );
}
